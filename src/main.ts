#!/usr/bin/env node

import { parseArgs } from "node:util";
import { edinetListCommand } from "./commands/edinet-list.ts";
import { edinetFetchCommand } from "./commands/edinet-fetch.ts";
import { edinetTestBatchCommand } from "./commands/edinet-test-batch.ts";
import { edinetBatchCommand } from "./commands/edinet-batch.ts";

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    date: {
      type: "string",
      short: "d",
    },
    docId: {
      type: "string",
      short: "i",
    },
    output: {
      type: "string",
      short: "o",
    },
  },
});

console.log("Parsed values:", values);
console.log("Positionals:", positionals);

if (positionals.length === 0) {
  console.log("Usage: npm start <command>");
  console.log("Available commands: edinet-list, edinet-fetch, edinet-test-batch, batch");
  process.exit(0);
}

const commandName = positionals[0];

try {
  if (commandName === "edinet-list") {
    await edinetListCommand(values);
  } else if (commandName === "edinet-fetch") {
    edinetFetchCommand(values);
  } else if (commandName === "edinet-test-batch") {
    edinetTestBatchCommand();
  } else if (commandName === "batch") {
    // 日付引数は2番目のpositionalから取得
    const dateArg = positionals[1];
    await edinetBatchCommand(dateArg ? { date: dateArg } : {});
  } else {
    console.error(`Unknown command: ${commandName}`);
    console.log("Available commands: edinet-list, edinet-fetch, edinet-test-batch, batch");
    process.exit(1);
  }
} catch (error) {
  console.error(`❌ エラー: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
