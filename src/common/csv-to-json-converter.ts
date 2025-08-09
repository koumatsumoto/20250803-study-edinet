import type { DocumentMeta, Fact, FactIndex, EdinetJson } from "./csv-to-json-types.ts";
import { COLUMN_MAP } from "./csv-to-json-types.ts";

export function parseCsvToFacts(csvContent: string, sourceFileName: string): Fact[] {
  const lines = csvContent.split("\n").filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return [];
  }

  // ヘッダー行をパース（タブ区切り）
  const headers = lines[0]?.split("\t") || [];
  const facts: Fact[] = [];

  // データ行を処理
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i]?.split("\t") || [];
    const fact: Fact = {
      element_id: null,
      label: null,
      value: null,
      context_id: null,
      relative_year: null,
      consolidation: null,
      period_type: null,
      unit_id: null,
      period_start: null,
      period_end: null,
      decimals: null,
      source_file: sourceFileName,
    };

    // 各列をマッピング
    for (let j = 0; j < headers.length && j < values.length; j++) {
      const header = headers[j]?.trim().replace(/^"|"$/g, "") || "";
      const value = values[j]?.trim().replace(/^"|"$/g, "") || "";

      if (COLUMN_MAP[header]) {
        const factKey = COLUMN_MAP[header];

        // 値の型変換
        if (factKey === "value" && value && !isNaN(Number(value))) {
          fact[factKey] = Number(value);
        } else if (value) {
          fact[factKey] = value;
        }
      }
    }

    facts.push(fact);
  }

  return facts;
}

export function createFactIndex(facts: Fact[]): FactIndex {
  const factsByElement: Record<string, number[]> = {};
  const statements: Record<string, number[]> = {};

  facts.forEach((fact, index) => {
    // element_id でのインデックス
    if (fact.element_id) {
      if (!factsByElement[fact.element_id]) {
        factsByElement[fact.element_id] = [];
      }
      factsByElement[fact.element_id]?.push(index);
    }

    // source_file でのインデックス
    if (!statements[fact.source_file]) {
      statements[fact.source_file] = [];
    }
    statements[fact.source_file]?.push(index);
  });

  return {
    facts_by_element: factsByElement,
    statements,
  };
}

export function convertCsvFilesToJson(csvFiles: Array<{ name: string; content: string }>, docId: string): EdinetJson {
  const allFacts: Fact[] = [];

  // 全てのCSVファイルを処理
  for (const csvFile of csvFiles) {
    const facts = parseCsvToFacts(csvFile.content, csvFile.name);
    allFacts.push(...facts);
  }

  // インデックスを作成
  const index = createFactIndex(allFacts);

  // メタデータを作成
  const meta: DocumentMeta = {
    docID: docId,
    source: "EDINET v2",
  };

  return {
    meta,
    facts: allFacts,
    index,
  };
}
