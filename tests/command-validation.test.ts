import { describe, it, expect } from "vitest";
import { validateDateCommand, DateStringSchema } from "../src/common/command-validation.ts";

describe("command-validation", () => {
  describe("DateStringSchema", () => {
    it("should accept valid date strings", () => {
      const validDates = ["2025-01-01", "2025-12-31", "2000-02-29", "1999-03-15"];

      for (const date of validDates) {
        const result = DateStringSchema.safeParse(date);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(date);
        }
      }
    });

    it("should reject invalid date formats", () => {
      const invalidDates = [
        "25-01-01", // 2桁年
        "2025-1-01", // 1桁月
        "2025-01-1", // 1桁日
        "2025/01/01", // スラッシュ区切り
        "abc-def-ghi", // 文字列
        "2025-01", // 日付が不完全
        "2025-01-01-01", // 余分な部分
        "", // 空文字列
      ];

      for (const date of invalidDates) {
        const result = DateStringSchema.safeParse(date);
        expect(result.success).toBe(false);
      }
    });

    it("should note that regex only validates format, not actual date validity", () => {
      // 注意: 正規表現は形式のみをチェックし、実際の日付妥当性はチェックしない
      const formatValidButDateInvalid = [
        "2025-13-01", // 存在しない月（但し形式は正しい）
        "2025-01-32", // 存在しない日（但し形式は正しい）
      ];

      for (const date of formatValidButDateInvalid) {
        const result = DateStringSchema.safeParse(date);
        // これらは正規表現的には valid になる（仕様として）
        expect(result.success).toBe(true);
      }
    });

    it("should reject non-string values", () => {
      const nonStringValues = [123, null, undefined, {}, [], true];

      for (const value of nonStringValues) {
        const result = DateStringSchema.safeParse(value);
        expect(result.success).toBe(false);
      }
    });
  });

  describe("validateDateCommand", () => {
    it("should return valid date string when input is valid", () => {
      const validDate = "2025-08-10";
      const result = validateDateCommand(validDate);
      expect(result).toBe(validDate);
    });

    it("should throw error when input is undefined", () => {
      expect(() => validateDateCommand(undefined)).toThrow("日付が指定されていません。使用方法: npm start [command] YYYY-MM-DD");
    });

    it("should throw error when input is null", () => {
      expect(() => validateDateCommand(null)).toThrow("日付が指定されていません。使用方法: npm start [command] YYYY-MM-DD");
    });

    it("should throw error for invalid date format", () => {
      const invalidDates = ["2025/08/10", "25-08-10", "2025-8-10", "2025-08-10-extra", "invalid-date"];

      for (const invalidDate of invalidDates) {
        expect(() => validateDateCommand(invalidDate)).toThrow("日付形式が正しくありません (YYYY-MM-DD形式で入力してください)");
      }
    });

    it("should accept format-valid dates even if date logic invalid", () => {
      // 正規表現では形式のみチェックするため、これらは通る
      const formatValidDates = ["2025-13-01", "2025-01-32"];

      for (const date of formatValidDates) {
        const result = validateDateCommand(date);
        expect(result).toBe(date);
      }
    });

    it("should throw error for non-string types", () => {
      const nonStringValues = [123, {}, [], true];

      for (const value of nonStringValues) {
        expect(() => validateDateCommand(value)).toThrow();
      }
    });

    it("should handle edge case valid dates", () => {
      const edgeCaseDates = [
        "0001-01-01", // 最小年
        "9999-12-31", // 最大年（regex的に）
        "2000-02-29", // うるう年
      ];

      for (const date of edgeCaseDates) {
        const result = validateDateCommand(date);
        expect(result).toBe(date);
      }
    });
  });
});
