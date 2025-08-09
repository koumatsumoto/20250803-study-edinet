# EDINET CSV → 統合JSON 化ガイド（TypeScript 向け）

## 1) EDINET APIの要点（v2）

- **書類一覧API**  
  `GET https://api.edinet-fsa.go.jp/api/v2/documents.json?date=YYYY-MM-DD&type=2&Subscription-Key=...`
  - `type=2`：提出書類一覧＋メタデータ（UTF-8 JSON）を返す
  - **docID**（書類管理番号）をここから取得

- **書類取得API**  
  `GET https://api.edinet-fsa.go.jp/api/v2/documents/{docID}?type=5&Subscription-Key=...`
  - `type=5`：XBRL→CSV変換結果（ZIP形式）
  - ZIP内は `XBRL_TO_CSV/` 配下に複数CSV

## 2) CSVファイルの形式

- **文字コード**: UTF-16LE
- **区切り**: タブ区切り（TSV）
- **主な列**（日本語ヘッダ）:
  - 要素ID（element_id）
  - 項目名（label）
  - コンテキストID（context_id）
  - 相対年度（relative_year）
  - 連結・個別（consolidation）
  - 期間・時点（period_type）
  - 単位ID（unit_id）
  - 開始日（period_start）
  - 終了日（period_end）
  - 精度（decimals）
  - 値（value）

> 会社や会計基準によって列構成は揺れるため、存在チェック必須

## 3) 推奨JSONスキーマ

```json
{
  "meta": {
    "docID": "S1234567",
    "submitDate": "2025-06-30",
    "filerName": "○○株式会社",
    "edinetCode": "E12345",
    "formCode": "030000",
    "source": "EDINET v2"
  },
  "facts": [
    {
      "element_id": "jpcrp_cor:NetSales",
      "label": "売上高",
      "value": 123456789,
      "context_id": "CurrentYearDuration_Consolidated",
      "consolidation": "連結",
      "period_type": "期間",
      "relative_year": "当期",
      "unit_id": "JPY",
      "period_start": "2024-04-01",
      "period_end": "2025-03-31",
      "decimals": "-3",
      "source_file": "jpcrp030000-asr-001_Exxxxx.csv"
    }
  ],
  "index": {
    "facts_by_element": {
      "jpcrp_cor:NetSales": [0]
    },
    "statements": {
      "jpcrp030000-asr-001_Exxxxx.csv": [0]
    }
  }
}
```

## 4) ワークフロー

1. docIDを取得

/documents.json?date=YYYY-MM-DD&type=2 で一覧を取得し、対象を絞る（formCode, edinetCode等）

2. CSV ZIPを取得

/documents/{docID}?type=5 を呼び出す

3. ZIP解凍 & CSV列挙

XBRL_TO_CSV/ 配下のCSVを対象

4. CSVを読み込む

UTF-16LEをUTF-8へ変換、タブ区切りでパース

日本語列名を英語キーへマップ

5. 全CSVを結合 & 正規化

欠損列はnull補完

数値は変換、それ以外は文字列

6. metaとfactsを1つのJSONにまとめる

7. レート制限対策

並列数制限（例: 同時2件）

適度なスリープを挟む

## 5. TypeScript 実装例（主要部分）

定数・型定義

```ts
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

export const COLUMN_MAP: Record<string, keyof Fact> = {
  要素ID: "element_id",
  項目名: "label",
  値: "value",
  コンテキストID: "context_id",
  相対年度: "relative_year",
  "連結・個別": "consolidation",
  "期間・時点": "period_type",
  単位ID: "unit_id",
  開始日: "period_start",
  終了日: "period_end",
  精度: "decimals",
};
```

### 6. 運用のコツ

UTF-16LE/TSV の扱いが最大のハマりポイント

列揺れに備えて存在チェック

TextBlockは改行保持

429対策で並列制御（p-limitなど）

source_fileで元表を追跡できるようにする
