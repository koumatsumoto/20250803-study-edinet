interface EdinetDocument {
  seqNumber: number;
  docID: string;
  edinetCode: string;
  secCode: string | null;
  JCN: string;
  filerName: string;
  fundCode: string | null;
  ordinanceCode: string;
  formCode: string;
  docTypeCode: string;
  periodStart: string | null;
  periodEnd: string | null;
  submitDateTime: string;
  docDescription: string;
  issuerEdinetCode: string | null;
  subjectEdinetCode: string | null;
  subsidiaryEdinetCode: string | null;
  currentReportReason: string | null;
  parentDocID: string | null;
  opeDateTime: string | null;
  withdrawalStatus: string;
  docInfoEditStatus: string;
  disclosureStatus: string;
  xbrlFlag: string;
  pdfFlag: string;
  attachDocFlag: string;
  englishDocFlag: string;
  csvFlag: string;
  legalStatus: string;
}

interface EdinetMetadata {
  title: string;
  parameter: {
    date: string;
    type: string;
  };
  resultset: {
    count: number;
    processDateTime?: string;
  };
  status: string;
  message: string;
}

interface EdinetDocumentListResponse {
  metadata: EdinetMetadata;
  results?: EdinetDocument[];
}

export class EdinetApiClient {
  private baseUrl: string;
  private subscriptionKey: string;

  constructor(config: { baseUrl?: string; subscriptionKey?: string } = {}) {
    this.baseUrl = config.baseUrl ?? "https://api.edinet-fsa.go.jp/api/v2";
    this.subscriptionKey = config.subscriptionKey ?? process.env["EDINET_API_KEY"] ?? "";
  }

  // Note: This method always uses type=2 to get both metadata and document list.
  // If type=1 is used, only metadata is returned without results field.
  async fetchDocumentsList(date: string): Promise<EdinetDocumentListResponse> {
    const params = new URLSearchParams({
      date,
      type: "2",
      "Subscription-Key": this.subscriptionKey,
    });

    const url = `${this.baseUrl}/documents.json?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Error fetching documents: ${response.statusText}`);
    }

    return response.json() as Promise<EdinetDocumentListResponse>;
  }

  // Fetch document binary data (ZIP, PDF, etc.)
  // type: 1=提出本文書及び監査報告書, 2=PDF, 3=代替書面・添付文書, 4=英文ファイル, 5=CSV
  async fetchDocument(docId: string, type: string): Promise<ArrayBuffer> {
    const params = new URLSearchParams({
      type,
      "Subscription-Key": this.subscriptionKey,
    });

    const url = `${this.baseUrl}/documents/${docId}?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Error fetching document: ${response.statusText}`);
    }

    // Check Content-Type to ensure we got binary data, not JSON error
    const contentType = response.headers.get("Content-Type");
    if (contentType?.includes("application/json")) {
      const errorData = (await response.json()) as any;
      throw new Error(`API Error: ${errorData.metadata?.message || "Unknown error"}`);
    }

    return response.arrayBuffer();
  }
}
