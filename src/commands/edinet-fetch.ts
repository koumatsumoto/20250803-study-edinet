import { EdinetApiClient } from "../common/edinet-api-client.ts";
import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import iconv from "iconv-lite";

export async function edinetFetchCommand(values: { docId?: string; type?: string; output?: string }) {
  if (!values.docId) {
    console.error("Error: Document ID is required. Use --docId or -d option.");
    process.exit(1);
  }

  if (!values.type) {
    console.error("Error: Document type is required. Use --type or -t option.");
    console.error("Valid types: 1=提出本文書及び監査報告書, 2=PDF, 3=代替書面・添付文書, 4=英文ファイル, 5=CSV");
    process.exit(1);
  }

  if (!["1", "2", "3", "4", "5"].includes(values.type)) {
    console.error("Error: Type must be one of: 1, 2, 3, 4, 5");
    console.error("1=提出本文書及び監査報告書, 2=PDF, 3=代替書面・添付文書, 4=英文ファイル, 5=CSV");
    process.exit(1);
  }

  const client = new EdinetApiClient();

  try {
    console.log(`Fetching document: ${values.docId}, type: ${values.type}`);

    const arrayBuffer = await client.fetchDocument(values.docId, values.type);
    const buffer = Buffer.from(arrayBuffer);

    // For PDF files, save directly
    if (values.type === "2") {
      const outputPath = values.output || `${values.docId}_type${values.type}.pdf`;
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(outputPath, buffer);
      console.log(`PDF document saved to: ${outputPath}`);
      console.log(`File size: ${buffer.length} bytes`);
      return;
    }

    // For ZIP files, extract CSV files
    const tmpDir = "tmp";
    console.log("Extracting ZIP contents...");
    const zip = await JSZip.loadAsync(buffer);

    // Find all CSV files in the ZIP
    const csvFiles: Array<{ name: string; content: string }> = [];

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

        csvFiles.push({ name: filename, content });
      }
    }

    if (csvFiles.length === 0) {
      console.log("No CSV files found in the ZIP archive");
      return;
    }

    // Save each CSV file in tmp/ directory
    const csvOutputDir = path.join(tmpDir, `${values.docId}_type${values.type}_csv`);
    await fs.mkdir(csvOutputDir, { recursive: true });

    for (const csvFile of csvFiles) {
      const outputPath = path.join(csvOutputDir, path.basename(csvFile.name));
      await fs.writeFile(outputPath, csvFile.content, "utf8");
      console.log(`CSV file saved to: ${outputPath}`);
      console.log(`File size: ${csvFile.content.length} characters`);
    }

    console.log(`\nExtracted ${csvFiles.length} CSV file(s) to: ${csvOutputDir}`);
  } catch (error) {
    console.error("Error fetching document:", error);
  }
}
