#!/usr/bin/env node
/**
 * Capture every playback JSON file in a directory.
 *
 * Usage:
 *   node scripts/capture-dir.mjs scenarios/
 *   node scripts/capture-dir.mjs --dir /work/scenarios --format mp4
 *   node scripts/capture-dir.mjs --dir /work/scenarios --output-dir docs/assets
 *   node scripts/capture-dir.mjs --dir /work/scenarios --no-video
 */
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { firefox } from 'playwright';
import {
  captureScenario,
  DEFAULT_BASE_URL,
  DEFAULT_VIDEO_FORMAT,
  logCaptureOutputs,
  readScenarioFile,
  resolveVideoFormat,
  VIDEO_FORMATS,
} from './capture-lib.mjs';

const { values, positionals } = parseArgs({
  options: {
    dir: { type: 'string', short: 'd' },
    'no-video': { type: 'boolean', default: false },
    format: { type: 'string' },
    'output-dir': { type: 'string', short: 'o' },
    'base-url': { type: 'string' },
  },
  allowPositionals: true,
});

const dirArg = values.dir ?? positionals[0];
if (!dirArg) {
  console.error(
    `Usage: capture-dir.mjs <directory> [--output-dir <dir>] [--format ${VIDEO_FORMATS.join('|')}] [--no-video] [--base-url <url>]`,
  );
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

let cliFormat = null;
if (values.format) {
  try {
    cliFormat = resolveVideoFormat(values.format);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(2);
  }
}

async function captureDirectory() {
  const browser = await firefox.launch();

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

      let videoFormat;
      try {
        videoFormat = resolveVideoFormat(
          cliFormat ??
            scenario.output?.format ??
            process.env.CAPTURE_VIDEO_FORMAT ??
            DEFAULT_VIDEO_FORMAT,
        );
      } catch (err) {
        console.error(`✗ ${file}: ${err instanceof Error ? err.message : err}`);
        process.exitCode = 1;
        continue;
      }

      const outDir = join(
        workDir,
        values['output-dir'] ?? scenario.output?.directory ?? 'output',
      );
      const prefix = scenario.output?.prefix ?? scenario.id;

      console.log(`→ ${join(dirArg, file)} (${scenario.id}) [${videoFormat}]`);
      const outputs = await captureScenario({
        scenario,
        outDir,
        prefix,
        baseUrl,
        recordVideo,
        videoFormat,
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
