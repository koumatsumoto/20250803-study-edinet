# CLAUDE.md

このファイルは、このリポジトリで Claude Code (claude.ai/code) が作業する際のガイダンスを提供します。

## プロジェクト概要

金融庁 EDINET システムの仕様理解と XBRL データ活用手法の実践的研究

## 開発環境

- TypeScript/Node.js
- このプロジェクトは type=module で ESM を利用している
- Node.js v24 以上なので TypeScript (ts) ファイルを実行する場合は、`node src/main.ts` のように直接実行する

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
