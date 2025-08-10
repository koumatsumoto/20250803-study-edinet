import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { EdinetNormalizedProcessor } from "../src/common/edinet-normalized-processor.ts";

describe("EdinetNormalizedProcessor Integration Tests", () => {
  const processor = new EdinetNormalizedProcessor();

  // テストするフィクスチャファイルのリスト
  const fixtures = [
    { docId: "S100W523", file: "S100W523.zip", description: "有価証券報告書" },
    { docId: "S100WEV7", file: "S100WEV7.zip", description: "半期報告書" },
    { docId: "S100VSRY", file: "S100VSRY.zip", description: "有価証券届出書" },
  ];

  describe("processZipToNormalized with real fixtures", () => {
    fixtures.forEach(({ docId, file, description }) => {
      it(`should process ${file} (${description}) successfully`, async () => {
        const fixturePath = `./tests/fixtures/${file}`;

        // フィクスチャファイルの存在確認
        if (!existsSync(fixturePath)) {
          console.warn(`Fixture file not found: ${fixturePath}, skipping test`);
          return;
        }

        const buffer = readFileSync(fixturePath);

        // ZIP → 正規化JSON直接変換
        const result = await processor.processZipToNormalized(buffer, docId);

        // 基本的な構造の検証
        expect(result.documents).toHaveLength(1);
        expect(result.documents[0].document_id).toBe(docId);
        expect(result.documents[0].source).toBe("EDINET v2");
        expect(result.documents[0].has_csv).toBe(true);

        // データが存在することを確認
        expect(result.facts.length).toBeGreaterThan(0);
        expect(result.contexts.length).toBeGreaterThan(0);

        // 各factが正しい構造を持つことを確認
        result.facts.forEach((fact) => {
          expect(fact.document_id).toBe(docId);
          expect(fact.fact_id).toBeDefined();
          expect(fact.fact_id.length).toBeGreaterThan(0);
          expect(fact.context_id).toBeDefined();
          expect(fact.concept).toBeDefined();

          // 数値・文字列の排他性を確認
          if (fact.is_numeric) {
            expect(fact.value_num).not.toBe(null);
            expect(fact.value_str).toBe(null);
          } else {
            expect(fact.value_num).toBe(null);
            // 文字列の場合はnullまたは文字列
          }

          // 冗長保持フィールドの存在確認
          expect(fact.consolidated_flag).toBeDefined();
          expect(fact.period_type).toBeDefined();
          expect(fact.period_label).toBeDefined();
        });

        // 各contextが正しい構造を持つことを確認
        result.contexts.forEach((context) => {
          expect(context.document_id).toBe(docId);
          expect(context.context_id).toBeDefined();
          expect(context.period_type).toMatch(/^(duration|instant|unknown)$/);
          expect(context.consolidated_flag).toMatch(/^(Consolidated|NonConsolidated|Other|Unknown)$/);
          expect(context.hashkey).toBeDefined();
          expect(context.hashkey.length).toBeGreaterThan(0);
        });

        // サマリ情報の整合性確認
        expect(result.summary.document_count).toBe(1);
        expect(result.summary.total_facts).toBe(result.facts.length);
        expect(result.summary.total_contexts).toBe(result.contexts.length);
        expect(result.summary.numeric_facts).toBe(result.facts.filter((f) => f.is_numeric).length);
        expect(result.summary.processing_time_ms).toBeGreaterThan(0);

        // contexts重複排除の効果確認
        const uniqueContextIds = new Set(result.facts.map((f) => f.context_id));
        expect(result.contexts.length).toBeLessThanOrEqual(uniqueContextIds.size);

        console.log(`${docId} (${description}):`, {
          facts: result.summary.total_facts,
          contexts: result.summary.total_contexts,
          numericFacts: result.summary.numeric_facts,
          deduplicationSavings: result.summary.contexts_deduplicated,
          processingTime: `${result.summary.processing_time_ms}ms`,
        });
      });
    });
  });

  describe("exportToJson integration", () => {
    it("should export real data to JSON format correctly", async () => {
      const fixturePath = "./tests/fixtures/S100W523.zip";

      if (!existsSync(fixturePath)) {
        console.warn("S100W523.zip fixture not found, skipping integration export test");
        return;
      }

      const buffer = readFileSync(fixturePath);

      // 正規化処理
      const normalized = await processor.processZipToNormalized(buffer, "S100W523");

      // JSON出力
      const exported = await processor.exportToJson(normalized);

      // メタデータの確認
      expect(exported.meta.source_format).toBe("EdinetJSON v1.0");
      expect(exported.meta.document_count).toBe(1);
      expect(exported.meta.total_facts).toBe(normalized.facts.length);
      expect(exported.meta.total_contexts).toBe(normalized.contexts.length);

      // 出力されたJSONが有効なISO日時文字列を持つことを確認
      const processedAt = new Date(exported.meta.processed_at);
      expect(processedAt.getTime()).toBeGreaterThan(0);

      // データ構造の整合性確認
      expect(exported.documents).toEqual(normalized.documents);
      expect(exported.contexts).toEqual(normalized.contexts);
      expect(exported.facts).toEqual(normalized.facts);

      // JSONサイズの確認（デバッグ用）
      const jsonString = JSON.stringify(exported);
      console.log(`Exported JSON size: ${(jsonString.length / 1024).toFixed(2)} KB`);
    });
  });

  describe("normalizeMultiple integration", () => {
    it("should handle multiple real documents with deduplication", async () => {
      const fixtures = ["S100W523.zip", "S100VSRY.zip"];
      const buffers: { buffer: Buffer; docId: string }[] = [];

      // 利用可能なフィクスチャを収集
      fixtures.forEach((file, index) => {
        const fixturePath = `./tests/fixtures/${file}`;
        if (existsSync(fixturePath)) {
          const buffer = readFileSync(fixturePath);
          const docId = file.replace(".zip", "");
          buffers.push({ buffer, docId });
        }
      });

      if (buffers.length < 2) {
        console.warn("Not enough fixtures available for multiple document test, skipping");
        return;
      }

      // 個別処理
      const individualResults = await Promise.all(buffers.map(({ buffer, docId }) => processor.processZipToNormalized(buffer, docId)));

      // 統合処理用のEdinetJSONを作成
      const zipProcessor = new (await import("../src/common/edinet-zip-processor.ts")).EdinetZipProcessor();
      const edinetJsons = await Promise.all(buffers.map(({ buffer, docId }) => zipProcessor.processZipToJson(buffer, docId)));

      // 一括正規化処理
      const batchResult = await processor.normalizeMultiple(edinetJsons);

      // 結果の検証
      expect(batchResult.documents).toHaveLength(buffers.length);
      expect(batchResult.summary.document_count).toBe(buffers.length);

      const totalIndividualFacts = individualResults.reduce((sum, result) => sum + result.facts.length, 0);
      expect(batchResult.facts).toHaveLength(totalIndividualFacts);

      // 重複排除効果の確認
      const totalIndividualContexts = individualResults.reduce((sum, result) => sum + result.contexts.length, 0);
      expect(batchResult.contexts.length).toBeLessThanOrEqual(totalIndividualContexts);

      console.log("Multiple document processing results:", {
        documentCount: batchResult.summary.document_count,
        totalFacts: batchResult.summary.total_facts,
        totalContexts: batchResult.summary.total_contexts,
        deduplicationSavings: batchResult.summary.contexts_deduplicated,
        processingTime: `${batchResult.summary.processing_time_ms}ms`,
      });
    });
  });
});
