import { createHash } from 'node:crypto';
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { chromium } from 'playwright';

export const DEFAULT_BASE_URL = process.env.CAPTURE_BASE_URL ?? 'http://127.0.0.1:4173';
export const DEFAULT_VIEWPORT = { width: 1280, height: 720 };
export const UPLOAD_SCENARIO_STORAGE_KEY = 'doc-studio-scenario-upload';

export function readScenarioFile(filePath) {
  const absFile = resolve(process.cwd(), filePath);
  try {
    return { scenario: JSON.parse(readFileSync(absFile, 'utf8')), absFile };
  } catch (err) {
    throw new Error(`Cannot read ${filePath}: ${err instanceof Error ? err.message : err}`, {
      cause: err,
    });
  }
}

async function waitForScenarioReady(page) {
  await page.waitForFunction(
    `() => window.__SCENARIO_LOAD_ERROR__ || document.querySelector('[data-capture-root]')`,
    undefined,
    { timeout: 15_000 },
  );

  const loadError = await page.evaluate('window.__SCENARIO_LOAD_ERROR__ ?? null');
  if (loadError) {
    throw new Error(`Scenario validation failed:\n${loadError}`);
  }
}

export const CAPTURE_FIXED_DATE_ISO = '2026-06-16T12:17:00.000Z';

function installCaptureClockInPage(fixedIso) {
  const fixedMs = Date.parse(fixedIso);
  const OriginalDate = Date;

  function FixedDate(...args) {
    if (new.target !== undefined) {
      if (args.length === 0) return new OriginalDate(fixedMs);
      return new OriginalDate(...args);
    }
    if (args.length === 0) return OriginalDate(fixedMs);
    return OriginalDate(...args);
  }

  FixedDate.prototype = OriginalDate.prototype;
  FixedDate.now = () => fixedMs;
  FixedDate.parse = OriginalDate.parse;
  FixedDate.UTC = OriginalDate.UTC;
  // eslint-disable-next-line no-undef
  window.Date = FixedDate;
}

async function waitForCaptureReady(page) {
  await page.evaluate('document.fonts.ready');
  await page.waitForFunction(
    `() => {
      const root = document.querySelector('[data-capture-root]');
      if (!root) return false;
      return [...root.querySelectorAll('img')].every(
        (img) => img.complete && img.naturalWidth > 0,
      );
    }`,
    undefined,
    { timeout: 15_000 },
  );
}

async function waitForStepCaptureReady(page) {
  await page.evaluate('document.fonts.ready');
  await page.waitForFunction(
    `() => {
      const root = document.querySelector('[data-capture-root]');
      if (!root) return false;
      const imagesReady = [...root.querySelectorAll('img')].every(
        (img) => img.complete && img.naturalWidth > 0,
      );
      if (!imagesReady) return false;

      const modalHost = document.querySelector('.skyra-modal-host');
      if (!modalHost) return true;

      const skyraModal = modalHost.querySelector('discord-modal');
      const shadow = skyraModal?.shadowRoot;
      const dialog = shadow?.querySelector('dialog');
      const box = shadow?.querySelector('.discord-modal-box');
      if (!dialog || !box) return false;

      const boxVisible = window.getComputedStyle(box).display !== 'none';
      return dialog.open && boxVisible;
    }`,
    undefined,
    { timeout: 15_000 },
  );
  await page.waitForTimeout(200);
}

async function disableRuntimeAnimations(page) {
  await page.addStyleTag({
    content: `
      *,
      *::before,
      *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
      .scenario-cursor-host {
        display: none !important;
      }
    `,
  });
}

function md5Buffer(data) {
  const hash = createHash('md5');
  hash.update(data);
  return hash.digest('hex');
}

async function captureStepPngHashes(page, timeoutMs = 120_000) {
  const stepHashes = {};
  let lastCompletedStep = -1;
  const startedAt = Date.now();
  const root = page.locator('[data-capture-root]');

  while (Date.now() - startedAt < timeoutMs) {
    const player = await page.evaluate('window.__SCENARIO_PLAYER__ ?? null');

    if (
      player &&
      typeof player.completedActionIndex === 'number' &&
      typeof player.status === 'string'
    ) {
      if (player.completedActionIndex > lastCompletedStep) {
        const stepKey = `${String(player.completedActionIndex).padStart(3, '0')}-done`;
        await waitForStepCaptureReady(page);
        const png = await root.screenshot();
        stepHashes[stepKey] = md5Buffer(png);
        lastCompletedStep = player.completedActionIndex;
        await page.evaluate('window.__SCENARIO_CAPTURE_NEXT_STEP__?.()');
      }

      if (player.status === 'done' && player.completedActionIndex >= 0) {
        return stepHashes;
      }
    }

    await page.waitForTimeout(70);
  }

  throw new Error('Timed out while capturing per-step PNG hashes.');
}

/** Re-encode WebM with fixed settings so MD5 is stable in the pinned Docker image. */
export function resolveFfmpegBinary() {
  if (process.env.FFMPEG_PATH && existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }
  try {
    return execSync('command -v ffmpeg', { encoding: 'utf8' }).trim();
  } catch {
    throw new Error(
      'ffmpeg not found. Use the doc-studio-dev Docker image (make snapshots) or install ffmpeg on the host.',
    );
  }
}

export function normalizeWebmVideo(filePath) {
  const ffmpeg = resolveFfmpegBinary();
  const tmp = `${filePath}.norm.webm`;
  execFileSync(
    ffmpeg,
    [
      '-y',
      '-loglevel',
      'error',
      '-i',
      filePath,
      '-an',
      '-c:v',
      'libvpx',
      '-pix_fmt',
      'yuv420p',
      '-r',
      '30',
      '-g',
      '300',
      '-keyint_min',
      '300',
      '-auto-alt-ref',
      '0',
      '-lag-in-frames',
      '0',
      '-deadline',
      'good',
      '-cpu-used',
      '0',
      '-b:v',
      '2M',
      '-threads',
      '1',
      '-fflags',
      '+bitexact',
      '-flags',
      '+bitexact',
      tmp,
    ],
    { stdio: 'inherit' },
  );
  rmSync(filePath, { force: true });
  renameSync(tmp, filePath);
}

export async function captureScenario({
  scenario,
  outDir,
  prefix,
  baseUrl = DEFAULT_BASE_URL,
  recordVideo = true,
  saveFinalPng = true,
  captureStepHashes = false,
  browser,
}) {
  mkdirSync(outDir, { recursive: true });

  const ownsBrowser = !browser;
  const activeBrowser = browser ?? (await chromium.launch());
  const videoDir = recordVideo ? join(outDir, `.capture-video-${prefix}`) : null;
  if (videoDir) {
    mkdirSync(videoDir, { recursive: true });
  }

  const context = await activeBrowser.newContext({
    viewport: DEFAULT_VIEWPORT,
    ...(videoDir ? { recordVideo: { dir: videoDir, size: DEFAULT_VIEWPORT } } : {}),
  });

  await context.addInitScript(installCaptureClockInPage, CAPTURE_FIXED_DATE_ISO);

  await context.addInitScript(
    ({ key, data }) => {
      sessionStorage.setItem(key, data);
    },
    { key: UPLOAD_SCENARIO_STORAGE_KEY, data: JSON.stringify(scenario) },
  );

  const page = await context.newPage();
  const outputs = { png: null, webm: null, stepHashes: null };

  try {
    const captureUrl = new URL(baseUrl);
    captureUrl.searchParams.set('capture', '1');
    captureUrl.searchParams.set('autoplay', '1');
    if (captureStepHashes) {
      captureUrl.searchParams.set('capture_steps', '1');
    }
    await page.goto(captureUrl.toString(), { waitUntil: 'networkidle' });
    await waitForScenarioReady(page);
    await waitForCaptureReady(page);

    if (captureStepHashes) {
      await disableRuntimeAnimations(page);
      outputs.stepHashes = await captureStepPngHashes(page);
    }

    await page.waitForFunction('window.__SCENARIO_PLAYER__?.status === "done"', undefined, {
      timeout: 120_000,
    });
    await page.waitForTimeout(400);

    if (saveFinalPng) {
      const pngPath = join(outDir, `${prefix}.png`);
      await page.locator('[data-capture-root]').screenshot({ path: pngPath });
      outputs.png = pngPath;
    }
  } finally {
    const video = recordVideo ? page.video() : null;
    await context.close();
    if (video) {
      const videoPath = join(outDir, `${prefix}.webm`);
      await video.saveAs(videoPath);
      normalizeWebmVideo(videoPath);
      outputs.webm = videoPath;
    }
    if (videoDir) {
      rmSync(videoDir, { recursive: true, force: true });
    }
    if (ownsBrowser) {
      await activeBrowser.close();
    }
  }

  return outputs;
}

export function logCaptureOutputs(root, outputs) {
  if (outputs.png) {
    console.log(`✓ ${relative(root, outputs.png)}`);
  }
  if (outputs.webm) {
    console.log(`✓ ${relative(root, outputs.webm)}`);
  }
}

export function ensureBuilt(root) {
  const indexHtml = join(root, 'dist/index.html');
  if (!existsSync(indexHtml)) {
    console.log('Building preview assets…');
    execSync('npm run build', { cwd: root, stdio: 'inherit' });
  }
}
