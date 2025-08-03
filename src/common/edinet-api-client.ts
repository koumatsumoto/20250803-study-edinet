export class EdinetApiClient {
  private baseUrl: string;
  private subscriptionKey: string;

  constructor(config: { baseUrl?: string; subscriptionKey?: string } = {}) {
    this.baseUrl = config.baseUrl ?? "https://api.edinet-fsa.go.jp/api/v2";
    this.subscriptionKey = config.subscriptionKey ?? process.env["EDINET_API_KEY"] ?? "";
  }

  async fetchDocumentsList(date: string, type?: string): Promise<any> {
    const params = new URLSearchParams({
      date,
      "Subscription-Key": this.subscriptionKey,
    });

    if (type !== undefined) {
      params.append("type", type);
    }

    const url = `${this.baseUrl}/documents.json?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Error fetching documents: ${response.statusText}`);
    }

    return response.json();
  }
}
