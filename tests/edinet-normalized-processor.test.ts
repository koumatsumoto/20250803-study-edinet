import { describe, it, expect, beforeEach } from "vitest";
import { EdinetNormalizedProcessor } from "../src/common/edinet-normalized-processor.ts";
import type { EdinetJson, Fact, DocumentMeta } from "../src/common/edinet-zip-processor.ts";

describe("EdinetNormalizedProcessor", () => {
  let processor: EdinetNormalizedProcessor;

  beforeEach(() => {
    processor = new EdinetNormalizedProcessor();
  });

  describe("normalize", () => {
    it("should normalize basic EdinetJSON to normalized structure", async () => {
      // テスト用のEdinetJSONデータを作成
      const testData: EdinetJson = {
        meta: {
          docID: "S100TEST",
          edinetCode: "E12345",
          filerName: "テスト株式会社",
          formCode: "030000",
          submitDate: "2024-01-15",
          source: "EDINET v2",
        },
        facts: [
          {
            element_id: "jppfs_cor:NetSales",
            label: "売上高",
            value: "1000000",
            context_id: "CurrentYearDuration_ConsolidatedMember",
            relative_year: "0",
            consolidation: "連結",
            period_type: "duration",
            unit_id: "JPY",
            period_start: "2024-01-01",
            period_end: "2024-12-31",
            decimals: "0",
            source_file: "test.csv",
          },
          {
            element_id: "jppfs_cor:OperatingIncome",
            label: "営業利益",
            value: "150000",
            context_id: "CurrentYearDuration_ConsolidatedMember",
            relative_year: "0",
            consolidation: "連結",
            period_type: "duration",
            unit_id: "JPY",
            period_start: "2024-01-01",
            period_end: "2024-12-31",
            decimals: "0",
            source_file: "test.csv",
          },
          {
            element_id: "jppfs_cor:CompanyName",
            label: "会社名",
            value: "テスト株式会社",
            context_id: "CurrentYearInstant_ConsolidatedMember",
            relative_year: "0",
            consolidation: "連結",
            period_type: "instant",
            unit_id: null,
            period_start: null,
            period_end: "2024-12-31",
            decimals: null,
            source_file: "test.csv",
          },
        ],
        index: {
          facts_by_element: {
            "jppfs_cor:NetSales": [0],
            "jppfs_cor:OperatingIncome": [1],
            "jppfs_cor:CompanyName": [2],
          },
          statements: {
            "test.csv": [0, 1, 2],
          },
        },
      };

      const result = await processor.normalize(testData);

      // 基本的な構造の確認
      expect(result.documents).toHaveLength(1);
      expect(result.contexts.length).toBeGreaterThan(0);
      expect(result.facts.length).toBeGreaterThan(0);

      // Documentレコードの確認
      const document = result.documents[0];
      expect(document.document_id).toBe("S100TEST");
      expect(document.edinet_code).toBe("E12345");
      expect(document.filer_name).toBe("テスト株式会社");
      expect(document.form_code).toBe("030000");
      expect(document.filed_at_jst).toBe("2024-01-15");
      expect(document.has_csv).toBe(true);
      expect(document.source).toBe("EDINET v2");

      // Contextsレコードの確認（重複排除されているか）
      expect(result.contexts.length).toBeLessThanOrEqual(2); // duration + instant
      const durationContext = result.contexts.find((c) => c.period_type === "duration");
      const instantContext = result.contexts.find((c) => c.period_type === "instant");

      expect(durationContext).toBeDefined();
      expect(instantContext).toBeDefined();
      expect(durationContext!.consolidated_flag).toBe("Consolidated");
      expect(durationContext!.relative_year).toBe(0);
      expect(durationContext!.period_label).toBe("当期");

      // Factsレコードの確認
      expect(result.facts).toHaveLength(3);

      const salesFact = result.facts.find((f) => f.concept === "jppfs_cor:NetSales");
      expect(salesFact).toBeDefined();
      expect(salesFact!.value_num).toBe(1000000);
      expect(salesFact!.value_str).toBe(null);
      expect(salesFact!.is_numeric).toBe(true);
      expect(salesFact!.unit).toBe("JPY");
      expect(salesFact!.account_label).toBe("売上高");

      const companyNameFact = result.facts.find((f) => f.concept === "jppfs_cor:CompanyName");
      expect(companyNameFact).toBeDefined();
      expect(companyNameFact!.value_num).toBe(null);
      expect(companyNameFact!.value_str).toBe("テスト株式会社");
      expect(companyNameFact!.is_numeric).toBe(false);
      expect(companyNameFact!.unit).toBe(null);

      // サマリ情報の確認
      expect(result.summary.document_count).toBe(1);
      expect(result.summary.total_facts).toBe(3);
      expect(result.summary.numeric_facts).toBe(2); // NetSales + OperatingIncome
      expect(result.summary.processing_time_ms).toBeGreaterThan(0);
    });

    it("should handle empty EdinetJSON", async () => {
      const emptyData: EdinetJson = {
        meta: {
          docID: "S100EMPTY",
          source: "EDINET v2",
        },
        facts: [],
        index: {
          facts_by_element: {},
          statements: {},
        },
      };

      const result = await processor.normalize(emptyData);

      expect(result.documents).toHaveLength(1);
      expect(result.contexts).toHaveLength(0);
      expect(result.facts).toHaveLength(0);
      expect(result.summary.total_facts).toBe(0);
      expect(result.summary.numeric_facts).toBe(0);
    });

    it("should handle various value types correctly", async () => {
      const testData: EdinetJson = {
        meta: {
          docID: "S100VALUES",
          source: "EDINET v2",
        },
        facts: [
          {
            element_id: "test:NumericValue",
            label: "数値テスト",
            value: 123.45,
            context_id: "ctx1",
            source_file: "test.csv",
          },
          {
            element_id: "test:StringNumeric",
            label: "文字列数値テスト",
            value: "1,234,567",
            context_id: "ctx1",
            source_file: "test.csv",
          },
          {
            element_id: "test:StringValue",
            label: "文字列テスト",
            value: "テスト文字列",
            context_id: "ctx1",
            source_file: "test.csv",
          },
          {
            element_id: "test:EmptyValue",
            label: "空値テスト",
            value: null,
            context_id: "ctx1",
            source_file: "test.csv",
          },
        ],
        index: { facts_by_element: {}, statements: {} },
      };

      const result = await processor.normalize(testData);

      const numericFact = result.facts.find((f) => f.concept === "test:NumericValue");
      expect(numericFact!.value_num).toBe(123.45);
      expect(numericFact!.is_numeric).toBe(true);

      const stringNumericFact = result.facts.find((f) => f.concept === "test:StringNumeric");
      expect(stringNumericFact!.value_num).toBe(1234567);
      expect(stringNumericFact!.is_numeric).toBe(true);

      const stringFact = result.facts.find((f) => f.concept === "test:StringValue");
      expect(stringFact!.value_str).toBe("テスト文字列");
      expect(stringFact!.is_numeric).toBe(false);

      const emptyFact = result.facts.find((f) => f.concept === "test:EmptyValue");
      expect(emptyFact!.value_num).toBe(null);
      expect(emptyFact!.value_str).toBe(null);
      expect(emptyFact!.is_numeric).toBe(false);
    });
  });

  describe("normalizeMultiple", () => {
    it("should handle multiple EdinetJSON documents", async () => {
      const doc1: EdinetJson = {
        meta: { docID: "S100DOC1", source: "EDINET v2" },
        facts: [
          {
            element_id: "test:Sales",
            label: "売上高",
            value: "1000000",
            context_id: "ctx1",
            period_type: "duration",
            consolidation: "連結",
            relative_year: "0",
            source_file: "test1.csv",
          },
        ],
        index: { facts_by_element: {}, statements: {} },
      };

      const doc2: EdinetJson = {
        meta: { docID: "S100DOC2", source: "EDINET v2" },
        facts: [
          {
            element_id: "test:Profit",
            label: "利益",
            value: "200000",
            context_id: "ctx2",
            period_type: "duration",
            consolidation: "連結",
            relative_year: "0",
            source_file: "test2.csv",
          },
        ],
        index: { facts_by_element: {}, statements: {} },
      };

      const result = await processor.normalizeMultiple([doc1, doc2]);

      expect(result.documents).toHaveLength(2);
      expect(result.facts).toHaveLength(2);
      expect(result.summary.document_count).toBe(2);
      expect(result.summary.total_facts).toBe(2);
    });
  });

  describe("exportToJson", () => {
    it("should export normalized result to JSON format", async () => {
      const testData: EdinetJson = {
        meta: {
          docID: "S100EXPORT",
          source: "EDINET v2",
        },
        facts: [
          {
            element_id: "test:TestValue",
            label: "テスト値",
            value: "12345",
            context_id: "ctx1",
            source_file: "test.csv",
          },
        ],
        index: { facts_by_element: {}, statements: {} },
      };

      const normalized = await processor.normalize(testData);
      const exported = await processor.exportToJson(normalized);

      expect(exported.meta.source_format).toBe("EdinetJSON v1.0");
      expect(exported.meta.document_count).toBe(1);
      expect(exported.meta.total_facts).toBe(1);
      expect(exported.meta.processed_at).toBeDefined();
      expect(new Date(exported.meta.processed_at).getTime()).toBeGreaterThan(0);

      expect(exported.documents).toEqual(normalized.documents);
      expect(exported.contexts).toEqual(normalized.contexts);
      expect(exported.facts).toEqual(normalized.facts);
    });
  });
});
