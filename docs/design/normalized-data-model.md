# EDINET正規化データモデル設計方針

## 概要

EDINET CSV（type=5）から取得した財務データを効率的に管理・分析するための正規化データモデルの設計方針です。
現状のフラット構造（JSON）から段階的に移行し、大規模データ処理と時系列分析を可能にします。

## 背景と目的

### 現状の実装状況

- ✅ **ZIP→JSON変換**: `EdinetZipProcessor`により実装済み
- ✅ **生データ出力**: `EdinetJson`形式で行レベルデータを保存
- ✅ **他システム連携**: 生JSONは汎用的で他アプリでも利用可能

### 現状の課題

- **冗長性**: 同じコンテキスト情報が各factsに重複保存
- **型混在**: 数値・文字列が`value`フィールドで混在し、型安全性に課題
- **スケーラビリティ**: 大量文書処理時のメモリ・ストレージ効率
- **分析制限**: 複数文書間での時系列比較が困難

### 目標

- **レイヤー分離**: 生データ（EdinetJSON）と分析用データ（正規化JSON）の明確な分離
- **効率性**: コンテキスト重複排除により30-50%のストレージ削減
- **型安全性**: 数値・文字列の厳密な分離管理
- **分析能力**: 複数文書間での比較・時系列分析
- **既存資産活用**: `EdinetZipProcessor`の実装を最大限活用

## データモデル設計

### 全体アーキテクチャ

```
documents (文書メタデータ)
    ↓ 1:N
contexts (財務データのコンテキスト)
    ↓ 1:N
facts (財務データ実体)
```

### 1. Documents（文書メタデータ）

文書の基本情報を管理。EDINET APIから取得するメタデータを正規化。

```typescript
type DocumentRecord = {
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
```

### 2. Contexts（財務データのコンテキスト）

財務データの「意味」を定義。期間、連結区分、相対年度などの枠組み情報。

```typescript
type ContextRecord = {
  document_id: string; // FK: documentsへの参照
  context_id: string; // コンテキストID
  period_type: PeriodType; // "duration" | "instant" | "unknown"
  period_label: string; // 期間表示ラベル（当期/前期等）
  consolidated_flag: ConsolidatedType; // 連結区分
  relative_year: number | null; // 相対年度（0=当年、-1=前年）
  hashkey: string; // パフォーマンス用ハッシュ
};

type PeriodType = "duration" | "instant" | "unknown";
type ConsolidatedType = "Consolidated" | "NonConsolidated" | "Other" | "Unknown";
```

**設計ルール**:

- `document_id + context_id`で一意性確保（重複排除）
- `hashkey`はJOIN操作の高速化用

### 3. Facts（財務データ実体）

財務データの実際の値。concept（要素ID）とcontextの組み合わせで意味が決定される原子データ。

```typescript
type FactRecord = {
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

type UnitType = "JPY" | "shares" | "percent" | "count" | "other";
```

**設計ルール**:

- `value_num`または`value_str`のどちらか一方は必ず値を持つ
- `is_numeric`フラグで型を明確化
- 冗長保持により複雑なJOINを回避し検索性を向上

## 正規化の考え方

### 基本原則

1. **facts = "数字（または短い文字列）そのもの"**
   - `concept + context_id + unit`の組で意味が決まる
   - 数値化可能なものは`value_num`へ、それ以外は`value_str`へ

2. **contexts = "数字の意味（枠組み）"**
   - 期間（当期/前期/四半期/時点）、連結/個別、相対年度など
   - 同じ`context_id`は1行に集約（重複排除）

3. **冗長保持は最小限**
   - 検索性向上のため、必要最小限の属性のみfactsへコピー
   - 完全正規化と利便性のバランスを重視

### データフロー

```
EDINET API → ZIP(CSV) → EdinetJSON → NormalizedJSON
               ↓           ↓            ↓
            CSV抽出    生行データ    正規化構造
            (既存)      (既存)       (追加)
```

**段階的処理**:

1. **既存実装**: `EdinetZipProcessor.processZipToJson()` - ZIP → EdinetJSON
2. **追加実装**: `EdinetNormalizedProcessor.normalize()` - EdinetJSON → NormalizedJSON

## 実装アーキテクチャ

### クラス構造

```typescript
export class EdinetNormalizedProcessor {
  // EdinetJSON → 正規化JSON変換（NEW）
  async normalize(edinetJson: EdinetJson): Promise<NormalizedResult>;

  // 複数EdinetJSON一括正規化（NEW）
  async normalizeMultiple(edinetJsons: EdinetJson[]): Promise<NormalizedResult>;

  // ZIP → 正規化JSON直接処理（便利メソッド）
  async processZipToNormalized(buffer: Buffer, docId: string): Promise<NormalizedResult>;

  // 出力フォーマット
  async exportToJson(result: NormalizedResult): Promise<NormalizedJson>;
}

// 既存クラスは維持
export class EdinetZipProcessor {
  async processZipToJson(buffer: Buffer, docId: string): Promise<EdinetJson>; // 既存
}

type NormalizedResult = {
  documents: DocumentRecord[];
  contexts: ContextRecord[];
  facts: FactRecord[];
  summary: ProcessingSummary;
};
```

### 段階的実装戦略

#### Phase 1: 正規化モデル導入（MVP）

- ✅ 既存`EdinetZipProcessor`保持（ZIP→EdinetJSON）
- ➕ 新規`EdinetNormalizedProcessor`追加（EdinetJSON→正規化JSON）
- ➕ 正規化JSON出力機能
- ➕ 基本的な型変換・正規化

**実装範囲**: EdinetJSON→正規化JSON変換、基本的なJSON出力

#### Phase 2: バッチ処理拡張

- ➕ 複数文書一括処理
- ➕ contexts重複排除
- ➕ 数値・単位正規化強化
- ➕ エラーハンドリング・ログ改善

**実装範囲**: 日次一括処理、品質管理機能

#### Phase 3: データベース連携（将来）

- ➕ PostgreSQL/SQLiteスキーマ対応
- ➕ 効率的なデータロード・更新
- ➕ インデックス最適化

## 技術仕様

### 必要な追加依存関係

```json
{
  "dependencies": {
    "uuid": "^10.0.0", // fact_id生成用
    "fs-extra": "^11.0.0" // ファイル操作拡張（オプション）
  }
}
```

既存の依存関係（`iconv-lite`, `papaparse`, `zod`等）はそのまま活用。

### データ型定義

```typescript
// 共通型定義
export type PeriodType = "duration" | "instant" | "unknown";
export type ConsolidatedType = "Consolidated" | "NonConsolidated" | "Other" | "Unknown";
export type UnitType = "JPY" | "shares" | "percent" | "count" | "other";

// バリデーションスキーマ（zod）
export const DocumentRecordSchema = z.object({
  document_id: z.string(),
  edinet_code: z.string().nullable(),
  // ... 他フィールド
});
```

### JSON出力フォーマット

**正規化JSON構造**:

```typescript
// 正規化後のJSON構造
type NormalizedJson = {
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

// 既存のEdinetJSON構造（保持）
type EdinetJson = {
  meta: DocumentMeta;
  facts: Fact[];
  index: FactIndex;
};
```

**ファイル出力**:

- **生データ**: `${docId}_facts.json` (EdinetJSON) ※既存
- **正規化データ**: `${docId}_normalized.json` (NormalizedJSON) ※追加

**エンコーディング**: UTF-8

## 期待効果

### 効率性向上

- **ストレージ削減**: contexts重複排除により30-50%削減
- **処理性能**: 型分離による数値処理高速化
- **メモリ効率**: 大量データの効率的処理

### 分析能力向上

- **時系列分析**: 複数文書間での売上・利益比較
- **投資判断支援**: KPI自動集計・トレンド分析
- **異常検知**: 前期比・計画比サプライズ検出

### 開発・運用改善

- **型安全性**: 数値・文字列混在エラーの削減
- **拡張性**: セグメント分析・注記情報追加対応
- **互換性**: 既存システム継続稼働

## 移行計画

### ステップ1: 基盤構築（1-2週間）

- [ ] `EdinetNormalizedProcessor`基本実装
- [ ] 型定義・スキーマ作成
- [ ] 単体テスト整備

### ステップ2: 機能実装（2-3週間）

- [ ] JSON出力機能
- [ ] 既存データでの動作検証
- [ ] パフォーマンス測定・最適化

### ステップ3: 統合テスト（1週間）

- [ ] 既存システムとの互換性確認
- [ ] 大量データでの負荷テスト
- [ ] ドキュメント整備

## 運用・品質管理

### 品質チェック項目

- [ ] CSV解析成功率（UTF-16LE、タブ区切り）
- [ ] 行数整合性（生CSV vs 生成facts）
- [ ] contexts重複排除率
- [ ] 数値化成功率（主要concept）
- [ ] 単位正規化率

### 監視・ログ

- 処理時間・メモリ使用量
- エラー・警告ログ
- データ品質指標
- 異常値検出ログ
