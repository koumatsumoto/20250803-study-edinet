import { EdinetApiClient } from "../common/edinet-api-client.ts";
import { convertCsvFilesToJson } from "../common/csv-to-json-converter.ts";
import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import iconv from "iconv-lite";

const DOCUMENT_TYPE_CSV = "5";

export async function edinetFetchCommand(values: { docId?: string; output?: string; json?: boolean }) {
  if (!values.docId) {
    console.error("Error: Document ID is required. Use --docId or -d option.");
    process.exit(1);
  }

  const client = new EdinetApiClient();

  try {
    console.log(`Fetching document: ${values.docId}, type: ${DOCUMENT_TYPE_CSV}`);

    const arrayBuffer = await client.fetchDocument(values.docId, DOCUMENT_TYPE_CSV);
    const buffer = Buffer.from(arrayBuffer);

    // Extract CSV files from ZIP
    const tmpDir = "tmp";
    console.log("Extracting ZIP contents...");
    const zip = await JSZip.loadAsync(buffer);

    // Find all CSV files in the ZIP
    const allCsvFiles: Array<{ name: string; content: string }> = [];

    for (const [filename, file] of Object.entries(zip.files)) {
      if (!file.dir && filename.toLowerCase().endsWith(".csv")) {
        console.log(`Found CSV file: ${filename}`);
        // Read as binary data first
        const binaryData = await file.async("uint8array");

        // EDINET CSV files are encoded in UTF-16 LE
        let content: string;

        try {
          // Decode from UTF-16 LE to UTF-8
          const buffer = Buffer.from(binaryData);
          content = iconv.decode(buffer, "utf16le");
          console.log(`Successfully decoded ${filename} from UTF-16 LE`);
        } catch (error) {
          // Fallback to Shift_JIS
          try {
            console.warn(`UTF-16 LE failed for ${filename}, trying Shift_JIS`);
            const buffer = Buffer.from(binaryData);
            content = iconv.decode(buffer, "shift_jis");
          } catch (sjisError) {
            // Last resort: UTF-8
            console.warn(`All iconv methods failed for ${filename}, trying UTF-8`);
            content = await file.async("text");
          }
        }

        allCsvFiles.push({ name: filename, content });
      }
    }

    if (allCsvFiles.length === 0) {
      console.log("No CSV files found in the ZIP archive");
      return;
    }

    // Save all CSV files to tmp/ directory
    const csvOutputDir = path.join(tmpDir, `${values.docId}_type${DOCUMENT_TYPE_CSV}_csv`);
    await fs.mkdir(csvOutputDir, { recursive: true });

    console.log(`Saving all ${allCsvFiles.length} CSV files:`);
    for (const csvFile of allCsvFiles) {
      const outputPath = path.join(csvOutputDir, path.basename(csvFile.name));
      await fs.writeFile(outputPath, csvFile.content, "utf8");
      console.log(`  - ${csvFile.name} (${csvFile.content.length} chars) -> ${outputPath}`);
    }

    console.log(`\nAll ${allCsvFiles.length} CSV file(s) saved to: ${csvOutputDir}`);

    // JSON出力オプションが指定されている場合
    if (values.json) {
      console.log("\nConverting CSV files to JSON...");
      const jsonResult = convertCsvFilesToJson(allCsvFiles, values.docId);

      const jsonOutputPath = path.join(csvOutputDir, `${values.docId}_facts.json`);
      await fs.writeFile(jsonOutputPath, JSON.stringify(jsonResult, null, 2), "utf8");

      console.log(`JSON output saved to: ${jsonOutputPath}`);
      console.log(`Total facts: ${jsonResult.facts.length}`);
      console.log(`Indexed elements: ${Object.keys(jsonResult.index.facts_by_element).length}`);
    }
  } catch (error) {
    console.error("Error fetching document:", error);
  }
}
