import { EdinetApiClient } from "../common/edinet-api-client.ts";

export async function edinetListCommand(values: { date?: string }) {
  if (!values.date) {
    console.error("Error: Date is required. Use --date or -d option with YYYY-MM-DD format.");
    process.exit(1);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date)) {
    console.error("Error: Date must be in YYYY-MM-DD format.");
    process.exit(1);
  }

  const client = new EdinetApiClient();

  try {
    console.log(`Fetching documents for date: ${values.date}`);

    const result = await client.fetchDocumentsList(values.date);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error fetching documents:", error);
  }
}
