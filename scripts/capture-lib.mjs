import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync } from 'node:fs';
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
  const context = await activeBrowser.newContext({
    viewport: DEFAULT_VIEWPORT,
    ...(recordVideo ? { recordVideo: { dir: outDir, size: DEFAULT_VIEWPORT } } : {}),
  });

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
    await page.waitForTimeout(400);

    const pngPath = join(outDir, `${prefix}.png`);
    await page.locator('[data-capture-root]').screenshot({ path: pngPath });
    outputs.png = pngPath;
  } finally {
    await context.close();
    if (recordVideo) {
      const videos = readdirSync(outDir).filter((f) => f.endsWith('.webm'));
      if (videos.length > 0) {
        const videoPath = join(outDir, `${prefix}.webm`);
        renameSync(join(outDir, videos.at(-1)), videoPath);
        outputs.webm = videoPath;
      }
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
