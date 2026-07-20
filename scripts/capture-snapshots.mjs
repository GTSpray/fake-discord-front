#!/usr/bin/env node
/**
 * Capture every example playback file into tests/snapshots/ and compare per-step PNG MD5 hashes.
 *
 * Usage:
 *   npm run snapshots
 *   npm run snapshots:refresh
 *   npm run snapshots -- --no-video
 *   npm run snapshots:check
 *   npm run snapshots:verify
 *   CAPTURE_BASE_URL=http://127.0.0.1:4173 npm run snapshots
 */
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
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
  flattenScenarioStepHashes,
  hasHashDiff,
  listEvolvedScenarioIds,
  listSnapshotVideos,
  loadSnapshot,
  printHashDiff,
  SNAPSHOT_FILENAME,
  validateSnapshotCoverage,
  writeSnapshot,
} from './snapshot-hashes.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const examplesDir = join(root, 'examples');
const snapshotsDir = join(root, 'tests/snapshots');
const snapshotPath = join(snapshotsDir, SNAPSHOT_FILENAME);

const { values } = parseArgs({
  options: {
    'no-video': { type: 'boolean', default: false },
    'base-url': { type: 'string' },
    'skip-build': { type: 'boolean', default: false },
    'check-only': { type: 'boolean', default: false },
    verify: { type: 'boolean', default: false },
    refresh: { type: 'boolean', default: false },
  },
});

const requestedBaseUrl = values['base-url'] ?? DEFAULT_BASE_URL;
const checkOnly = values['check-only'];
const verifyMode = values.verify;
const refreshMode = values.refresh;

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

function pruneUnchangedVideos(scenarioIds, evolvedIds) {
  const evolved = new Set(evolvedIds);
  const kept = [];
  const removed = [];

  for (const id of scenarioIds) {
    const videoPath = join(snapshotsDir, `${id}.webm`);
    if (!existsSync(videoPath)) continue;
    if (evolved.has(id)) {
      kept.push(id);
      continue;
    }
    rmSync(videoPath, { force: true });
    removed.push(id);
  }

  for (const name of listSnapshotVideos(snapshotsDir)) {
    const id = name.replace(/\.webm$/i, '');
    if (scenarioIds.includes(id)) continue;
    rmSync(join(snapshotsDir, name), { force: true });
    removed.push(id);
  }

  if (kept.length > 0) {
    console.log('\nWebM conservés (scénarios évolués):');
    for (const id of kept) {
      console.log(`  ✓ ${relative(root, join(snapshotsDir, `${id}.webm`))}`);
    }
  } else {
    console.log('\nAucun WebM à conserver (aucune évolution visuelle).');
  }

  if (removed.length > 0) {
    console.log('WebM retirés (inchangés ou orphelins):');
    for (const id of removed) {
      console.log(`  × ${relative(root, join(snapshotsDir, `${id}.webm`))}`);
    }
  }
}

function verifySnapshotHashes({ updateSnapshot, baselineScenarios, currentScenarios }) {
  const previousScenarios = baselineScenarios ?? loadSnapshot(snapshotPath)?.scenarios ?? {};
  const previousHashes = flattenScenarioStepHashes(previousScenarios);
  const currentHashes = flattenScenarioStepHashes(currentScenarios);
  const scenarioIds = listScenarioIds();
  const missingCoverage = validateSnapshotCoverage(scenarioIds, currentScenarios);

  if (Object.keys(currentHashes).length === 0 && !checkOnly) {
    throw new Error('No per-step snapshot hashes generated.');
  }

  if (Object.keys(previousHashes).length === 0 && checkOnly) {
    throw new Error(
      `Missing ${join('tests/snapshots', SNAPSHOT_FILENAME)}. Run npm run snapshots:refresh first.`,
    );
  }

  if (missingCoverage.length > 0) {
    console.log('\nAucun hash de step pour les scénarios:');
    for (const id of missingCoverage) {
      console.log(`  ! ${id}`);
    }
    return { exitCode: 1, evolvedIds: [], previousHashes };
  }

  const diff = diffHashes(previousHashes, currentHashes);
  printHashDiff(diff);

  const evolvedIds = Object.keys(previousHashes).length
    ? listEvolvedScenarioIds(previousScenarios, currentScenarios)
    : scenarioIds;

  if (updateSnapshot) {
    writeSnapshot(snapshotPath, currentScenarios);
    console.log(`\n✓ ${join('tests/snapshots', SNAPSHOT_FILENAME)} updated.`);
  }

  if (hasHashDiff(diff)) {
    if (!Object.keys(previousHashes).length) {
      console.log('\nPremière génération du snapshot MD5.');
      return { exitCode: 0, evolvedIds, previousHashes };
    }
    if (verifyMode) {
      console.log(
        '\nLes snapshots de steps ne sont pas à jour. Lancez `make snapshots-refresh` puis committez.',
      );
      return { exitCode: 1, evolvedIds, previousHashes };
    }
    if (refreshMode) {
      console.log('\nÉvolution détectée. Committez snapshot.json et les WebM conservés.');
    } else {
      console.log('\nLes snapshots ont évolué. Committez les WebM et snapshot.json si c’est voulu.');
    }
    return { exitCode: 0, evolvedIds, previousHashes };
  }

  if (verifyMode) {
    console.log('\n✓ Snapshots de steps à jour.');
  } else if (refreshMode) {
    console.log('\nAucune évolution visuelle. snapshot.json est à jour.');
  }

  return { exitCode: 0, evolvedIds: [], previousHashes };
}

async function captureScenarioById(browser, file) {
  const relPath = join('examples', file);
  const { scenario } = readScenarioFile(relPath);
  const prefix = scenario.id;
  console.log(`→ ${relPath} (${scenario.id})`);
  const outputs = await captureScenario({
    scenario,
    outDir: snapshotsDir,
    prefix,
    baseUrl: requestedBaseUrl,
    recordVideo: false,
    saveFinalPng: false,
    captureStepHashes: true,
    browser,
  });
  return { prefix, scenario, outputs };
}

async function captureVideoForScenario(browser, scenario) {
  const prefix = scenario.id;
  console.log(`→ video ${prefix}`);
  const outputs = await captureScenario({
    scenario,
    outDir: snapshotsDir,
    prefix,
    baseUrl: requestedBaseUrl,
    recordVideo: true,
    saveFinalPng: false,
    captureStepHashes: false,
    browser,
  });
  logCaptureOutputs(root, outputs);
}

async function captureSnapshots() {
  if (checkOnly) {
    const scenarioIds = listScenarioIds();
    const baseline = loadSnapshot(snapshotPath)?.scenarios ?? {};
    if (!existsSync(snapshotPath)) {
      console.error(
        `Missing ${join('tests/snapshots', SNAPSHOT_FILENAME)}. Run make snapshots-refresh first.`,
      );
      process.exit(1);
    }
    const missingCoverage = validateSnapshotCoverage(scenarioIds, baseline);
    if (missingCoverage.length > 0) {
      console.log('\nAucun hash de step pour les scénarios:');
      for (const id of missingCoverage) console.log(`  ! ${id}`);
      process.exit(1);
    }
    console.log(`\n✓ ${join('tests/snapshots', SNAPSHOT_FILENAME)} couvre tous les scénarios.`);
    process.exit(0);
  }

  if (verifyMode && !existsSync(snapshotPath)) {
    console.error(
      `Missing ${join('tests/snapshots', SNAPSHOT_FILENAME)}. Run make snapshots-refresh first.`,
    );
    process.exit(1);
  }

  // Refresh always compares against the committed snapshot.json baseline.
  const baselineScenarios =
    verifyMode || refreshMode ? loadSnapshot(snapshotPath)?.scenarios : undefined;

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

    const currentScenarios = {};
    const scenariosById = {};
    for (const file of files) {
      if (refreshMode || verifyMode || values['no-video']) {
        const { prefix, scenario, outputs } = await captureScenarioById(browser, file);
        scenariosById[prefix] = scenario;
        currentScenarios[prefix] = { steps: outputs.stepHashes ?? {} };
        continue;
      }

      const relPath = join('examples', file);
      const { scenario } = readScenarioFile(relPath);
      const prefix = scenario.id;
      console.log(`→ ${relPath} (${scenario.id})`);
      const outputs = await captureScenario({
        scenario,
        outDir: snapshotsDir,
        prefix,
        baseUrl: requestedBaseUrl,
        recordVideo: true,
        saveFinalPng: false,
        captureStepHashes: true,
        browser,
      });
      currentScenarios[prefix] = { steps: outputs.stepHashes ?? {} };
      logCaptureOutputs(root, outputs);
    }

    console.log(`\n${files.length} snapshot(s) hashed.`);
    const { exitCode, evolvedIds } = verifySnapshotHashes({
      updateSnapshot: !verifyMode,
      baselineScenarios,
      currentScenarios,
    });

    if (refreshMode) {
      const scenarioIds = Object.keys(currentScenarios).sort();
      if (evolvedIds.length === 0) {
        console.log('\nAucune évolution: WebM existants laissés inchangés.');
      } else {
        console.log(`\nRecapture vidéo pour ${evolvedIds.length} scénario(s) évolué(s)…`);
        for (const id of evolvedIds) {
          if (!scenariosById[id]) continue;
          await captureVideoForScenario(browser, scenariosById[id]);
        }
        pruneUnchangedVideos(scenarioIds, evolvedIds);
      }
    }

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
