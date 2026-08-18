#!/usr/bin/env node
// Generates functions/crocheters.js from src/data/crocheters.json.
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const names = JSON.parse(
    readFileSync(resolve(root, "src/data/crocheters.json"), "utf8"),
);
const out =
    "// Auto-generated from src/data/crocheters.json — do not edit directly.\n" +
    `module.exports = ${JSON.stringify(names, null, 2)};\n`;

writeFileSync(resolve(root, "functions/crocheters.js"), out);
console.log(`synced ${names.length} names → functions/crocheters.js`);
