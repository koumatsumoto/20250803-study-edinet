import { describe, test, expect, beforeEach } from "vitest";
import { EdinetApiClient } from "../src/common/edinet-api-client.ts";

describe("EdinetApiClient", () => {
  let client: EdinetApiClient;

  beforeEach(() => {
    client = new EdinetApiClient({
      baseUrl: "https://api.edinet-fsa.go.jp/api/v2",
      subscriptionKey: "test-key",
    });
  });

  describe("fetchDocumentsList", () => {
    test("should fetch documents list successfully", async () => {
      const result = await client.fetchDocumentsList("2024-01-15");

      expect(result.metadata.status).toBe("200");
      expect(result.metadata.message).toBe("OK");
      expect(result.metadata.parameter.date).toBe("2024-01-15");
      expect(result.metadata.parameter.type).toBe("2");
      expect(result.results).toBeDefined();
      expect(result.results).toHaveLength(2);

      const firstDoc = result.results![0];
      expect(firstDoc.docID).toBe("S100TEST1");
      expect(firstDoc.edinetCode).toBe("E00001");
      expect(firstDoc.filerName).toBe("テスト株式会社");
    });

    test("should handle API key validation error", async () => {
      const invalidClient = new EdinetApiClient({
        baseUrl: "https://api.edinet-fsa.go.jp/api/v2",
        subscriptionKey: "invalid-key",
      });

      await expect(invalidClient.fetchDocumentsList("2024-01-15")).rejects.toThrow("Error fetching documents: Unauthorized");
    });

    test("should handle missing subscription key", async () => {
      const noKeyClient = new EdinetApiClient({
        baseUrl: "https://api.edinet-fsa.go.jp/api/v2",
        subscriptionKey: "",
      });

      await expect(noKeyClient.fetchDocumentsList("2024-01-15")).rejects.toThrow("Error fetching documents: Bad Request");
    });
  });

  describe("fetchDocument", () => {
    test("should fetch document binary data successfully", async () => {
      const result = await client.fetchDocument("S100TEST1", "5");

      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(result.byteLength).toBeGreaterThan(0);

      // Check ZIP file header
      const view = new Uint8Array(result);
      expect(view[0]).toBe(0x50); // 'P'
      expect(view[1]).toBe(0x4b); // 'K'
      expect(view[2]).toBe(0x03);
      expect(view[3]).toBe(0x04);
    });

    test("should handle document not found error", async () => {
      await expect(client.fetchDocument("NOT_FOUND", "5")).rejects.toThrow("Error fetching document: Not Found");
    });

    test("should handle API key validation error", async () => {
      const invalidClient = new EdinetApiClient({
        baseUrl: "https://api.edinet-fsa.go.jp/api/v2",
        subscriptionKey: "invalid-key",
      });

      await expect(invalidClient.fetchDocument("S100TEST1", "5")).rejects.toThrow("Error fetching document: Unauthorized");
    });

    test("should handle missing subscription key", async () => {
      const noKeyClient = new EdinetApiClient({
        baseUrl: "https://api.edinet-fsa.go.jp/api/v2",
        subscriptionKey: "",
      });

      await expect(noKeyClient.fetchDocument("S100TEST1", "5")).rejects.toThrow("Error fetching document: Bad Request");
    });
  });

  describe("constructor", () => {
    test("should use default values when no config provided", () => {
      const defaultClient = new EdinetApiClient();

      expect(defaultClient["baseUrl"]).toBe("https://api.edinet-fsa.go.jp/api/v2");
      expect(defaultClient["subscriptionKey"]).toBe("");
    });

    test("should use environment variable for subscription key", () => {
      process.env.EDINET_API_KEY = "env-test-key";

      const envClient = new EdinetApiClient();

      expect(envClient["subscriptionKey"]).toBe("env-test-key");

      delete process.env.EDINET_API_KEY;
    });

    test("should override environment variable with explicit config", () => {
      process.env.EDINET_API_KEY = "env-test-key";

      const configClient = new EdinetApiClient({
        subscriptionKey: "explicit-key",
      });

      expect(configClient["subscriptionKey"]).toBe("explicit-key");

      delete process.env.EDINET_API_KEY;
    });
  });
});
