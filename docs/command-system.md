# Command System Design

## 概要

このプロジェクトは、`npm start <command>` の形式でコマンドを実行できるシンプルなコマンドラインシステムを実装しています。

## アーキテクチャ

### ディレクトリ構造

```
src/
├── main.ts              # メインエントリーポイント
└── commands/
    └── sample.ts        # サンプルコマンド
```

### コンポーネント設計

#### コマンド関数

```typescript
export function sampleCommand(values: any, positionals: string[]) {
  console.log("Sample command executed");
  console.log("Values:", values);
  console.log("Positionals:", positionals);
}
```

コマンドは `node:util` の `parseArgs` 関数で解析された `values` と `positionals` を受け取ります。

### コマンド実行フロー

1. `npm start <command> [args...]` で実行
2. `src/main.ts` がエントリーポイントとして起動
3. `parseArgs` でコマンドライン引数を解析
4. コマンド名でif分岐
5. 対応するコマンド関数を実行

## 使用方法

### 基本的な使用方法

```bash
# サンプルコマンドを実行
npm start sample

# 引数付きで実行
npm start sample arg1 arg2
```

### 新しいコマンドの追加

1. `src/commands/` に新しいコマンドファイルを作成
2. コマンド関数をexport
3. `src/main.ts` でimportして分岐に追加

例:

```typescript
// src/commands/newcommand.ts
export function newCommand(values: any, positionals: string[]) {
  console.log("New command executed");
  console.log("Values:", values);
  console.log("Positionals:", positionals);
}

// src/main.ts に追加
import { newCommand } from "./commands/newcommand.ts";

// ...

if (commandName === "sample") {
  sampleCommand(values, positionals.slice(1));
} else if (commandName === "newcommand") {
  newCommand(values, positionals.slice(1));
} else {
  // エラーハンドリング
}
```

## 設計原則

- **シンプル性**: 過剰な抽象化を避けたシンプルな実装
- **型安全性**: TypeScriptの型システムを活用
- **parseArgs活用**: Node.js標準の引数解析機能を使用
- **ES Modules**: モダンなJavaScript/TypeScript環境に対応
