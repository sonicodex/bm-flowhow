#!/usr/bin/env node
// Converts the "Flujo" sheet of an .xlsx file into the grid JSON the importer
// takes, with the same reader and the same rules module as the browser.
//   node tools/xlsx-to-grid.mjs <file.xlsx> [out.grid.json]
// Without an output path it prints the JSON. Generates reference/*.grid.json.
import { readFileSync, writeFileSync } from 'node:fs';
import Core from '../public/js/core.js';
import { readSheet, XlsxError } from '../public/js/xlsx.js';

const [input, output] = process.argv.slice(2);
if (!input) {
  console.error('Usage: node tools/xlsx-to-grid.mjs <file.xlsx> [out.grid.json]');
  process.exit(2);
}
try {
  const read = Core.tableToGrid(await readSheet(readFileSync(input), 'Flujo'));
  if (read.errors.length) {
    read.errors.forEach((e) => console.error(e.message));
    process.exit(1);
  }
  const json = JSON.stringify(read.grid, null, 2) + '\n';
  if (output) writeFileSync(output, json);
  else process.stdout.write(json);
} catch (e) {
  if (!(e instanceof XlsxError)) throw e;
  console.error(e.message);
  process.exit(1);
}
