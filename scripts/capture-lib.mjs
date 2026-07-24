import { createHash } from 'node:crypto';
import { execFileSync, execSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
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

/** Playwright records WebM; optional ffmpeg pass converts to gif/mp4. */
export const VIDEO_FORMATS = ['gif', 'mp4', 'webm'];
export const DEFAULT_VIDEO_FORMAT = 'gif';

/**
 * GIF encode filter.
 * - hqdn3d: kill VP8 mosquito noise that crawls on flat Discord greys
 * - full palette + dither=none: stable colors (no Bayer shimmer)
 * - reserve_transparent=0: opaque UI; transparency disposal can flash
 */
export const GIF_FPS = 12;
export const GIF_VF = `fps=${GIF_FPS},hqdn3d=4:3:6:4,scale=720:-1:flags=lanczos,format=rgb24,split[s0][s1];[s0]palettegen=stats_mode=full:reserve_transparent=0[p];[s1][p]paletteuse=dither=none`;

/**
 * Disable GIF image offsetting (partial/sub-rectangle frames).
 * Offsetting writes 1×1 “diff” tiles that flash in many viewers; mp4 never does this.
 */
export const GIF_MUX_FLAGS = '-offsetting';

/** Mean abs channel delta (0–255) above which a middle frame is considered a screencast tear. */
export const GIF_FLASH_MAE_MIN = 1.0;
/** Neighbors must be closer than this fraction of the flash MAE. */
export const GIF_FLASH_SKIP_RATIO = 0.45;

export function resolveFfmpegBinary() {
  if (process.env.FFMPEG_PATH && existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }
  try {
    return execSync('command -v ffmpeg', { encoding: 'utf8' }).trim();
  } catch {
    throw new Error(
      'ffmpeg not found. Use the doc-studio capture/dev Docker image or install ffmpeg on the host.',
    );
  }
}

export function resolveVideoFormat(value = DEFAULT_VIDEO_FORMAT) {
  const format = String(value).trim().toLowerCase();
  if (!VIDEO_FORMATS.includes(format)) {
    throw new Error(
      `Unsupported video format "${value}". Expected one of: ${VIDEO_FORMATS.join(', ')}`,
    );
  }
  return format;
}

/**
 * Convert a Playwright WebM recording to the requested format.
 * gif/mp4: re-encode with ffmpeg and delete the source WebM.
 * webm: keep the recording as-is (optionally renamed).
 * @returns {string} path to the written video
 */
export function encodeCaptureVideo(
  webmPath,
  format = DEFAULT_VIDEO_FORMAT,
  outPath = webmPath.replace(/\.webm$/i, `.${resolveVideoFormat(format)}`),
) {
  const resolved = resolveVideoFormat(format);
  const targetPath = outPath;

  if (resolved === 'webm') {
    if (webmPath !== targetPath) {
      renameSync(webmPath, targetPath);
    }
    return targetPath;
  }

  const ffmpeg = resolveFfmpegBinary();

  if (resolved === 'gif') {
    encodeGifFromWebm(ffmpeg, webmPath, targetPath);
  } else {
    execFileSync(
      ffmpeg,
      [
        '-y',
        '-loglevel',
        'error',
        '-i',
        webmPath,
        '-an',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-r',
        '30',
        '-preset',
        'medium',
        '-crf',
        '23',
        '-movflags',
        '+faststart',
        targetPath,
      ],
      { stdio: 'inherit' },
    );
  }

  rmSync(webmPath, { force: true });
  return targetPath;
}

/** Mean absolute difference between two equal-length byte buffers (0–255 scale). */
export function meanAbsDiffBytes(a, b) {
  const n = a.length;
  if (n === 0 || n !== b.length) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.abs(a[i] - b[i]);
  return sum / n;
}

/**
 * Detect screencast tear frames: large change from both neighbors while the
 * neighbors themselves are similar (a one-frame paint glitch).
 * @param {Uint8Array[]} frames
 * @returns {number[]} indices to replace
 */
export function findFlashFrameIndices(
  frames,
  { maeMin = GIF_FLASH_MAE_MIN, skipRatio = GIF_FLASH_SKIP_RATIO } = {},
) {
  const flashes = [];
  if (frames.length < 3) return flashes;

  const consecutive = [];
  for (let i = 0; i < frames.length - 1; i++) {
    consecutive.push(meanAbsDiffBytes(frames[i], frames[i + 1]));
  }

  for (let i = 1; i < frames.length - 1; i++) {
    const dPrev = consecutive[i - 1];
    const dNext = consecutive[i];
    if (dPrev < maeMin || dNext < maeMin) continue;
    const dSkip = meanAbsDiffBytes(frames[i - 1], frames[i + 1]);
    if (dSkip < skipRatio * Math.min(dPrev, dNext)) {
      flashes.push(i);
    }
  }
  return flashes;
}

/**
 * Replace tear frames by duplicating the previous frame (in place).
 * @returns {number} number of frames replaced
 */
export function replaceFlashFrames(frames, flashIndices) {
  for (const i of flashIndices) {
    if (i > 0 && i < frames.length) {
      frames[i] = Uint8Array.from(frames[i - 1]);
    }
  }
  return flashIndices.length;
}

function probeScaledGifSize(ffmpeg, webmPath) {
  const tmp = mkdtempSync(join(tmpdir(), 'doc-studio-gif-probe-'));
  try {
    const framePath = join(tmp, 'f.png');
    execFileSync(
      ffmpeg,
      [
        '-y',
        '-loglevel',
        'error',
        '-i',
        webmPath,
        '-vf',
        `fps=${GIF_FPS},scale=720:-1`,
        '-frames:v',
        '1',
        framePath,
      ],
      { stdio: 'inherit' },
    );
    const probe = execFileSync(
      'ffprobe',
      [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=width,height',
        '-of',
        'csv=p=0:s=x',
        framePath,
      ],
      { encoding: 'utf8' },
    ).trim();
    const [w, h] = probe.split('x').map(Number);
    if (!w || !h) throw new Error(`Cannot probe GIF frame size from ${webmPath} (${probe})`);
    return { width: w, height: h };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function extractRgbFrames(ffmpeg, webmPath, width, height) {
  const raw = execFileSync(
    ffmpeg,
    [
      '-y',
      '-loglevel',
      'error',
      '-i',
      webmPath,
      '-an',
      '-vf',
      `fps=${GIF_FPS},scale=720:-1,format=rgb24`,
      '-f',
      'rawvideo',
      'pipe:1',
    ],
    { maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] },
  );
  const frameSize = width * height * 3;
  if (raw.length % frameSize !== 0) {
    throw new Error(
      `Raw RGB length ${raw.length} is not a multiple of frame size ${frameSize} (${width}x${height})`,
    );
  }
  const frames = [];
  for (let offset = 0; offset < raw.length; offset += frameSize) {
    frames.push(Uint8Array.prototype.slice.call(raw, offset, offset + frameSize));
  }
  return frames;
}

function encodeGifFromRgbFrames(ffmpeg, frames, width, height, targetPath) {
  const tmp = mkdtempSync(join(tmpdir(), 'doc-studio-gif-enc-'));
  const rawPath = join(tmp, 'frames.rgb');
  try {
    writeFileSync(
      rawPath,
      Buffer.concat(frames.map((f) => Buffer.from(f.buffer, f.byteOffset, f.byteLength))),
    );
    execFileSync(
      ffmpeg,
      [
        '-y',
        '-loglevel',
        'error',
        '-f',
        'rawvideo',
        '-pix_fmt',
        'rgb24',
        '-s',
        `${width}x${height}`,
        '-r',
        String(GIF_FPS),
        '-i',
        rawPath,
        '-an',
        '-vf',
        'hqdn3d=4:3:6:4,split[s0][s1];[s0]palettegen=stats_mode=full:reserve_transparent=0[p];[s1][p]paletteuse=dither=none',
        '-gifflags',
        GIF_MUX_FLAGS,
        '-loop',
        '0',
        targetPath,
      ],
      { stdio: 'inherit' },
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function encodeGifFromWebm(ffmpeg, webmPath, targetPath) {
  const { width, height } = probeScaledGifSize(ffmpeg, webmPath);
  const frames = extractRgbFrames(ffmpeg, webmPath, width, height);
  const flashes = findFlashFrameIndices(frames);
  if (flashes.length > 0) {
    replaceFlashFrames(frames, flashes);
    console.log(`  · GIF: removed ${flashes.length} screencast tear frame(s)`);
  }
  encodeGifFromRgbFrames(ffmpeg, frames, width, height, targetPath);
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
  } else if (record) {
    // Keep typing animations; drop caret blink which strobes harshly at 12fps GIF.
    await page.addStyleTag({
      content: `
        .slash-caret {
          animation: none !important;
          opacity: 1 !important;
        }
      `,
    });
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
  videoFormat = DEFAULT_VIDEO_FORMAT,
  saveFinalPng = true,
  captureStepHashes = false,
  browser,
}) {
  mkdirSync(outDir, { recursive: true });

  const ownsBrowser = !browser;
  const activeBrowser = browser ?? (await firefox.launch());
  const format = recordVideo ? resolveVideoFormat(videoFormat) : null;
  const outputs = { png: null, video: null, stepHashes: null };

  try {
    // Step hashes need capture_steps (no typing). Video needs full playback.
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

      if (recordVideo && webmPath && existsSync(webmPath)) {
        const videoPath = join(outDir, `${prefix}.${format}`);
        outputs.video = encodeCaptureVideo(webmPath, format, videoPath);
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
  if (outputs.video) {
    console.log(`✓ ${relative(root, outputs.video)}`);
  }
}

export function ensureBuilt(root) {
  const indexHtml = join(root, 'dist/index.html');
  if (!existsSync(indexHtml)) {
    console.log('Building preview assets…');
    execSync('npm run build', { cwd: root, stdio: 'inherit' });
  }
}
