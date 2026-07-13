#!/usr/bin/env node
/**
 * Validate playback JSON file(s) against schema/scenario.schema.json.
 *
 * Usage:
 *   npm run validate -- examples/poll-moderator-flow.json
 *   node scripts/validate-scenario.mjs path/to/*.json
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const files = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
if (files.length === 0) {
  console.error('Usage: validate-scenario.mjs <file.json> [file2.json …]');
  process.exit(2);
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const scenarioSchema = JSON.parse(readFileSync(join(root, 'schema/scenario.schema.json'), 'utf8'));
const validateScenario = ajv.compile(scenarioSchema);

let failed = false;

for (const file of files) {
  const abs = resolve(process.cwd(), file);
  let raw;
  try {
    raw = JSON.parse(readFileSync(abs, 'utf8'));
  } catch (err) {
    failed = true;
    console.error(`✗ ${file}: ${err instanceof Error ? err.message : err}`);
    continue;
  }

  const ok = validateScenario(raw);
  if (!ok) {
    failed = true;
    console.error(`✗ ${file}`);
    for (const err of validateScenario.errors ?? []) {
      console.error(`  ${err.instancePath || '/'} ${err.message}`);
    }
    continue;
  }

  console.log(`✓ ${file} → ${raw.id}`);
}

if (failed) {
  process.exit(1);
}

console.log(`\n${files.length} fichier(s) valide(s).`);
