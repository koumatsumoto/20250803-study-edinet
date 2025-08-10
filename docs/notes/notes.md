# 作業メモ (notes.md)

このファイルは、EDINET Financial Analyzer の開発・運用中に気づいた個人的なメモを記録するためのファイルです。

- EDINETの使い方
- APIの仕様で気づいた点
- データ構造の特徴
- 実装上の注意点
- 参考になったリソース
- TODOや課題

## リンク集

- [EDINET検索トップ](https://disclosure2.edinet-fsa.go.jp/)

## API利用時の注意点

APIキーを発行する必要がある。APIキーは[このページ](https://api.edinet-fsa.go.jp/api/auth/index.aspx?mode=1)でログインして発行する必要がある。このページはブラウザのポップアップ設定を有効にしないとアクセスできない。
参考記事：https://zenn.dev/paradinight/articles/f4567f3728e4d2
