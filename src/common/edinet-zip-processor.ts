import JSZip from "jszip";
import iconv from "iconv-lite";
import Papa from "papaparse";

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

const COLUMN_MAP: Record<string, keyof Fact> = {
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

interface CsvFile {
  name: string;
  content: string;
}

/**
 * ZIPバイナリからCSVファイルを抽出してJSONに変換する
 */
export class EdinetZipProcessor {
  /**
   * ZIPバッファからCSVを抽出してJSONに変換する
   * @param buffer - ZIPファイルのバイナリデータ
   * @param docId - 文書ID
   * @returns JSON変換結果
   */
  async processZipToJson(buffer: Buffer, docId: string): Promise<EdinetJson> {
    const csvFiles = await this.extractCsvFiles(buffer);

    if (csvFiles.length === 0) {
      return {
        meta: { docID: docId, source: "EDINET v2" },
        facts: [],
        index: { facts_by_element: {}, statements: {} },
      };
    }

    return this.convertCsvFilesToJson(csvFiles, docId);
  }

  /**
   * ZIPバッファからCSVファイルを抽出する
   * @param buffer - ZIPファイルのバイナリデータ
   * @returns 抽出されたCSVファイルの配列
   */
  private async extractCsvFiles(buffer: Buffer): Promise<CsvFile[]> {
    const zip = await JSZip.loadAsync(buffer);
    const csvFiles: CsvFile[] = [];

    for (const [filename, file] of Object.entries(zip.files)) {
      if (!file.dir && filename.toLowerCase().endsWith(".csv")) {
        const binaryData = await file.async("uint8array");
        const content = await this.decodeFileContent(binaryData, filename);

        csvFiles.push({ name: filename, content });
      }
    }

    return csvFiles;
  }

  /**
   * CSV配列をJSONに変換する
   * @param csvFiles - CSVファイル配列
   * @param docId - 文書ID
   * @returns JSON変換結果
   */
  private convertCsvFilesToJson(csvFiles: CsvFile[], docId: string): EdinetJson {
    const allFacts: Fact[] = [];

    // 全てのCSVファイルを処理
    for (const csvFile of csvFiles) {
      const facts = this.parseCsvToFacts(csvFile.content, csvFile.name);
      allFacts.push(...facts);
    }

    // インデックスを作成
    const index = this.createFactIndex(allFacts);

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

  /**
   * CSV文字列をFact配列に変換する
   * @param csvContent - CSV文字列
   * @param sourceFileName - ファイル名
   * @returns Fact配列
   */
  private parseCsvToFacts(csvContent: string, sourceFileName: string): Fact[] {
    const result = Papa.parse(csvContent, {
      delimiter: "\t",
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
      transform: (value: string) => value.trim(),
    });

    if (result.errors.length > 0) {
      console.warn(`CSV parsing warnings for ${sourceFileName}:`, result.errors);
    }

    return result.data.map((row: any) => this.transformRowToFact(row, sourceFileName));
  }

  /**
   * CSV行をFactオブジェクトに変換する
   * @param row - CSV行データ
   * @param sourceFileName - ファイル名
   * @returns Factオブジェクト
   */
  private transformRowToFact(row: Record<string, string>, sourceFileName: string): Fact {
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
    for (const [header, value] of Object.entries(row)) {
      if (COLUMN_MAP[header] && value) {
        const factKey = COLUMN_MAP[header];

        // 値の型変換
        if (factKey === "value" && !isNaN(Number(value))) {
          fact[factKey] = Number(value);
        } else {
          fact[factKey] = value;
        }
      }
    }

    return fact;
  }

  /**
   * Fact配列からインデックスを作成する
   * @param facts - Fact配列
   * @returns FactIndex
   */
  private createFactIndex(facts: Fact[]): FactIndex {
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

  /**
   * バイナリデータをテキストにデコードする
   * EDINET CSVファイルは通常UTF-16 LEでエンコードされている
   * @param binaryData - バイナリデータ
   * @param filename - ファイル名（ログ用）
   * @returns デコードされたテキスト
   * @throws エンコーディングに失敗した場合はエラーを投げる
   */
  private async decodeFileContent(binaryData: Uint8Array, filename: string): Promise<string> {
    const buffer = Buffer.from(binaryData);

    // UTF-16 LEでデコードを試行
    try {
      const decoded = iconv.decode(buffer, "utf16le");

      // デコード結果が無効な文字（置換文字）を含む場合はエラー
      if (decoded.includes("\uFFFD")) {
        throw new Error(`Invalid UTF-16 LE encoding detected`);
      }

      return decoded;
    } catch (error) {
      throw new Error(`Failed to decode CSV file ${filename}: Expected UTF-16 LE encoding but decoding failed`);
    }
  }
}
