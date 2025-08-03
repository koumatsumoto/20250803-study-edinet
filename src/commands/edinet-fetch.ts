import { EdinetApiClient } from "../common/edinet-api-client.ts";
import fs from "node:fs/promises";
import path from "node:path";

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

    // Determine file extension based on type
    const getFileExtension = (type: string) => {
      switch (type) {
        case "2":
          return ".pdf";
        default:
          return ".zip";
      }
    };

    const outputPath = values.output || `${values.docId}_type${values.type}${getFileExtension(values.type)}`;

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    // Write binary data to file
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(outputPath, buffer);

    console.log(`Document saved to: ${outputPath}`);
    console.log(`File size: ${buffer.length} bytes`);
  } catch (error) {
    console.error("Error fetching document:", error);
  }
}
