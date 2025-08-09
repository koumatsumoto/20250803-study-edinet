import { EdinetApiClient } from "../common/edinet-api-client.ts";
import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import iconv from "iconv-lite";

const DOCUMENT_TYPE_CSV = "5";

export async function edinetFetchCommand(values: { docId?: string; output?: string }) {
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

    // Filter out audit-related files (jpaud-) to get main CSV file
    const mainCsvFiles = allCsvFiles.filter((file) => !path.basename(file.name).startsWith("jpaud-"));

    let targetCsvFile: { name: string; content: string };
    if (mainCsvFiles.length === 1) {
      targetCsvFile = mainCsvFiles[0]!;
      console.log(`Selected main CSV file: ${targetCsvFile.name}`);
    } else if (mainCsvFiles.length > 1) {
      console.log(`Multiple main CSV files found (${mainCsvFiles.length} files):`);
      mainCsvFiles.forEach((file) => {
        console.log(`  - ${file.name} (${file.content.length} chars)`);
      });

      // Save all main CSV files for investigation
      const csvOutputDir = path.join(tmpDir, `${values.docId}_type${DOCUMENT_TYPE_CSV}_csv`);
      await fs.mkdir(csvOutputDir, { recursive: true });

      for (const csvFile of mainCsvFiles) {
        const outputPath = path.join(csvOutputDir, path.basename(csvFile.name));
        await fs.writeFile(outputPath, csvFile.content, "utf8");
        console.log(`Saved CSV file: ${outputPath}`);
      }

      console.log(`All ${mainCsvFiles.length} main CSV files saved to: ${csvOutputDir}`);
      return;
    } else {
      // Fallback to largest file if no non-audit files found
      targetCsvFile = allCsvFiles.reduce((largest, current) => (current.content.length > largest.content.length ? current : largest));
      console.log(`No main CSV files found, selected largest: ${targetCsvFile.name} (${targetCsvFile.content.length} chars)`);
    }

    // Save the main CSV file to tmp/ directory
    const csvOutputDir = path.join(tmpDir, `${values.docId}_type${DOCUMENT_TYPE_CSV}_csv`);
    await fs.mkdir(csvOutputDir, { recursive: true });

    const outputPath = path.join(csvOutputDir, path.basename(targetCsvFile.name));
    await fs.writeFile(outputPath, targetCsvFile.content, "utf8");
    console.log(`Main CSV file saved to: ${outputPath}`);
    console.log(`File size: ${targetCsvFile.content.length} characters`);

    console.log(`\nFound ${allCsvFiles.length} CSV file(s), extracted main CSV to: ${csvOutputDir}`);
  } catch (error) {
    console.error("Error fetching document:", error);
  }
}
