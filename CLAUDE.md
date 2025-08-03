# CLAUDE.md

このファイルは、このリポジトリで Claude Code (claude.ai/code) が作業する際のガイダンスを提供します。

## プロジェクト概要

金融庁 EDINET システムの仕様理解と XBRL データ活用手法の実践的研究

## 開発環境

- TypeScript/Node.js
- このプロジェクトは type=module で ESM を利用している
- Node.js v24 以上なので TypeScript (ts) ファイルを実行する場合は、`node src/main.ts` のように直接実行する

## 開発方針

### シンプル性重視

- 最小限の実装を行う
- 不必要な機能や過剰な抽象化を避ける
- 要求に対して最もシンプルな解決策を選択する

## ドキュメント管理

### 構成

- `docs/` フォルダでプロジェクトドキュメントを管理
- 新規ドキュメント作成時は `docs/index.md` にリンクを追加

### 更新ルール

- 実装変更時はドキュメント内容を見直し更新する
- 実装とドキュメントの整合性を保つ

## Git 操作ルール

### Commit 方法

Conventional Commits の仕様に基づいて git commit する。

- 英語で記述する
- 一行目に `<type>: <description>` の形式で概要を書く
- 三行目に具体的な作業内容を書く

例:

```
feat: implement user authentication API

- Add JWT token generation and validation
- Create user login and registration endpoints
```
