#!/usr/bin/env node
/**
 * Visual debug — Playwright Firefox headed, full playback.
 *
 * Usage:
 *   npm run build
 *   node scripts/playwright-headed.mjs
 *   node scripts/playwright-headed.mjs --file examples/gimme-otter.json
 */
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { firefox } from 'playwright';

const UPLOAD_KEY = 'doc-studio-scenario-upload';
const CAPTURE_FIXED_DATE_ISO = '2026-06-16T12:17:00.000Z';

const { values } = parseArgs({
  options: {
    file: { type: 'string', short: 'f', default: 'examples/poll-moderator-flow.json' },
    url: { type: 'string', default: 'http://127.0.0.1:4173' },
    'keep-open-ms': { type: 'string', default: '120000' },
  },
});

const scenario = JSON.parse(readFileSync(values.file, 'utf8'));
const keepOpenMs = Number(values['keep-open-ms']);

function installCaptureClockInPage(fixedIso) {
  const fixedMs = Date.parse(fixedIso);
  const RealDate = Date;

  class CaptureDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        super(fixedMs);
      } else {
        super(...args);
      }
    }

    static now() {
      return fixedMs;
    }
  }

  CaptureDate.parse = RealDate.parse;
  CaptureDate.UTC = RealDate.UTC;

  window.Date = CaptureDate;
}

let previewProc;

async function startPreview() {
  previewProc = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173'], {
    stdio: 'ignore',
  });
  await sleep(2500);
}

async function stopPreview() {
  if (!previewProc) return;
  previewProc.kill('SIGTERM');
  previewProc = null;
}

async function readPlayer(page) {
  try {
    return await page.evaluate(() => window.__SCENARIO_PLAYER__ ?? null);
  } catch {
    return null;
  }
}

async function main() {
  console.log(`Scenario: ${values.file}`);
  console.log('Launching Firefox (headed)…');

  await startPreview();

  const browser = await firefox.launch({
    headless: false,
    slowMo: 50,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  await context.addInitScript(installCaptureClockInPage, CAPTURE_FIXED_DATE_ISO);
  await context.addInitScript(
    ({ key, data }) => {
      sessionStorage.setItem(key, data);
    },
    { key: UPLOAD_KEY, data: JSON.stringify(scenario) },
  );

  const page = await context.newPage();
  page.on('pageerror', (err) => console.error('[page error]', err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('[console]', msg.text());
  });

  const url = `${values.url}/?capture=1&autoplay=1`;
  console.log(`Opening ${url}`);
  await page.goto(url, { waitUntil: 'networkidle' });

  console.log('Watching playback — close the browser window or Ctrl+C here.');
  const startedAt = performance.now();
  let lastLog = '';

  while (performance.now() - startedAt < keepOpenMs) {
    const player = await readPlayer(page);
    if (player) {
      const line = JSON.stringify({
        status: player.status,
        action: player.actionIndex,
        completed: player.completedActionIndex,
        total: player.totalActions,
      });
      if (line !== lastLog) {
        console.log(line);
        lastLog = line;
      }
      if (player.status === 'done') {
        console.log('Scenario done — browser stays open for inspection.');
        break;
      }
    }
    await sleep(500);
  }

  await sleep(30_000);
  await browser.close();
  await stopPreview();
}

main().catch(async (err) => {
  console.error(err);
  await stopPreview();
  process.exit(1);
});
