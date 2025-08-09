import { EdinetApiClient } from "../common/edinet-api-client.ts";
import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import iconv from "iconv-lite";

interface TestResult {
  docId: string;
  success: boolean;
  error?: string;
  totalCsvFiles: number;
  largestCsvFile?: string;
  largestCsvSize?: number;
}

export async function edinetTestBatchCommand() {
  const client = new EdinetApiClient();
  const testResults: TestResult[] = [];

  console.log("Starting batch test of 100 documents...");

  try {
    // Get document list for 2025-07-31
    console.log("Fetching document list for 2025-07-31...");
    const response = await client.fetchDocumentsList("2025-07-31");

    if (!response.results || response.results.length === 0) {
      console.error("No documents found for 2025-07-31");
      return;
    }

    // Take first 100 documents that have CSV flag
    const documentsWithCsv = response.results.filter((doc) => doc.csvFlag === "1").slice(0, 100);

    if (documentsWithCsv.length < 100) {
      console.warn(`Only found ${documentsWithCsv.length} documents with CSV flag`);
    }

    console.log(`Testing ${documentsWithCsv.length} documents...\n`);

    // Test each document
    for (let i = 0; i < documentsWithCsv.length; i++) {
      const doc = documentsWithCsv[i]!;
      const progress = `[${i + 1}/${documentsWithCsv.length}]`;

      console.log(`${progress} Testing ${doc.docID} - ${doc.filerName}...`);

      const result: TestResult = {
        docId: doc.docID,
        success: false,
        totalCsvFiles: 0,
      };

      try {
        // Fetch document
        const arrayBuffer = await client.fetchDocument(doc.docID, "5");
        const buffer = Buffer.from(arrayBuffer);

        // Extract CSV files
        const zip = await JSZip.loadAsync(buffer);
        const allCsvFiles: Array<{ name: string; content: string }> = [];

        for (const [filename, file] of Object.entries(zip.files)) {
          if (!file.dir && filename.toLowerCase().endsWith(".csv")) {
            const binaryData = await file.async("uint8array");

            let content: string;
            try {
              const buffer = Buffer.from(binaryData);
              content = iconv.decode(buffer, "utf16le");
            } catch (error) {
              try {
                const buffer = Buffer.from(binaryData);
                content = iconv.decode(buffer, "shift_jis");
              } catch (sjisError) {
                content = await file.async("text");
              }
            }

            allCsvFiles.push({ name: filename, content });
          }
        }

        result.totalCsvFiles = allCsvFiles.length;

        if (allCsvFiles.length === 0) {
          result.error = "No CSV files found in ZIP";
        } else {
          // Find the largest CSV file for reference
          const largestCsvFile = allCsvFiles.reduce((largest, current) => (current.content.length > largest.content.length ? current : largest));

          result.largestCsvFile = path.basename(largestCsvFile.name);
          result.largestCsvSize = largestCsvFile.content.length;
          result.success = true;
        }

        console.log(`${progress} ✓ Success - ${result.totalCsvFiles} CSVs, largest: ${result.largestCsvFile} (${result.largestCsvSize} chars)`);
      } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
        console.log(`${progress} ✗ Error - ${result.error}`);
      }

      testResults.push(result);

      // Add delay to avoid API rate limiting
      if (i < documentsWithCsv.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Print summary
    console.log("\n" + "=".repeat(80));
    console.log("BATCH TEST SUMMARY");
    console.log("=".repeat(80));

    const successful = testResults.filter((r) => r.success).length;
    const failed = testResults.filter((r) => !r.success).length;

    console.log(`Total tested: ${testResults.length}`);
    console.log(`Successful: ${successful} (${((successful / testResults.length) * 100).toFixed(1)}%)`);
    console.log(`Failed: ${failed} (${((failed / testResults.length) * 100).toFixed(1)}%)`);

    // CSV statistics
    const csvStats = testResults.filter((r) => r.success);
    if (csvStats.length > 0) {
      const totalCsvCounts = csvStats.map((r) => r.totalCsvFiles);
      const largestCsvSizes = csvStats.map((r) => r.largestCsvSize || 0);

      console.log(`\nCSV File Statistics:`);
      console.log(`- Average total CSV files per document: ${(totalCsvCounts.reduce((a, b) => a + b, 0) / totalCsvCounts.length).toFixed(1)}`);
      console.log(`- Average largest CSV file size: ${(largestCsvSizes.reduce((a, b) => a + b, 0) / largestCsvSizes.length).toFixed(0)} chars`);
      console.log(`- Documents with multiple CSV files: ${csvStats.filter((r) => r.totalCsvFiles > 1).length}`);
      console.log(`- Documents with single CSV file: ${csvStats.filter((r) => r.totalCsvFiles === 1).length}`);
    }

    // Error breakdown
    if (failed > 0) {
      console.log(`\nError Breakdown:`);
      const errorGroups = testResults
        .filter((r) => !r.success)
        .reduce(
          (groups, result) => {
            const errorType = result.error?.includes("Access denied")
              ? "Access denied"
              : result.error?.includes("timeout")
                ? "Timeout"
                : result.error?.includes("No CSV files")
                  ? "No CSV files"
                  : "Other";
            groups[errorType] = (groups[errorType] || 0) + 1;
            return groups;
          },
          {} as Record<string, number>,
        );

      Object.entries(errorGroups).forEach(([error, count]) => {
        console.log(`- ${error}: ${count}`);
      });
    }

    // Save detailed results to file
    const resultsFile = path.join("tmp", `batch-test-results-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`);
    await fs.mkdir("tmp", { recursive: true });
    await fs.writeFile(resultsFile, JSON.stringify(testResults, null, 2));
    console.log(`\nDetailed results saved to: ${resultsFile}`);
  } catch (error) {
    console.error("Batch test failed:", error);
  }
}
