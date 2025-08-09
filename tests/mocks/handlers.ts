import { http, HttpResponse } from "msw";
import type { EdinetDocumentListResponse } from "../../src/common/edinet-api-client.ts";

const mockDocumentListResponse: EdinetDocumentListResponse = {
  metadata: {
    title: "EDINET API Document List",
    parameter: {
      date: "2024-01-15",
      type: "2",
    },
    resultset: {
      count: 2,
      processDateTime: "2024-01-15T10:00:00",
    },
    status: "200",
    message: "OK",
  },
  results: [
    {
      seqNumber: 1,
      docID: "S100TEST1",
      edinetCode: "E00001",
      secCode: "1234",
      JCN: "1234567890123",
      filerName: "テスト株式会社",
      fundCode: null,
      ordinanceCode: "010",
      formCode: "030000",
      docTypeCode: "120",
      periodStart: "2023-04-01",
      periodEnd: "2024-03-31",
      submitDateTime: "2024-01-15T09:00:00",
      docDescription: "有価証券報告書",
      issuerEdinetCode: null,
      subjectEdinetCode: null,
      subsidiaryEdinetCode: null,
      currentReportReason: null,
      parentDocID: null,
      opeDateTime: "2024-01-15T09:00:00",
      withdrawalStatus: "0",
      docInfoEditStatus: "0",
      disclosureStatus: "0",
      xbrlFlag: "1",
      pdfFlag: "1",
      attachDocFlag: "0",
      englishDocFlag: "0",
      csvFlag: "1",
      legalStatus: "1",
    },
    {
      seqNumber: 2,
      docID: "S100TEST2",
      edinetCode: "E00002",
      secCode: "5678",
      JCN: "2234567890123",
      filerName: "サンプル株式会社",
      fundCode: null,
      ordinanceCode: "010",
      formCode: "030000",
      docTypeCode: "120",
      periodStart: "2023-04-01",
      periodEnd: "2024-03-31",
      submitDateTime: "2024-01-15T10:00:00",
      docDescription: "有価証券報告書",
      issuerEdinetCode: null,
      subjectEdinetCode: null,
      subsidiaryEdinetCode: null,
      currentReportReason: null,
      parentDocID: null,
      opeDateTime: "2024-01-15T10:00:00",
      withdrawalStatus: "0",
      docInfoEditStatus: "0",
      disclosureStatus: "0",
      xbrlFlag: "1",
      pdfFlag: "1",
      attachDocFlag: "0",
      englishDocFlag: "0",
      csvFlag: "1",
      legalStatus: "1",
    },
  ],
};

export const handlers = [
  // Documents list API
  http.get("https://api.edinet-fsa.go.jp/api/v2/documents.json", ({ request }) => {
    const url = new URL(request.url);
    const date = url.searchParams.get("date");
    const type = url.searchParams.get("type");
    const subscriptionKey = url.searchParams.get("Subscription-Key");

    // Check required parameters
    if (!date || !type || !subscriptionKey) {
      return HttpResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // Simulate API key validation
    if (subscriptionKey === "invalid-key") {
      return HttpResponse.json({ error: "Invalid subscription key" }, { status: 401 });
    }

    // Return mock data with updated date
    const response = {
      ...mockDocumentListResponse,
      metadata: {
        ...mockDocumentListResponse.metadata,
        parameter: { date, type },
      },
    };

    return HttpResponse.json(response);
  }),

  // Document binary data API
  http.get("https://api.edinet-fsa.go.jp/api/v2/documents/:docId", ({ request, params }) => {
    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const subscriptionKey = url.searchParams.get("Subscription-Key");
    const { docId } = params;

    // Check required parameters
    if (!type || !subscriptionKey) {
      return HttpResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // Simulate API key validation
    if (subscriptionKey === "invalid-key") {
      return HttpResponse.json({ error: "Invalid subscription key" }, { status: 401 });
    }

    // Simulate document not found
    if (docId === "NOT_FOUND") {
      return HttpResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Return mock binary data (simple buffer for testing)
    const mockBinaryData = new Uint8Array([0x50, 0x4b, 0x03, 0x04]); // ZIP file header
    return HttpResponse.arrayBuffer(mockBinaryData.buffer, {
      headers: {
        "Content-Type": "application/zip",
      },
    });
  }),
];
