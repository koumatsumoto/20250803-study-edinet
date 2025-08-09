import { z } from "zod";

const EdinetDocumentSchema = z.object({
  seqNumber: z.number(),
  docID: z.string(),
  edinetCode: z.string().nullable(),
  secCode: z.string().nullable(),
  JCN: z.string().nullable(),
  filerName: z.string().nullable(),
  fundCode: z.string().nullable(),
  ordinanceCode: z.string().nullable(),
  formCode: z.string().nullable(),
  docTypeCode: z.string().nullable(),
  periodStart: z.string().nullable(),
  periodEnd: z.string().nullable(),
  submitDateTime: z.string().nullable(),
  docDescription: z.string().nullable(),
  issuerEdinetCode: z.string().nullable(),
  subjectEdinetCode: z.string().nullable(),
  subsidiaryEdinetCode: z.string().nullable(),
  currentReportReason: z.string().nullable(),
  parentDocID: z.string().nullable(),
  opeDateTime: z.string().nullable(),
  withdrawalStatus: z.string(),
  docInfoEditStatus: z.string(),
  disclosureStatus: z.string(),
  xbrlFlag: z.string(),
  pdfFlag: z.string(),
  attachDocFlag: z.string(),
  englishDocFlag: z.string(),
  csvFlag: z.string(),
  legalStatus: z.string(),
});

const EdinetMetadataSchema = z.object({
  title: z.string(),
  parameter: z.object({
    date: z.string(),
    type: z.string(),
  }),
  resultset: z.object({
    count: z.number(),
    processDateTime: z.string().optional(),
  }),
  status: z.string(),
  message: z.string(),
});

const EdinetDocumentListResponseSchema = z.object({
  metadata: EdinetMetadataSchema,
  results: z.array(EdinetDocumentSchema).optional(),
});

export type EdinetDocument = z.infer<typeof EdinetDocumentSchema>;
export type EdinetMetadata = z.infer<typeof EdinetMetadataSchema>;
export type EdinetDocumentListResponse = z.infer<typeof EdinetDocumentListResponseSchema>;

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

    const rawData = await response.json();

    try {
      const validatedData = EdinetDocumentListResponseSchema.parse(rawData);
      return validatedData;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`API response validation failed: ${error.message}`);
      }
      throw error;
    }
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
      const errorData = await response.json();

      // Validate error response structure
      const errorSchema = z.object({
        metadata: z
          .object({
            title: z.string().optional(),
            message: z.string(),
            status: z.string().optional(),
          })
          .optional(),
      });

      try {
        const validatedError = errorSchema.parse(errorData);
        throw new Error(`API Error: ${validatedError.metadata?.message || "Unknown error"}`);
      } catch (validationError) {
        throw new Error(`API Error with invalid response structure: ${JSON.stringify(errorData)}`);
      }
    }

    return response.arrayBuffer();
  }
}
