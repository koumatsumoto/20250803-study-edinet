#!/usr/bin/env node

import { parseArgs } from "node:util";
import { edinetListCommand } from "./commands/edinet-list.ts";
import { edinetFetchCommand } from "./commands/edinet-fetch.ts";
import { edinetTestBatchCommand } from "./commands/edinet-test-batch.ts";

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
    json: {
      type: "boolean",
      short: "j",
    },
  },
});

console.log("Parsed values:", values);
console.log("Positionals:", positionals);

if (positionals.length === 0) {
  console.log("Usage: npm start <command>");
  console.log("Available commands: edinet-list, edinet-fetch, edinet-test-batch");
  process.exit(0);
}

const commandName = positionals[0];

if (commandName === "edinet-list") {
  edinetListCommand(values);
} else if (commandName === "edinet-fetch") {
  edinetFetchCommand(values);
} else if (commandName === "edinet-test-batch") {
  edinetTestBatchCommand();
} else {
  console.error(`Unknown command: ${commandName}`);
  console.log("Available commands: edinet-list, edinet-fetch, edinet-test-batch");
  process.exit(1);
}
