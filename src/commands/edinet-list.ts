import { EdinetApiClient } from "../common/edinet-api-client.ts";
import { validateDateCommand } from "../common/command-validation.ts";

export async function edinetListCommand(values: { date?: string }) {
  // 日付引数の検証
  const validatedDate = validateDateCommand(values.date);
  const client = new EdinetApiClient();

  try {
    console.log(`Fetching documents for date: ${validatedDate}`);

    const result = await client.fetchDocumentsList(validatedDate);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error fetching documents:", error);
  }
}
