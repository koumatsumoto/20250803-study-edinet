import { v4 as uuidv4 } from "uuid";
import { EdinetZipProcessor } from "./edinet-zip-processor.ts";
import type { EdinetJson } from "./edinet-zip-processor.ts";
import type {
  DocumentRecord,
  ContextRecord,
  FactRecord,
  NormalizedResult,
  NormalizedJson,
  ProcessingSummary,
  PeriodType,
  ConsolidatedType,
  UnitType,
} from "./normalized-types.ts";

/**
 * EDINET JSONデータを正規化データモデルに変換するプロセッサ
 */
export class EdinetNormalizedProcessor {
  private readonly zipProcessor = new EdinetZipProcessor();

  /**
   * EdinetJSON → 正規化JSON変換
   * @param edinetJson - 変換元EdinetJSONデータ
   * @returns 正規化結果
   */
  async normalize(edinetJson: EdinetJson): Promise<NormalizedResult> {
    const startTime = Date.now();

    // 1. Documentレコードを作成
    const document = this.createDocumentRecord(edinetJson);

    // 2. Contextsレコードを作成（重複排除）
    const contexts = this.createContextRecords(edinetJson);

    // 3. Factsレコードを作成
    const facts = this.createFactRecords(edinetJson, contexts);

    // 4. サマリ情報を作成
    const summary: ProcessingSummary = {
      document_count: 1,
      total_facts: facts.length,
      total_contexts: contexts.length,
      contexts_deduplicated: this.countOriginalContexts(edinetJson) - contexts.length,
      numeric_facts: facts.filter((f) => f.is_numeric).length,
      processing_time_ms: Date.now() - startTime,
    };

    return {
      documents: [document],
      contexts,
      facts,
      summary,
    };
  }

  /**
   * 複数EdinetJSON一括正規化
   * @param edinetJsons - 変換元EdinetJSON配列
   * @returns 正規化結果
   */
  async normalizeMultiple(edinetJsons: EdinetJson[]): Promise<NormalizedResult> {
    const startTime = Date.now();

    const allDocuments: DocumentRecord[] = [];
    const allContexts: ContextRecord[] = [];
    const allFacts: FactRecord[] = [];
    let totalOriginalContexts = 0;

    // 各EdinetJSONを処理
    for (const edinetJson of edinetJsons) {
      const document = this.createDocumentRecord(edinetJson);
      const contexts = this.createContextRecords(edinetJson);
      const facts = this.createFactRecords(edinetJson, contexts);

      allDocuments.push(document);
      allContexts.push(...contexts);
      allFacts.push(...facts);
      totalOriginalContexts += this.countOriginalContexts(edinetJson);
    }

    // 複数文書間でのcontexts重複排除
    const deduplicatedContexts = this.deduplicateContextsGlobally(allContexts);

    // サマリ情報を作成
    const summary: ProcessingSummary = {
      document_count: allDocuments.length,
      total_facts: allFacts.length,
      total_contexts: deduplicatedContexts.length,
      contexts_deduplicated: totalOriginalContexts - deduplicatedContexts.length,
      numeric_facts: allFacts.filter((f) => f.is_numeric).length,
      processing_time_ms: Date.now() - startTime,
    };

    return {
      documents: allDocuments,
      contexts: deduplicatedContexts,
      facts: allFacts,
      summary,
    };
  }

  /**
   * ZIP → 正規化JSON直接処理（便利メソッド）
   * @param buffer - ZIPバッファ
   * @param docId - 文書ID
   * @returns 正規化結果
   */
  async processZipToNormalized(buffer: Buffer, docId: string): Promise<NormalizedResult> {
    const edinetJson = await this.zipProcessor.processZipToJson(buffer, docId);
    return this.normalize(edinetJson);
  }

  /**
   * 正規化結果をJSON形式に変換
   * @param result - 正規化結果
   * @returns JSON出力用オブジェクト
   */
  async exportToJson(result: NormalizedResult): Promise<NormalizedJson> {
    return {
      meta: {
        processed_at: new Date().toISOString(),
        document_count: result.summary.document_count,
        total_facts: result.summary.total_facts,
        total_contexts: result.summary.total_contexts,
        source_format: "EdinetJSON v1.0",
      },
      documents: result.documents,
      contexts: result.contexts,
      facts: result.facts,
    };
  }

  /**
   * EdinetJSONからDocumentレコードを作成
   */
  private createDocumentRecord(edinetJson: EdinetJson): DocumentRecord {
    return {
      document_id: edinetJson.meta.docID,
      edinet_code: edinetJson.meta.edinetCode || null,
      filer_name: edinetJson.meta.filerName || null,
      doc_type: null, // EdinetJSONには含まれていない
      form_code: edinetJson.meta.formCode || null,
      period_start: null, // EdinetJSONには含まれていない
      period_end: null, // EdinetJSONには含まれていない
      filed_at_jst: edinetJson.meta.submitDate || null,
      has_csv: edinetJson.facts.length > 0,
      processed_at: new Date().toISOString(),
      source: "EDINET v2",
    };
  }

  /**
   * EdinetJSONからContextレコードを作成（重複排除）
   */
  private createContextRecords(edinetJson: EdinetJson): ContextRecord[] {
    const contextMap = new Map<string, ContextRecord>();

    for (const fact of edinetJson.facts) {
      if (!fact.context_id) continue;

      const contextKey = `${edinetJson.meta.docID}:${fact.context_id}`;

      if (!contextMap.has(contextKey)) {
        const context: ContextRecord = {
          document_id: edinetJson.meta.docID,
          context_id: fact.context_id,
          period_type: this.normalizePeriodType(fact.period_type ?? null),
          period_label: this.normalizePeriodLabel(fact.relative_year ?? null, fact.period_type ?? null),
          consolidated_flag: this.normalizeConsolidatedType(fact.consolidation ?? null),
          relative_year: this.normalizeRelativeYear(fact.relative_year ?? null),
          hashkey: this.generateContextHashKey(fact.context_id, fact.period_type ?? null, fact.consolidation ?? null),
        };

        contextMap.set(contextKey, context);
      }
    }

    return Array.from(contextMap.values());
  }

  /**
   * EdinetJSONからFactレコードを作成
   */
  private createFactRecords(edinetJson: EdinetJson, contexts: ContextRecord[]): FactRecord[] {
    const facts: FactRecord[] = [];

    for (const fact of edinetJson.facts) {
      if (!fact.context_id || !fact.element_id) continue;

      // 対応するcontextを検索
      const context = contexts.find((c) => c.context_id === fact.context_id && c.document_id === edinetJson.meta.docID);
      if (!context) continue;

      // 数値・文字列の判定と変換
      const { valueNum, valueStr, isNumeric } = this.parseValue(fact.value);

      const factRecord: FactRecord = {
        document_id: edinetJson.meta.docID,
        fact_id: uuidv4(),
        context_id: fact.context_id,
        concept: fact.element_id,
        account_label: fact.label || "",
        value_num: valueNum,
        value_str: valueStr,
        unit: this.normalizeUnitType(fact.unit_id ?? null),
        is_numeric: isNumeric,

        // 検索性向上のための冗長保持
        consolidated_flag: context.consolidated_flag,
        period_type: context.period_type,
        period_label: context.period_label,
      };

      facts.push(factRecord);
    }

    return facts;
  }

  /**
   * 値の型判定と変換
   */
  private parseValue(value: string | number | null): {
    valueNum: number | null;
    valueStr: string | null;
    isNumeric: boolean;
  } {
    if (value === null || value === undefined) {
      return { valueNum: null, valueStr: null, isNumeric: false };
    }

    // 既に数値の場合
    if (typeof value === "number") {
      return { valueNum: value, valueStr: null, isNumeric: true };
    }

    // 文字列から数値変換を試行
    const strValue = String(value).trim();
    if (strValue === "" || strValue === "-") {
      return { valueNum: null, valueStr: strValue, isNumeric: false };
    }

    // カンマ区切りを除去して数値変換
    const normalizedStr = strValue.replace(/,/g, "");
    const numValue = Number(normalizedStr);

    if (!isNaN(numValue) && isFinite(numValue)) {
      return { valueNum: numValue, valueStr: null, isNumeric: true };
    }

    return { valueNum: null, valueStr: strValue, isNumeric: false };
  }

  /**
   * 期間タイプの正規化
   */
  private normalizePeriodType(periodType: string | null): PeriodType {
    if (!periodType) return "unknown";

    const normalized = periodType.toLowerCase().trim();
    if (normalized.includes("duration") || normalized.includes("期間")) {
      return "duration";
    }
    if (normalized.includes("instant") || normalized.includes("時点")) {
      return "instant";
    }
    return "unknown";
  }

  /**
   * 連結区分の正規化
   */
  private normalizeConsolidatedType(consolidation: string | null): ConsolidatedType {
    if (!consolidation) return "Unknown";

    const normalized = consolidation.trim();
    if (normalized.includes("連結") || normalized.toLowerCase().includes("consolidated")) {
      return "Consolidated";
    }
    if (normalized.includes("個別") || normalized.toLowerCase().includes("nonconsolidated")) {
      return "NonConsolidated";
    }
    if (normalized !== "Unknown") {
      return "Other";
    }
    return "Unknown";
  }

  /**
   * 単位タイプの正規化
   */
  private normalizeUnitType(unitId: string | null): UnitType | null {
    if (!unitId) return null;

    const normalized = unitId.toLowerCase().trim();
    if (normalized.includes("jpy") || normalized.includes("円")) {
      return "JPY";
    }
    if (normalized.includes("shares") || normalized.includes("株")) {
      return "shares";
    }
    if (normalized.includes("percent") || normalized.includes("%")) {
      return "percent";
    }
    if (normalized.includes("count") || normalized.includes("件数")) {
      return "count";
    }
    return "other";
  }

  /**
   * 相対年度の正規化
   */
  private normalizeRelativeYear(relativeYear: string | null): number | null {
    if (!relativeYear) return null;

    const year = parseInt(relativeYear.trim(), 10);
    return isNaN(year) ? null : year;
  }

  /**
   * 期間ラベルの生成
   */
  private normalizePeriodLabel(relativeYear: string | null, periodType: string | null): string {
    const year = this.normalizeRelativeYear(relativeYear);
    const type = this.normalizePeriodType(periodType);

    if (year === 0) {
      return type === "duration" ? "当期" : "当期末";
    } else if (year === -1) {
      return type === "duration" ? "前期" : "前期末";
    } else if (year !== null) {
      return `${year}期${type === "duration" ? "" : "末"}`;
    }

    return type === "duration" ? "期間" : "時点";
  }

  /**
   * コンテキストハッシュキーの生成
   */
  private generateContextHashKey(contextId: string, periodType: string | null, consolidation: string | null): string {
    const parts = [contextId, periodType || "", consolidation || ""];
    return Buffer.from(parts.join("|")).toString("base64");
  }

  /**
   * 元のコンテキスト数をカウント（重複排除効果測定用）
   */
  private countOriginalContexts(edinetJson: EdinetJson): number {
    const contextIds = new Set<string>();
    for (const fact of edinetJson.facts) {
      if (fact.context_id) {
        contextIds.add(fact.context_id);
      }
    }
    return contextIds.size;
  }

  /**
   * 複数文書間でのcontexts重複排除（全体最適化）
   */
  private deduplicateContextsGlobally(contexts: ContextRecord[]): ContextRecord[] {
    const contextMap = new Map<string, ContextRecord>();

    for (const context of contexts) {
      const globalKey = `${context.period_type}:${context.period_label}:${context.consolidated_flag}:${context.relative_year}`;

      if (!contextMap.has(globalKey)) {
        contextMap.set(globalKey, context);
      }
    }

    return Array.from(contextMap.values());
  }
}
