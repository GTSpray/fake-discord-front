#!/usr/bin/env node
/**
 * Capture every example playback file into tests/snapshots/ and compare PNG MD5 hashes.
 *
 * Usage:
 *   npm run snapshots
 *   npm run snapshots -- --no-video
 *   npm run snapshots:check
 *   npm run snapshots:verify
 *   CAPTURE_BASE_URL=http://127.0.0.1:4173 npm run snapshots
 */
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import {
  captureScenario,
  DEFAULT_BASE_URL,
  ensureBuilt,
  readScenarioFile,
  logCaptureOutputs,
} from './capture-lib.mjs';
import {
  diffHashes,
  expectedSnapshotArtifacts,
  findMissingArtifacts,
  hashSnapshotFiles,
  hasHashDiff,
  listSnapshotArtifacts,
  loadManifest,
  MANIFEST_FILENAME,
  printHashDiff,
  printMissingArtifacts,
  writeManifest,
} from './snapshot-hashes.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const examplesDir = join(root, 'examples');
const snapshotsDir = join(root, 'tests/snapshots');
const manifestPath = join(snapshotsDir, MANIFEST_FILENAME);

const { values } = parseArgs({
  options: {
    'no-video': { type: 'boolean', default: false },
    'base-url': { type: 'string' },
    'skip-build': { type: 'boolean', default: false },
    'check-only': { type: 'boolean', default: false },
    verify: { type: 'boolean', default: false },
  },
});

const requestedBaseUrl = values['base-url'] ?? DEFAULT_BASE_URL;
const checkOnly = values['check-only'];
const verifyMode = values.verify;
const recordVideo = verifyMode || !values['no-video'];

async function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // preview not ready yet
    }
    await sleep(250);
  }
  throw new Error(`Preview server not ready at ${url}`);
}

async function startPreviewServer(baseUrl) {
  try {
    const res = await fetch(baseUrl);
    if (res.ok) {
      console.log(`Using preview server at ${baseUrl}`);
      return null;
    }
  } catch {
    // start a local preview below
  }

  const url = new URL(baseUrl);
  const port = url.port || (url.protocol === 'https:' ? '443' : '80');
  console.log(`Starting preview server on ${url.hostname}:${port}…`);

  const proc = spawn(
    'npx',
    ['vite', 'preview', '--host', url.hostname, '--port', port, '--strictPort'],
    {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    },
  );

  proc.stdout?.on('data', (chunk) => process.stdout.write(chunk));
  proc.stderr?.on('data', (chunk) => process.stderr.write(chunk));

  await waitForServer(baseUrl);
  return proc;
}

function listExampleFiles() {
  return readdirSync(examplesDir)
    .filter((name) => name.endsWith('.json'))
    .sort();
}

function listScenarioIds() {
  return listExampleFiles().map((file) => readScenarioFile(join('examples', file)).scenario.id);
}

async function closeBrowser(browser) {
  if (!browser) return;
  await Promise.race([
    browser.close(),
    sleep(5_000).then(() => {
      console.warn('browser.close() timed out after 5s — forcing exit');
    }),
  ]);
}

async function stopPreviewServer(previewProc) {
  if (!previewProc) return;
  previewProc.kill('SIGTERM');
  await Promise.race([new Promise((resolve) => previewProc.once('exit', resolve)), sleep(2000)]);
  if (!previewProc.killed) {
    previewProc.kill('SIGKILL');
  }
}

function verifySnapshotHashes({ updateManifest, baselineHashes }) {
  const previousManifest = baselineHashes ?? loadManifest(manifestPath)?.files ?? {};
  const currentHashes = hashSnapshotFiles(snapshotsDir);
  const scenarioIds = listScenarioIds();
  const expectedArtifacts = expectedSnapshotArtifacts(scenarioIds);
  const missingArtifacts = findMissingArtifacts(
    expectedArtifacts,
    listSnapshotArtifacts(snapshotsDir),
  );

  if (Object.keys(currentHashes).length === 0) {
    throw new Error(`No snapshot PNG files found in tests/snapshots/. Run npm run snapshots first.`);
  }

  if (missingArtifacts.length > 0) {
    printMissingArtifacts(missingArtifacts, { root, snapshotsDir });
    console.log('\nLancez npm run snapshots pour générer les captures manquantes.');
    return 1;
  }

  const diff = diffHashes(previousManifest, currentHashes);
  printHashDiff(diff, { root, snapshotsDir });

  if (updateManifest) {
    writeManifest(manifestPath, currentHashes);
    console.log(`\n✓ ${join('tests/snapshots', MANIFEST_FILENAME)} updated.`);
  }

  if (hasHashDiff(diff)) {
    if (!Object.keys(previousManifest).length) {
      console.log('\nPremière génération du manifeste MD5.');
      return 0;
    }
    if (verifyMode) {
      console.log('\nLes PNG committés ne sont pas à jour. Lancez `make snapshots` puis committez.');
      return 1;
    }
    console.log(
      '\nLes snapshots ont évolué. Committez les fichiers et le manifeste si c’est voulu.',
    );
    return 0;
  }

  if (verifyMode) {
    console.log('\n✓ PNG committés à jour.');
  }

  return 0;
}

async function captureSnapshots() {
  if (checkOnly) {
    process.exit(verifySnapshotHashes({ updateManifest: false }));
  }

  if (verifyMode && !existsSync(manifestPath)) {
    console.error(
      `Missing ${join('tests/snapshots', MANIFEST_FILENAME)}. Run make snapshots first.`,
    );
    process.exit(1);
  }

  const baselineHashes = verifyMode ? loadManifest(manifestPath)?.files : undefined;

  if (!values['skip-build']) {
    ensureBuilt(root);
  } else if (!existsSync(join(root, 'dist/index.html'))) {
    throw new Error('dist/ is missing. Run npm run build or drop --skip-build.');
  }

  const files = listExampleFiles();
  if (files.length === 0) {
    console.error(`No JSON examples found in ${examplesDir}`);
    process.exit(2);
  }

  let previewProc;
  let browser;

  try {
    previewProc = await startPreviewServer(requestedBaseUrl);
    browser = await chromium.launch();

    console.log(`Capturing ${files.length} example(s) → tests/snapshots/`);

    for (const file of files) {
      const relPath = join('examples', file);
      const { scenario } = readScenarioFile(relPath);
      const prefix = scenario.id;

      console.log(`→ ${relPath} (${scenario.id})`);
      const outputs = await captureScenario({
        scenario,
        outDir: snapshotsDir,
        prefix,
        baseUrl: requestedBaseUrl,
        recordVideo,
        browser,
      });
      logCaptureOutputs(root, outputs);
    }

    console.log(`\n${files.length} snapshot(s) written to tests/snapshots/.`);
    const exitCode = verifySnapshotHashes({
      updateManifest: !verifyMode,
      baselineHashes,
    });
    process.exit(exitCode);
  } finally {
    await closeBrowser(browser);
    await stopPreviewServer(previewProc);
  }

  process.exit(0);
}

captureSnapshots().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
