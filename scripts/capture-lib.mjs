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
  const outputs = { png: null, webm: null };

  try {
    await page.goto(`${baseUrl}/?capture=1&autoplay=1`, { waitUntil: 'networkidle' });
    await waitForScenarioReady(page);
    await page.waitForFunction('window.__SCENARIO_PLAYER__?.status === "done"', undefined, {
      timeout: 120_000,
    });
    await waitForCaptureReady(page);
    await page.waitForTimeout(400);

    const pngPath = join(outDir, `${prefix}.png`);
    await page.locator('[data-capture-root]').screenshot({ path: pngPath });
    outputs.png = pngPath;
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
