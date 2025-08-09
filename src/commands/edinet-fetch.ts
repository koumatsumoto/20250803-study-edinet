import { EdinetApiClient } from "../common/edinet-api-client.ts";
import { EdinetZipProcessor } from "../common/edinet-zip-processor.ts";
import fs from "node:fs/promises";
import path from "node:path";

const DOCUMENT_TYPE_CSV = "5";

export async function edinetFetchCommand(values: { docId?: string; output?: string; json?: boolean }) {
  if (!values.docId) {
    console.error("Error: Document ID is required. Use --docId or -d option.");
    process.exit(1);
  }

  const client = new EdinetApiClient();
  const zipProcessor = new EdinetZipProcessor();

  try {
    console.log(`Fetching document: ${values.docId}, type: ${DOCUMENT_TYPE_CSV}`);

    const arrayBuffer = await client.fetchDocument(values.docId, DOCUMENT_TYPE_CSV);
    const buffer = Buffer.from(arrayBuffer);

    console.log("Extracting ZIP contents...");

    // Process ZIP file based on JSON option
    const result = values.json
      ? await zipProcessor.processZipToJson(buffer, values.docId)
      : { csvFiles: await zipProcessor.extractCsvFiles(buffer), jsonResult: undefined };

    const { csvFiles: allCsvFiles, jsonResult } = result;

    if (allCsvFiles.length === 0) {
      console.log("No CSV files found in the ZIP archive");
      return;
    }

    // Log found CSV files
    allCsvFiles.forEach((csvFile) => {
      console.log(`Found CSV file: ${csvFile.name}`);
    });

    // Save all CSV files to tmp/ directory
    const tmpDir = "tmp";
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
    if (values.json && jsonResult) {
      console.log("\nJSON conversion completed.");
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
