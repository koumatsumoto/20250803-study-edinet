import JSZip from "jszip";
import iconv from "iconv-lite";
import { convertCsvFilesToJson } from "./csv-to-json-converter.ts";
import type { EdinetJson } from "./csv-to-json-types.ts";

export interface CsvFile {
  name: string;
  content: string;
}

export interface ZipProcessResult {
  csvFiles: CsvFile[];
  jsonResult?: EdinetJson;
}

/**
 * ZIPバイナリからCSVファイルを抽出し、オプションでJSONに変換する
 */
export class EdinetZipProcessor {
  /**
   * ZIPバッファからCSVファイルを抽出する
   * @param buffer - ZIPファイルのバイナリデータ
   * @returns 抽出されたCSVファイルの配列
   */
  async extractCsvFiles(buffer: Buffer): Promise<CsvFile[]> {
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
   * ZIPバッファからCSVを抽出してJSONに変換する
   * @param buffer - ZIPファイルのバイナリデータ
   * @param docId - 文書ID
   * @returns CSVファイルとJSON変換結果
   */
  async processZipToJson(buffer: Buffer, docId: string): Promise<ZipProcessResult> {
    const csvFiles = await this.extractCsvFiles(buffer);

    if (csvFiles.length === 0) {
      return { csvFiles };
    }

    const jsonResult = convertCsvFilesToJson(csvFiles, docId);
    return { csvFiles, jsonResult };
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
