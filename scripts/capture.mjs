#!/usr/bin/env node
/**
 * Playwright capture for uploaded playback JSON files.
 *
 * Usage:
 *   npm run build && npm run preview
 *   npm run capture -- --file examples/poll-moderator-flow.json
 *   CAPTURE_BASE_URL=http://127.0.0.1:4173 npm run capture -- --file my-flow.json
 */
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import {
  captureScenario,
  DEFAULT_BASE_URL,
  readScenarioFile,
  logCaptureOutputs,
} from './capture-lib.mjs';

const { values, positionals } = parseArgs({
  options: {
    file: { type: 'string', short: 'f' },
    'no-video': { type: 'boolean', default: false },
    'base-url': { type: 'string' },
  },
  allowPositionals: true,
});

const filePath = values.file ?? positionals[0];
if (!filePath) {
  console.error('Usage: capture.mjs --file <playback.json> [--no-video] [--base-url <url>]');
  process.exit(2);
}

const baseUrl = values['base-url'] ?? DEFAULT_BASE_URL;
const workDir = process.cwd();

let scenario;
try {
  ({ scenario } = readScenarioFile(filePath));
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

const outDir = join(workDir, scenario.output?.directory ?? 'output');
const prefix = scenario.output?.prefix ?? scenario.id;
const recordVideo = !values['no-video'] && (scenario.output?.video ?? true);

captureScenario({
  scenario,
  outDir,
  prefix,
  baseUrl,
  recordVideo,
})
  .then((outputs) => {
    logCaptureOutputs(workDir, outputs);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
