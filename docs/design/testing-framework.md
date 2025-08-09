# Testing Framework

## 概要

このプロジェクトでは vitest と MSW を使用したテスト環境を構築している。

## テストフレームワーク

### Vitest

- **テストランナー**: Vitest を採用
- **実行コマンド**: `npm test`
- **カバレッジ**: @vitest/coverage-v8 を使用してカバレッジレポート生成
- **設定ファイル**: `vitest.config.ts`

### テスト実行

```bash
# テスト実行（カバレッジ付き）
npm test

# 上記は以下と同等
vitest run --coverage
```

## ネットワーク通信のモック

### MSW (Mock Service Worker)

- **用途**: 外部API通信のモック
- **対象**: EDINET APIへのHTTPリクエスト
- **設定場所**:
  - `tests/mocks/server.ts` - モックサーバー設定
  - `tests/mocks/handlers.ts` - APIエンドポイントのモック定義
  - `tests/setup.ts` - テスト環境でのサーバー起動設定

### モック対象API

- **EDINET文書一覧API**: `GET /api/v2/documents.json`
- **EDINET文書取得API**: `GET /api/v2/documents/:docId`

各APIで以下のケースをモック：

- 正常レスポンス
- 認証エラー (401)
- パラメータエラー (400)
- 文書未発見エラー (404)

## ディレクトリ構成

```
tests/
├── setup.ts                    # テスト環境セットアップ
├── mocks/
│   ├── server.ts              # MSWサーバー設定
│   └── handlers.ts            # APIモック定義
└── edinet-api-client.test.ts  # EdinetApiClientのテスト
```

## カバレッジ設定

- **プロバイダー**: v8
- **レポート形式**: text + html
- **対象**: `src/**/*.ts`
- **除外**: `src/main.ts`, `tests/**`

## テスト対象

### EdinetApiClient

- **fetchDocumentsList**: 文書一覧取得
- **fetchDocument**: 文書バイナリデータ取得
- **constructor**: 設定とデフォルト値の処理

各メソッドで正常ケースとエラーケースをテスト。現在のカバレッジ: 91.66%

## パフォーマンス

- テスト実行時間: 約1.3秒
- 全10テスト
- MSWによるモック応答で高速実行
