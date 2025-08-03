#!/usr/bin/env node

import { parseArgs } from "node:util";
import { sampleCommand } from "./commands/sample.ts";

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
});

console.log("Parsed values:", values);
console.log("Positionals:", positionals);

if (positionals.length === 0) {
  console.log("Usage: npm start sample");
  process.exit(0);
}

const commandName = positionals[0];

if (commandName === "sample") {
  sampleCommand(values, positionals.slice(1));
} else {
  console.error(`Unknown command: ${commandName}`);
  console.log("Available commands: sample");
  process.exit(1);
}
