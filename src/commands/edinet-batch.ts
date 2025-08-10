import { EdinetApiClient } from "../common/edinet-api-client.ts";
import { EdinetNormalizedProcessor } from "../common/edinet-normalized-processor.ts";
import { EdinetDailyBatchProcessor } from "../common/edinet-daily-batch-processor.ts";
import { validateDateCommand } from "../common/command-validation.ts";

/**
 * 日次バッチ処理コマンド
 */
export async function edinetBatchCommand(args: { date?: string }): Promise<void> {
  // 日付引数の検証
  const validatedDate = validateDateCommand(args.date);

  try {
    // 依存関係のインスタンス化
    const apiClient = new EdinetApiClient();
    const normalizedProcessor = new EdinetNormalizedProcessor();
    const batchProcessor = new EdinetDailyBatchProcessor(apiClient, normalizedProcessor);

    // バッチ処理実行
    await batchProcessor.processDailyBatch(validatedDate);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`💥 バッチ処理でエラーが発生しました: ${errorMessage}`);
    process.exit(1);
  }
}
