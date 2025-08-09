import { EdinetApiClient } from "../common/edinet-api-client.ts";
import { EdinetZipProcessor } from "../common/edinet-zip-processor.ts";
import fs from "node:fs/promises";
import path from "node:path";

const DOCUMENT_TYPE_CSV = "5";

export async function edinetFetchCommand(values: { docId?: string; output?: string }) {
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

    // Process ZIP file to JSON
    const jsonResult = await zipProcessor.processZipToJson(buffer, values.docId);

    if (jsonResult.facts.length === 0) {
      console.log("No facts found in the ZIP archive");
      return;
    }

    // Save JSON result to tmp/ directory
    const tmpDir = "tmp";
    const outputDir = path.join(tmpDir, `${values.docId}_type${DOCUMENT_TYPE_CSV}_json`);
    await fs.mkdir(outputDir, { recursive: true });

    const jsonOutputPath = path.join(outputDir, `${values.docId}_facts.json`);
    await fs.writeFile(jsonOutputPath, JSON.stringify(jsonResult, null, 2), "utf8");

    console.log("JSON conversion completed.");
    console.log(`JSON output saved to: ${jsonOutputPath}`);
    console.log(`Total facts: ${jsonResult.facts.length}`);
    console.log(`Indexed elements: ${Object.keys(jsonResult.index.facts_by_element).length}`);
  } catch (error) {
    console.error("Error fetching document:", error);
  }
}
