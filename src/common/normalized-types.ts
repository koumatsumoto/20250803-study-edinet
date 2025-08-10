import { z } from "zod";

// 基本型定義
export type PeriodType = "duration" | "instant" | "unknown";
export type ConsolidatedType = "Consolidated" | "NonConsolidated" | "Other" | "Unknown";
export type UnitType = "JPY" | "shares" | "percent" | "count" | "other";

// 1. Documents（文書メタデータ）
export type DocumentRecord = {
  document_id: string; // PK: EDINETのdocID
  edinet_code: string | null; // 提出者コード
  filer_name: string | null; // 提出者名
  doc_type: string | null; // 書類種別（有報/四半期等）
  form_code: string | null; // 様式コード
  period_start: string | null; // 対象期間開始
  period_end: string | null; // 対象期間終了
  filed_at_jst: string | null; // 提出日時（JST）
  has_csv: boolean; // CSV有無フラグ
  processed_at: string; // 処理日時
  source: "EDINET v2"; // データソース識別
};

// 2. Contexts（財務データのコンテキスト）
export type ContextRecord = {
  document_id: string; // FK: documentsへの参照
  context_id: string; // コンテキストID
  period_type: PeriodType; // "duration" | "instant" | "unknown"
  period_label: string; // 期間表示ラベル（当期/前期等）
  consolidated_flag: ConsolidatedType; // 連結区分
  relative_year: number | null; // 相対年度（0=当年、-1=前年）
  hashkey: string; // パフォーマンス用ハッシュ
};

// 3. Facts（財務データ実体）
export type FactRecord = {
  document_id: string; // FK: documentsへの参照
  fact_id: string; // PK: UUID
  context_id: string; // FK: contextsへの参照
  concept: string; // 要素ID（NetSales等）
  account_label: string; // 項目名（日本語ラベル）
  value_num: number | null; // 数値データ
  value_str: string | null; // 文字列データ
  unit: UnitType | null; // 正規化単位
  is_numeric: boolean; // 数値判定フラグ

  // 検索性向上のための冗長保持
  consolidated_flag: ConsolidatedType;
  period_type: PeriodType;
  period_label: string;
};

// 正規化結果の内部データ構造
export type NormalizedResult = {
  documents: DocumentRecord[];
  contexts: ContextRecord[];
  facts: FactRecord[];
  summary: ProcessingSummary;
};

// 処理サマリ
export type ProcessingSummary = {
  document_count: number;
  total_facts: number;
  total_contexts: number;
  contexts_deduplicated: number; // 重複排除されたcontexts数
  numeric_facts: number; // 数値として変換できたfacts数
  processing_time_ms: number;
};

// バッチ処理用拡張DocumentRecord
export type BatchDocumentRecord = DocumentRecord & {
  seq_number: number; // seqNumber (処理順序)
  doc_description: string | null; // docDescription
  batch_date: string; // バッチ対象日付
};

// バッチ処理結果
export type BatchProcessingResult = {
  batch_date: string;
  total_documents: number;
  target_documents: number;
  processed_documents: number;
  failed_documents: number;
  processing_time_ms: number;
  documents: BatchDocumentRecord[];
  errors: BatchProcessingError[];
};

export type BatchProcessingError = {
  doc_id: string;
  filer_name: string | null;
  error_type: "FETCH_ERROR" | "PROCESSING_ERROR" | "SAVE_ERROR";
  error_message: string;
  timestamp: string;
};

// 最終的なJSON出力フォーマット
export type NormalizedJson = {
  meta: {
    processed_at: string;
    document_count: number;
    total_facts: number;
    total_contexts: number;
    source_format: "EdinetJSON v1.0"; // 変換元を明記
  };
  documents: DocumentRecord[];
  contexts: ContextRecord[];
  facts: FactRecord[];
};

// Zodバリデーションスキーマ
export const PeriodTypeSchema = z.enum(["duration", "instant", "unknown"]);
export const ConsolidatedTypeSchema = z.enum(["Consolidated", "NonConsolidated", "Other", "Unknown"]);
export const UnitTypeSchema = z.enum(["JPY", "shares", "percent", "count", "other"]);

export const DocumentRecordSchema = z.object({
  document_id: z.string(),
  edinet_code: z.string().nullable(),
  filer_name: z.string().nullable(),
  doc_type: z.string().nullable(),
  form_code: z.string().nullable(),
  period_start: z.string().nullable(),
  period_end: z.string().nullable(),
  filed_at_jst: z.string().nullable(),
  has_csv: z.boolean(),
  processed_at: z.string(),
  source: z.literal("EDINET v2"),
});

export const ContextRecordSchema = z.object({
  document_id: z.string(),
  context_id: z.string(),
  period_type: PeriodTypeSchema,
  period_label: z.string(),
  consolidated_flag: ConsolidatedTypeSchema,
  relative_year: z.number().nullable(),
  hashkey: z.string(),
});

export const FactRecordSchema = z.object({
  document_id: z.string(),
  fact_id: z.string(),
  context_id: z.string(),
  concept: z.string(),
  account_label: z.string(),
  value_num: z.number().nullable(),
  value_str: z.string().nullable(),
  unit: UnitTypeSchema.nullable(),
  is_numeric: z.boolean(),
  consolidated_flag: ConsolidatedTypeSchema,
  period_type: PeriodTypeSchema,
  period_label: z.string(),
});

export const NormalizedJsonSchema = z.object({
  meta: z.object({
    processed_at: z.string(),
    document_count: z.number(),
    total_facts: z.number(),
    total_contexts: z.number(),
    source_format: z.literal("EdinetJSON v1.0"),
  }),
  documents: z.array(DocumentRecordSchema),
  contexts: z.array(ContextRecordSchema),
  facts: z.array(FactRecordSchema),
});
