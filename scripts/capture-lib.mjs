import { createHash } from 'node:crypto';
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { firefox } from 'playwright';

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

  // eslint-disable-next-line no-undef
  window.Date = CaptureDate;
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

/** Playwright records WebM; we re-encode to GIF for docs and review. */
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

/**
 * Convert a Playwright WebM recording to a looping GIF, then delete the WebM.
 * Uses a palette pass for readable colors at a doc-friendly size/fps.
 * @returns {string} path to the written `.gif`
 */
export function encodeCaptureGif(webmPath, gifPath = webmPath.replace(/\.webm$/i, '.gif')) {
  const ffmpeg = resolveFfmpegBinary();
  execFileSync(
    ffmpeg,
    [
      '-y',
      '-loglevel',
      'error',
      '-i',
      webmPath,
      '-an',
      '-vf',
      'fps=12,scale=720:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5',
      '-loop',
      '0',
      gifPath,
    ],
    { stdio: 'inherit' },
  );
  rmSync(webmPath, { force: true });
  return gifPath;
}

async function createCaptureContext(browser, { scenario }) {
  const context = await browser.newContext({
    viewport: DEFAULT_VIEWPORT,
  });

  await context.addInitScript(installCaptureClockInPage, CAPTURE_FIXED_DATE_ISO);
  await context.addInitScript(
    ({ key, data }) => {
      sessionStorage.setItem(key, data);
    },
    { key: UPLOAD_SCENARIO_STORAGE_KEY, data: JSON.stringify(scenario) },
  );

  return context;
}

/**
 * Load the scenario page and wait until capture UI is ready.
 * @param {{ baseUrl: string, captureSteps?: boolean, autoplay?: boolean, record?: boolean }} options
 */
async function prepareScenarioPage(
  page,
  { baseUrl, captureSteps = false, autoplay = true, record = false },
) {
  const captureUrl = new URL(baseUrl);
  captureUrl.searchParams.set('capture', '1');
  captureUrl.searchParams.set('autoplay', autoplay ? '1' : '0');
  if (captureSteps) {
    captureUrl.searchParams.set('capture_steps', '1');
  }
  if (record) {
    captureUrl.searchParams.set('record', '1');
  }

  await page.goto(captureUrl.toString(), { waitUntil: 'networkidle' });
  await waitForScenarioReady(page);
  await waitForCaptureReady(page);

  if (captureSteps) {
    await disableRuntimeAnimations(page);
  }
}

async function waitForPlaybackDone(page) {
  await page.waitForFunction('window.__SCENARIO_PLAYER__?.status === "done"', undefined, {
    timeout: 120_000,
  });
  await page.waitForTimeout(400);
}

/**
 * Play a scenario once.
 * - captureSteps: short-circuit animations, pause per action, return step PNG MD5s
 * - otherwise: full playback (typing animations included)
 */
async function playScenarioCapture(page, { baseUrl, captureSteps = false }) {
  await prepareScenarioPage(page, { baseUrl, captureSteps, autoplay: true });

  if (captureSteps) {
    return captureStepPngHashes(page);
  }

  await waitForPlaybackDone(page);
  return null;
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
  const activeBrowser = browser ?? (await firefox.launch());
  const outputs = { png: null, gif: null, stepHashes: null };

  try {
    // Step hashes need capture_steps (no typing). GIF needs full playback.
    // When both are requested, run two passes so review videos keep typingAnimation.
    if (captureStepHashes) {
      const hashContext = await createCaptureContext(activeBrowser, { scenario });
      try {
        const hashPage = await hashContext.newPage();
        outputs.stepHashes = await playScenarioCapture(hashPage, {
          baseUrl,
          captureSteps: true,
        });
        if (saveFinalPng && !recordVideo) {
          const pngPath = join(outDir, `${prefix}.png`);
          await hashPage.locator('[data-capture-root]').screenshot({ path: pngPath });
          outputs.png = pngPath;
        }
      } finally {
        await hashContext.close();
      }
    }

    if (recordVideo || (saveFinalPng && !outputs.png)) {
      const playContext = await createCaptureContext(activeBrowser, { scenario });
      const playPage = await playContext.newPage();
      const webmPath = recordVideo ? join(outDir, `${prefix}.webm`) : null;
      const gifPath = recordVideo ? join(outDir, `${prefix}.gif`) : null;
      let screencastStarted = false;

      try {
        // record=1 arms a gate: page loads fully, then waits until we start the screencast.
        await prepareScenarioPage(playPage, {
          baseUrl,
          captureSteps: false,
          autoplay: true,
          record: recordVideo,
        });

        if (recordVideo) {
          await playPage.waitForFunction('window.__SCENARIO_CAPTURE_ARMED__ === true', undefined, {
            timeout: 15_000,
          });
          await playPage.screencast.start({
            path: webmPath,
            size: DEFAULT_VIEWPORT,
          });
          screencastStarted = true;
          await playPage.evaluate('window.__SCENARIO_CAPTURE_BEGIN__()');
        }

        await waitForPlaybackDone(playPage);

        if (saveFinalPng && !outputs.png) {
          const pngPath = join(outDir, `${prefix}.png`);
          await playPage.locator('[data-capture-root]').screenshot({ path: pngPath });
          outputs.png = pngPath;
        }
      } finally {
        if (screencastStarted) {
          await playPage.screencast.stop();
        }
        await playContext.close();
      }

      if (recordVideo && webmPath && gifPath && existsSync(webmPath)) {
        outputs.gif = encodeCaptureGif(webmPath, gifPath);
      }
    }
  } finally {
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
  if (outputs.gif) {
    console.log(`✓ ${relative(root, outputs.gif)}`);
  }
}

export function ensureBuilt(root) {
  const indexHtml = join(root, 'dist/index.html');
  if (!existsSync(indexHtml)) {
    console.log('Building preview assets…');
    execSync('npm run build', { cwd: root, stdio: 'inherit' });
  }
}
