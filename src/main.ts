#!/usr/bin/env node

import { parseArgs } from "node:util";
import { edinetListCommand } from "./commands/edinet-list.ts";

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    date: {
      type: "string",
      short: "d",
    },
  },
});

console.log("Parsed values:", values);
console.log("Positionals:", positionals);

if (positionals.length === 0) {
  console.log("Usage: npm start <command>");
  console.log("Available commands: edinet-list");
  process.exit(0);
}

const commandName = positionals[0];

if (commandName === "edinet-list") {
  edinetListCommand(values);
} else {
  console.error(`Unknown command: ${commandName}`);
  console.log("Available commands: edinet-list");
  process.exit(1);
}
