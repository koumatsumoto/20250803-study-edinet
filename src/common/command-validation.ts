import { z } from "zod";

/**
 * コマンド引数のバリデーションスキーマ
 */

// 日付文字列（YYYY-MM-DD形式）のスキーマ
export const DateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付形式が正しくありません (YYYY-MM-DD形式で入力してください)");

export type DateString = z.infer<typeof DateStringSchema>;

/**
 * 日付値をバリデーションしてエラー時にthrowする
 */
export function validateDateCommand(dateValue: unknown): string {
  if (dateValue === undefined || dateValue === null) {
    throw new Error("日付が指定されていません。使用方法: npm start [command] YYYY-MM-DD");
  }

  const result = DateStringSchema.safeParse(dateValue);

  if (!result.success) {
    const firstError = result.error.issues[0];
    throw new Error(firstError?.message || "入力が正しくありません");
  }

  return result.data;
}
