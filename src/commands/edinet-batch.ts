import { EdinetApiClient } from "../common/edinet-api-client.ts";
import { EdinetNormalizedProcessor } from "../common/edinet-normalized-processor.ts";
import { EdinetDailyBatchProcessor } from "../common/edinet-daily-batch-processor.ts";

/**
 * 日次バッチ処理コマンド
 */
export async function edinetBatchCommand(args: { date?: string | undefined }): Promise<void> {
  // 日付引数の検証
  if (!args.date) {
    console.error("❌ エラー: 日付が指定されていません");
    console.log("使用方法: npm start batch YYYY-MM-DD");
    process.exit(1);
  }

  // 日付形式の検証
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(args.date)) {
    console.error("❌ エラー: 日付形式が正しくありません (YYYY-MM-DD形式で入力してください)");
    process.exit(1);
  }

  try {
    // 依存関係のインスタンス化
    const apiClient = new EdinetApiClient();
    const normalizedProcessor = new EdinetNormalizedProcessor();
    const batchProcessor = new EdinetDailyBatchProcessor(apiClient, normalizedProcessor);

    // バッチ処理実行
    await batchProcessor.processDailyBatch(args.date);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`💥 バッチ処理でエラーが発生しました: ${errorMessage}`);
    process.exit(1);
  }
}
