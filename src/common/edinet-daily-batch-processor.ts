import { promises as fs } from "node:fs";
import { join } from "node:path";
import { EdinetApiClient, type EdinetDocument } from "./edinet-api-client.ts";
import { EdinetNormalizedProcessor } from "./edinet-normalized-processor.ts";
import type { BatchProcessingResult, BatchProcessingError, BatchDocumentRecord, NormalizedResult } from "./normalized-types.ts";

// 固定設定値
const BATCH_CONFIG = {
  target_doc_types: ["120", "130"], // 有価証券報告書・四半期報告書
  output_directory: "tmp/batch",
};

/**
 * EDINET日次バッチ処理プロセッサ
 */
export class EdinetDailyBatchProcessor {
  private apiClient: EdinetApiClient;
  private normalizedProcessor: EdinetNormalizedProcessor;

  constructor(apiClient: EdinetApiClient, normalizedProcessor: EdinetNormalizedProcessor) {
    this.apiClient = apiClient;
    this.normalizedProcessor = normalizedProcessor;
  }

  /**
   * メインバッチ処理
   */
  async processDailyBatch(targetDate: string): Promise<BatchProcessingResult> {
    const startTime = Date.now();

    console.log(`🚀 日次バッチ処理開始: ${targetDate}`);

    const result: BatchProcessingResult = {
      batch_date: targetDate,
      total_documents: 0,
      target_documents: 0,
      processed_documents: 0,
      failed_documents: 0,
      processing_time_ms: 0,
      documents: [],
      errors: [],
    };

    try {
      // Step 1: 文書一覧取得
      console.log("📋 EDINET APIから文書一覧を取得中...");
      const documentsList = await this.apiClient.fetchDocumentsList(targetDate);

      if (!documentsList.results || documentsList.results.length === 0) {
        console.log("📭 対象日付に文書が見つかりませんでした");
        result.processing_time_ms = Date.now() - startTime;
        return result;
      }

      result.total_documents = documentsList.results.length;
      console.log(`📊 取得文書数: ${result.total_documents}件`);

      // Step 2: 対象文書フィルタリング
      console.log("🔍 対象文書をフィルタリング中...");
      const targetDocuments = this.filterTargetDocuments(documentsList.results);
      result.target_documents = targetDocuments.length;
      console.log(`🎯 処理対象文書: ${result.target_documents}件`);

      if (targetDocuments.length === 0) {
        console.log("📭 処理対象の文書が見つかりませんでした");
        result.processing_time_ms = Date.now() - startTime;
        return result;
      }

      // Step 3: 各文書の順次処理
      console.log("⚙️  文書処理を開始します...");
      for (let i = 0; i < targetDocuments.length; i++) {
        const document = targetDocuments[i]!;
        const progressInfo = `${i + 1}/${targetDocuments.length}`;

        console.log(`📄 [${progressInfo}] 処理中: ${document.docID} (${document.filerName})`);

        try {
          const normalizedResult = await this.processDocument(document);
          const batchDocumentRecord = this.createDocumentRecord(document, normalizedResult, targetDate);

          result.documents.push(batchDocumentRecord);
          result.processed_documents++;

          // 個別文書JSON保存
          await this.saveDocumentResult(targetDate, document.docID, normalizedResult);

          console.log(`✅ [${progressInfo}] 完了: ${document.docID}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const batchError: BatchProcessingError = {
            doc_id: document.docID,
            filer_name: document.filerName,
            error_type: "PROCESSING_ERROR",
            error_message: errorMessage,
            timestamp: new Date().toISOString(),
          };

          result.errors.push(batchError);
          result.failed_documents++;

          console.error(`❌ [${progressInfo}] エラー: ${document.docID} - ${errorMessage}`);

          // エラー時は即座に終了
          throw new Error(`文書処理でエラーが発生しました: ${errorMessage}`);
        }
      }

      // Step 4: 結果保存
      await this.saveResults(targetDate, result);

      result.processing_time_ms = Date.now() - startTime;

      console.log("🎉 バッチ処理完了!");
      console.log(`📈 統計: ${result.processed_documents}/${result.target_documents}件処理完了 (処理時間: ${result.processing_time_ms}ms)`);

      return result;
    } catch (error) {
      result.processing_time_ms = Date.now() - startTime;

      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`💥 バッチ処理エラー: ${errorMessage}`);

      // プロセス終了コード1で終了
      process.exit(1);
    }
  }

  /**
   * 対象文書フィルタリング
   */
  private filterTargetDocuments(documents: EdinetDocument[]): EdinetDocument[] {
    return documents.filter((doc) => {
      // CSV取得可能な文書のみ
      if (doc.csvFlag !== "1") {
        return false;
      }

      // 取下げ文書は除外
      if (doc.withdrawalStatus === "1") {
        return false;
      }

      // 対象文書種別（有価証券報告書・四半期報告書）のみ
      if (!doc.docTypeCode || !BATCH_CONFIG.target_doc_types.includes(doc.docTypeCode)) {
        return false;
      }

      return true;
    });
  }

  /**
   * 単一文書処理
   */
  private async processDocument(document: EdinetDocument): Promise<NormalizedResult> {
    try {
      // ZIP取得
      const zipBuffer = await this.apiClient.fetchDocument(document.docID, "5");

      // 正規化処理
      const normalizedResult = await this.normalizedProcessor.processZipToNormalized(Buffer.from(zipBuffer), document.docID);

      return normalizedResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`文書 ${document.docID} の処理に失敗: ${errorMessage}`);
    }
  }

  /**
   * メタデータ統合
   */
  private createDocumentRecord(edinetDoc: EdinetDocument, normalizedResult: NormalizedResult, targetDate: string): BatchDocumentRecord {
    const baseRecord = normalizedResult.documents[0]!;

    return {
      ...baseRecord,
      // API情報で上書き
      edinet_code: edinetDoc.edinetCode,
      filer_name: edinetDoc.filerName,
      doc_type: this.mapDocTypeCode(edinetDoc.docTypeCode),
      form_code: edinetDoc.formCode,
      period_start: edinetDoc.periodStart,
      period_end: edinetDoc.periodEnd,
      filed_at_jst: edinetDoc.submitDateTime,
      has_csv: edinetDoc.csvFlag === "1",
      // バッチ処理用追加フィールド
      seq_number: edinetDoc.seqNumber,
      doc_description: edinetDoc.docDescription,
      batch_date: targetDate,
    };
  }

  /**
   * 文書種別コードを文書種別名に変換
   */
  private mapDocTypeCode(docTypeCode: string | null): string | null {
    if (!docTypeCode) return null;

    switch (docTypeCode) {
      case "120":
        return "有価証券報告書";
      case "130":
        return "四半期報告書";
      default:
        return docTypeCode;
    }
  }

  /**
   * 個別文書結果保存
   */
  private async saveDocumentResult(targetDate: string, docId: string, normalizedResult: NormalizedResult): Promise<void> {
    const outputDir = join(BATCH_CONFIG.output_directory, targetDate, "documents");
    await fs.mkdir(outputDir, { recursive: true });

    const normalizedJson = await this.normalizedProcessor.exportToJson(normalizedResult);
    const filePath = join(outputDir, `${docId}_normalized.json`);

    await fs.writeFile(filePath, JSON.stringify(normalizedJson, null, 2), "utf-8");
  }

  /**
   * 結果保存
   */
  private async saveResults(targetDate: string, result: BatchProcessingResult): Promise<void> {
    const outputDir = join(BATCH_CONFIG.output_directory, targetDate);
    await fs.mkdir(outputDir, { recursive: true });

    // バッチサマリ保存
    const summaryPath = join(outputDir, "batch_summary.json");
    await fs.writeFile(summaryPath, JSON.stringify(result, null, 2), "utf-8");

    // エラーログ保存（エラーがある場合のみ）
    if (result.errors.length > 0) {
      const errorsDir = join(outputDir, "errors");
      await fs.mkdir(errorsDir, { recursive: true });

      const errorsPath = join(errorsDir, "batch_errors.json");
      await fs.writeFile(errorsPath, JSON.stringify(result.errors, null, 2), "utf-8");
    }

    console.log(`💾 バッチ結果を保存しました: ${outputDir}/`);
  }
}
