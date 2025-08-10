# EDINET 研究プロジェクト

金融庁 EDINET システムの仕様理解と XBRL データ活用手法の実践的研究

## プロジェクト概要

このプロジェクトは、金融庁が運営する EDINET（Electronic Disclosure for Investors' NETwork）システムの仕様を理解し、XBRL データの効果的な活用手法を研究することを目的としています。

## ドキュメント

### 要件・仕様

- `requirements/` - 要件に関する資料

### 設計・開発

- [コマンドシステム設計](design/command-system.md) - コマンドラインシステムの設計仕様
- [EDINET API仕様書](design/EDINET-API-Specs.pdf) - EDINET APIの公式仕様書
- [書類一覧API仕様書](design/document-list-api-spec.md) - EDINET 書類一覧APIの詳細仕様
- [書類取得API仕様書](design/document-details-api.md) - EDINET 書類取得APIの詳細仕様
- [テストフレームワーク](design/testing-framework.md) - Vitest と MSW を使用したテスト環境
- [正規化データモデル設計](design/normalized-data-model.md) - EDINET財務データの正規化設計方針
- [日次バッチ処理システム](design/daily-batch-processing-system.md) - EDINET文書の自動取得・正規化バッチシステム

### メモ・ノート

- [作業メモ](notes/notes.md) - 調査・学習過程での気づきやメモ
- [EDINET CSV → JSON化ガイド](notes/arranging_csv_results.md) - CSVからJSONへの変換仕様と実装方法

## EDINET について

EDINET は、有価証券報告書等の開示書類の提出及び閲覧を電子的に行うことができるシステムです。投資家の投資判断に必要な情報を迅速かつ効率的に提供することを目的としています。

### 主な特徴

- 金融庁が運営する公式な開示プラットフォーム
- XBRL 形式による構造化データの提供
- API による機械可読なデータアクセス
- 無料での利用が可能

## 関連リンク

- [EDINET検索トップ](https://disclosure2.edinet-fsa.go.jp/)
- [金融庁ホームページ](https://www.fsa.go.jp/)
