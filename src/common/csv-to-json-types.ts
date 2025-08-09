export type DocumentMeta = {
  docID: string;
  submitDate?: string;
  filerName?: string;
  edinetCode?: string;
  formCode?: string;
  source: "EDINET v2";
};

export type Fact = {
  element_id: string | null;
  label: string | null;
  value: number | string | null;
  context_id: string | null;
  relative_year?: string | null;
  consolidation?: string | null;
  period_type?: string | null;
  unit_id?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  decimals?: string | null;
  source_file: string;
};

export type FactIndex = {
  facts_by_element: Record<string, number[]>;
  statements: Record<string, number[]>;
};

export type EdinetJson = {
  meta: DocumentMeta;
  facts: Fact[];
  index: FactIndex;
};

export const COLUMN_MAP: Record<string, keyof Fact> = {
  要素ID: "element_id",
  項目名: "label",
  値: "value",
  コンテキストID: "context_id",
  相対年度: "relative_year",
  "連結・個別": "consolidation",
  "期間・時点": "period_type",
  単位ID: "unit_id",
  ユニットID: "unit_id",
  開始日: "period_start",
  終了日: "period_end",
  精度: "decimals",
};
