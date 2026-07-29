#!/usr/bin/env node
/**
 * Playwright capture for uploaded playback JSON files.
 *
 * Usage:
 *   npm run build && npm run preview
 *   npm run capture -- --file examples/poll-moderator-flow.json
 *   npm run capture -- --file my-flow.json --format mp4
 *   npm run capture -- --file my-flow.json --format gif,mp4,webm
 *   npm run capture -- --file my-flow.json --output-dir docs/assets
 *   CAPTURE_BASE_URL=http://127.0.0.1:4173 npm run capture -- --file my-flow.json
 */
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import {
  captureScenario,
  DEFAULT_BASE_URL,
  DEFAULT_VIDEO_FORMAT,
  readScenarioFile,
  logCaptureOutputs,
  resolveVideoFormats,
  VIDEO_FORMATS,
} from './capture-lib.mjs';

const FORMAT_HELP = `${VIDEO_FORMATS.join('|')}[,...]`;

const { values, positionals } = parseArgs({
  options: {
    file: { type: 'string', short: 'f' },
    'no-video': { type: 'boolean', default: false },
    format: { type: 'string', multiple: true },
    'output-dir': { type: 'string', short: 'o' },
    'base-url': { type: 'string' },
  },
  allowPositionals: true,
});

const filePath = values.file ?? positionals[0];
if (!filePath) {
  console.error(
    `Usage: capture.mjs --file <playback.json> [--output-dir <dir>] [--format ${FORMAT_HELP}] [--no-video] [--base-url <url>]`,
  );
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

let videoFormats;
try {
  videoFormats = resolveVideoFormats(
    values.format?.length
      ? values.format
      : (scenario.output?.format ?? process.env.CAPTURE_VIDEO_FORMAT ?? DEFAULT_VIDEO_FORMAT),
  );
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(2);
}

const outDir = join(workDir, values['output-dir'] ?? scenario.output?.directory ?? 'output');
const prefix = scenario.output?.prefix ?? scenario.id;
const recordVideo = !values['no-video'] && (scenario.output?.video ?? true);

captureScenario({
  scenario,
  outDir,
  prefix,
  baseUrl,
  recordVideo,
  videoFormat: videoFormats,
})
  .then((outputs) => {
    logCaptureOutputs(workDir, outputs);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
