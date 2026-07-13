#!/usr/bin/env node
/**
 * Capture every playback JSON file in a directory.
 *
 * Usage:
 *   node scripts/capture-dir.mjs scenarios/
 *   node scripts/capture-dir.mjs --dir /work/scenarios --no-video
 */
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import {
  captureScenario,
  DEFAULT_BASE_URL,
  logCaptureOutputs,
  readScenarioFile,
} from './capture-lib.mjs';

const { values, positionals } = parseArgs({
  options: {
    dir: { type: 'string', short: 'd' },
    'no-video': { type: 'boolean', default: false },
    'base-url': { type: 'string' },
  },
  allowPositionals: true,
});

const dirArg = values.dir ?? positionals[0];
if (!dirArg) {
  console.error('Usage: capture-dir.mjs <directory> [--no-video] [--base-url <url>]');
  process.exit(2);
}

const workDir = process.cwd();
const dir = resolve(workDir, dirArg);

if (!existsSync(dir)) {
  console.error(`Directory not found: ${dir}`);
  process.exit(1);
}

const files = readdirSync(dir)
  .filter((name) => name.endsWith('.json'))
  .sort();

if (files.length === 0) {
  console.error(`No JSON files found in ${dir}`);
  process.exit(2);
}

const baseUrl = values['base-url'] ?? DEFAULT_BASE_URL;
const recordVideo = !values['no-video'];

async function captureDirectory() {
  const browser = await chromium.launch();

  try {
    console.log(`Capturing ${files.length} file(s) from ${dirArg}/`);

    for (const file of files) {
      const filePath = join(dir, file);
      let scenario;
      try {
        ({ scenario } = readScenarioFile(filePath));
      } catch (err) {
        console.error(`✗ ${file}: ${err instanceof Error ? err.message : err}`);
        process.exitCode = 1;
        continue;
      }

      const outDir = join(workDir, scenario.output?.directory ?? 'output');
      const prefix = scenario.output?.prefix ?? scenario.id;

      console.log(`→ ${join(dirArg, file)} (${scenario.id})`);
      const outputs = await captureScenario({
        scenario,
        outDir,
        prefix,
        baseUrl,
        recordVideo,
        browser,
      });
      logCaptureOutputs(workDir, outputs);
    }
  } finally {
    await browser.close();
  }
}

captureDirectory().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
