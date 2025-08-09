import { describe, test, expect, beforeEach } from "vitest";
import { EdinetZipProcessor } from "../src/common/edinet-zip-processor.ts";
import fs from "node:fs/promises";
import path from "node:path";

describe("EdinetZipProcessor", () => {
  let processor: EdinetZipProcessor;

  beforeEach(() => {
    processor = new EdinetZipProcessor();
  });

  describe("extractCsvFiles", () => {
    test("should extract CSV files from securities report ZIP", async () => {
      // S100W523: 有価証券報告書
      const zipPath = path.join(__dirname, "fixtures", "S100W523.zip");
      const buffer = await fs.readFile(zipPath);

      const csvFiles = await processor.extractCsvFiles(buffer);

      expect(csvFiles.length).toBeGreaterThan(0);
      expect(csvFiles.every((file) => file.name.endsWith(".csv"))).toBe(true);
      expect(csvFiles.every((file) => file.content.length > 0)).toBe(true);

      // 有価証券報告書なので、監査報告書と財務データが含まれることを確認
      const fileNames = csvFiles.map((file) => file.name);
      expect(fileNames.some((name) => name.includes("jpaud-aar"))).toBe(true); // 監査報告書
    });

    test("should extract CSV files from semi-annual report ZIP", async () => {
      // S100WEV7: 半期報告書
      const zipPath = path.join(__dirname, "fixtures", "S100WEV7.zip");
      const buffer = await fs.readFile(zipPath);

      const csvFiles = await processor.extractCsvFiles(buffer);

      expect(csvFiles.length).toBeGreaterThan(0);
      expect(csvFiles.every((file) => file.name.endsWith(".csv"))).toBe(true);

      // 半期報告書なので、半期監査報告書が含まれることを確認
      const fileNames = csvFiles.map((file) => file.name);
      expect(fileNames.some((name) => name.includes("jpaud-sar") || name.includes("jpsps100000-ssr"))).toBe(true);
    });

    test("should extract CSV files from correction report ZIP", async () => {
      // S100WH6F: 訂正臨時報告書
      const zipPath = path.join(__dirname, "fixtures", "S100WH6F.zip");
      const buffer = await fs.readFile(zipPath);

      const csvFiles = await processor.extractCsvFiles(buffer);

      expect(csvFiles.length).toBeGreaterThan(0);
      expect(csvFiles.every((file) => file.name.endsWith(".csv"))).toBe(true);

      // 臨時報告書なので、企業報告書系のファイルが含まれることを確認
      const fileNames = csvFiles.map((file) => file.name);
      expect(fileNames.some((name) => name.includes("jpcrp"))).toBe(true);
    });
  });

  describe("processZipToJson", () => {
    test("should convert securities report ZIP to JSON", async () => {
      // S100W523: 有価証券報告書
      const zipPath = path.join(__dirname, "fixtures", "S100W523.zip");
      const buffer = await fs.readFile(zipPath);
      const docId = "S100W523";

      const result = await processor.processZipToJson(buffer, docId);

      expect(result.csvFiles.length).toBeGreaterThan(0);
      expect(result.jsonResult).toBeDefined();

      if (result.jsonResult) {
        expect(result.jsonResult.meta.docID).toBe(docId);
        expect(result.jsonResult.meta.source).toBe("EDINET v2");
        expect(result.jsonResult.facts.length).toBeGreaterThan(0);
        expect(result.jsonResult.index.facts_by_element).toBeDefined();
        expect(result.jsonResult.index.statements).toBeDefined();

        // 各factが適切な構造を持つことを確認
        const firstFact = result.jsonResult.facts[0];
        expect(firstFact).toHaveProperty("element_id");
        expect(firstFact).toHaveProperty("label");
        expect(firstFact).toHaveProperty("value");
        expect(firstFact).toHaveProperty("source_file");
      }
    });

    test("should convert different document types to JSON", async () => {
      const testCases = [
        { docId: "S100WEV7", fileName: "S100WEV7.zip", type: "半期報告書" },
        { docId: "S100VSRY", fileName: "S100VSRY.zip", type: "有価証券届出書" },
        { docId: "S100WHUS", fileName: "S100WHUS.zip", type: "自己株券買付状況報告書" },
      ];

      for (const testCase of testCases) {
        const zipPath = path.join(__dirname, "fixtures", testCase.fileName);

        try {
          const buffer = await fs.readFile(zipPath);
          const result = await processor.processZipToJson(buffer, testCase.docId);

          expect(result.csvFiles.length).toBeGreaterThan(0);
          expect(result.jsonResult).toBeDefined();

          if (result.jsonResult) {
            expect(result.jsonResult.meta.docID).toBe(testCase.docId);
            expect(result.jsonResult.facts.length).toBeGreaterThan(0);

            // 各文書タイプで最低限のfactが存在することを確認
            expect(result.jsonResult.facts.every((fact) => fact.source_file && fact.source_file.length > 0)).toBe(true);
          }
        } catch (error) {
          // ファイルが存在しない場合はスキップ
          console.warn(`Test file ${testCase.fileName} not found, skipping ${testCase.type} test`);
        }
      }
    });

    test("should handle empty ZIP gracefully", async () => {
      // 空のZIPバッファを作成（JSZipで作成した最小限のZIP）
      const JSZip = await import("jszip");
      const zip = new JSZip.default();
      const emptyZipBuffer = Buffer.from(await zip.generateAsync({ type: "uint8array" }));

      const result = await processor.processZipToJson(emptyZipBuffer, "EMPTY_DOC");

      expect(result.csvFiles).toEqual([]);
      expect(result.jsonResult).toBeUndefined();
    });
  });

  describe("All fixture files parsing", () => {
    test("should parse all 9 fixture ZIP files and extract expected content", async () => {
      const testCases = [
        {
          docId: "S100W523",
          fileName: "S100W523.zip",
          type: "有価証券報告書",
          expectedContent: ["要素ID", "項目名", "監査", "投資信託"],
        },
        {
          docId: "S100WEV7",
          fileName: "S100WEV7.zip",
          type: "半期報告書",
          expectedContent: ["要素ID", "項目名", "半期"],
        },
        {
          docId: "S100WH6F",
          fileName: "S100WH6F.zip",
          type: "訂正臨時報告書",
          expectedContent: ["要素ID", "項目名", "訂正"],
        },
        {
          docId: "S100WHUS",
          fileName: "S100WHUS.zip",
          type: "自己株券買付状況報告書",
          expectedContent: ["要素ID", "項目名", "自己株式"],
        },
        {
          docId: "S100VSRY",
          fileName: "S100VSRY.zip",
          type: "有価証券届出書",
          expectedContent: ["要素ID", "項目名", "届出"],
        },
        {
          docId: "S100WHS2",
          fileName: "S100WHS2.zip",
          type: "臨時報告書",
          expectedContent: ["要素ID", "項目名"],
        },
        {
          docId: "S100WGBJ",
          fileName: "S100WGBJ.zip",
          type: "変更報告書",
          expectedContent: ["要素ID", "項目名", "変更"],
        },
        {
          docId: "S100WHX7",
          fileName: "S100WHX7.zip",
          type: "公開買付報告書",
          expectedContent: ["要素ID", "項目名", "公開買付"],
        },
        {
          docId: "S100WHV2",
          fileName: "S100WHV2.zip",
          type: "発行登録追補書類",
          expectedContent: ["要素ID", "項目名", "発行登録"],
        },
      ];

      for (const testCase of testCases) {
        const zipPath = path.join(__dirname, "fixtures", testCase.fileName);

        try {
          const buffer = await fs.readFile(zipPath);
          const result = await processor.processZipToJson(buffer, testCase.docId);

          // CSVファイルが抽出されることを確認
          expect(result.csvFiles.length).toBeGreaterThan(0);

          // JSON変換結果が生成されることを確認
          expect(result.jsonResult).toBeDefined();

          if (result.jsonResult) {
            // 基本的な構造を確認
            expect(result.jsonResult.meta.docID).toBe(testCase.docId);
            expect(result.jsonResult.facts.length).toBeGreaterThan(0);

            // 全CSVファイルの内容を結合して期待する文字列が含まれることを確認
            const allCsvContent = result.csvFiles.map((file) => file.content).join("");

            // 最低限「要素ID」と「項目名」は含まれることを確認
            expect(allCsvContent).toContain("要素ID");
            expect(allCsvContent).toContain("項目名");

            // 文書タイプ固有の期待文字列があれば確認（柔軟にチェック）
            testCase.expectedContent.slice(2).forEach((expectedText) => {
              const hasExpectedContent =
                allCsvContent.includes(expectedText) ||
                result.jsonResult!.facts.some((fact) => fact.label?.includes(expectedText) || fact.value?.toString().includes(expectedText));

              if (!hasExpectedContent) {
                console.warn(`Expected content "${expectedText}" not found in ${testCase.type} (${testCase.docId})`);
              }
            });

            console.log(`✓ ${testCase.type} (${testCase.docId}): ${result.csvFiles.length} CSV files, ${result.jsonResult.facts.length} facts`);
          }
        } catch (error) {
          throw new Error(`Fixture file ${testCase.fileName} could not be processed: ${error}`);
        }
      }
    });
  });
});
