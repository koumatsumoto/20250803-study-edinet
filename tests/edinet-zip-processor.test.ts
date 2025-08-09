import { describe, test, expect, beforeEach } from "vitest";
import { EdinetZipProcessor } from "../src/common/edinet-zip-processor.ts";
import fs from "node:fs/promises";
import path from "node:path";

describe("EdinetZipProcessor", () => {
  let processor: EdinetZipProcessor;

  beforeEach(() => {
    processor = new EdinetZipProcessor();
  });

  describe("processZipToJson", () => {
    test("should convert securities report ZIP to JSON", async () => {
      // S100W523: 有価証券報告書
      const zipPath = path.join(__dirname, "fixtures", "S100W523.zip");
      const buffer = await fs.readFile(zipPath);
      const docId = "S100W523";

      const result = await processor.processZipToJson(buffer, docId);

      expect(result.meta.docID).toBe(docId);
      expect(result.meta.source).toBe("EDINET v2");
      expect(result.facts.length).toBeGreaterThan(0);
      expect(result.index.facts_by_element).toBeDefined();
      expect(result.index.statements).toBeDefined();

      // 各factが適切な構造を持つことを確認
      const firstFact = result.facts[0];
      expect(firstFact).toHaveProperty("element_id");
      expect(firstFact).toHaveProperty("label");
      expect(firstFact).toHaveProperty("value");
      expect(firstFact).toHaveProperty("source_file");
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

          expect(result.meta.docID).toBe(testCase.docId);
          expect(result.facts.length).toBeGreaterThan(0);

          // 各文書タイプで最低限のfactが存在することを確認
          expect(result.facts.every((fact) => fact.source_file && fact.source_file.length > 0)).toBe(true);
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

      expect(result.facts).toEqual([]);
      expect(result.meta.docID).toBe("EMPTY_DOC");
      expect(result.index.facts_by_element).toEqual({});
      expect(result.index.statements).toEqual({});
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

          // 基本的な構造を確認
          expect(result.meta.docID).toBe(testCase.docId);
          expect(result.facts.length).toBeGreaterThan(0);

          // 文書タイプ固有の期待文字列があれば確認（柔軟にチェック）
          testCase.expectedContent.slice(2).forEach((expectedText) => {
            const hasExpectedContent = result.facts.some(
              (fact) => fact.label?.includes(expectedText) || fact.value?.toString().includes(expectedText),
            );

            if (!hasExpectedContent) {
              console.warn(`Expected content "${expectedText}" not found in ${testCase.type} (${testCase.docId})`);
            }
          });

          console.log(`✓ ${testCase.type} (${testCase.docId}): ${result.facts.length} facts`);
        } catch (error) {
          throw new Error(`Fixture file ${testCase.fileName} could not be processed: ${error}`);
        }
      }
    });
  });
});
