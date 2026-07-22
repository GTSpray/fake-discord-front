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
import { copyFileSync, existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { firefox } from 'playwright';
import {
  captureScenario,
  DEFAULT_BASE_URL,
  ensureBuilt,
  readScenarioFile,
  logCaptureOutputs,
} from './capture-lib.mjs';
import {
  buildVerifyReport,
  diffHashes,
  flattenScenarioStepHashes,
  hasHashDiff,
  listEvolvedScenarioIds,
  loadSnapshot,
  printHashDiff,
  SNAPSHOT_FILENAME,
  validateSnapshotCoverage,
  writeSnapshot,
  writeVerifyReport,
} from './snapshot-hashes.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const examplesDir = join(root, 'examples');
const snapshotsDir = join(root, 'tests/snapshots');
const snapshotPath = join(snapshotsDir, SNAPSHOT_FILENAME);
export const VERIFY_REPORT_FILENAME = 'verify-report.json';
const verifyReportPath = join(snapshotsDir, VERIFY_REPORT_FILENAME);

/** Retries after a first hash mismatch, to filter capture flakiness. */
const MAX_SNAPSHOT_RETRIES = 2;

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

function createCaptureTempDir() {
  return mkdtempSync(join(tmpdir(), 'doc-studio-snapshots-'));
}

function removeTempDir(tempDir) {
  if (!tempDir) return;
  rmSync(tempDir, { recursive: true, force: true });
}

/** Copy GIF from temp capture dir into tests/snapshots/ only for evolved scenarios. */
function promoteEvolvedVideos(tempDir, evolvedIds) {
  if (evolvedIds.length === 0) {
    console.log('\nAucune évolution: GIF existants non modifiés.');
    return;
  }

  console.log(`\nCopie des GIF évolués → ${relative(root, snapshotsDir)}:`);
  for (const id of evolvedIds) {
    const from = join(tempDir, `${id}.gif`);
    const to = join(snapshotsDir, `${id}.gif`);
    if (!existsSync(from)) {
      console.warn(`  ! manquant dans le temporaire: ${id}.gif`);
      continue;
    }
    copyFileSync(from, to);
    console.log(`  ✓ ${relative(root, to)}`);
  }
}

function compareToBaseline(baselineScenarios, currentScenarios) {
  const previousScenarios = baselineScenarios ?? {};
  const previousHashes = flattenScenarioStepHashes(previousScenarios);
  const currentHashes = flattenScenarioStepHashes(currentScenarios);
  const scenarioIds = listScenarioIds();
  const missingCoverage = validateSnapshotCoverage(scenarioIds, currentScenarios);

  if (Object.keys(currentHashes).length === 0) {
    throw new Error('No per-step snapshot hashes generated.');
  }

  if (missingCoverage.length > 0) {
    return {
      ok: false,
      missingCoverage,
      evolvedIds: [],
      diff: null,
      isFirstGeneration: false,
    };
  }

  const isFirstGeneration = Object.keys(previousHashes).length === 0;
  const evolvedIds = isFirstGeneration
    ? scenarioIds
    : listEvolvedScenarioIds(previousScenarios, currentScenarios);
  const diff = diffHashes(previousHashes, currentHashes);

  return {
    ok: true,
    missingCoverage: [],
    evolvedIds,
    diff,
    isFirstGeneration,
    hasDiff: hasHashDiff(diff),
  };
}

function finalizeComparison({ comparison, currentScenarios, updateSnapshot }) {
  const { missingCoverage, evolvedIds, diff, isFirstGeneration, hasDiff } = comparison;

  if (missingCoverage.length > 0) {
    console.log('\nAucun hash de step pour les scénarios:');
    for (const id of missingCoverage) console.log(`  ! ${id}`);
    return { exitCode: 1, evolvedIds: [] };
  }

  printHashDiff(diff, { evolvedIds });

  if (verifyMode) {
    const report = buildVerifyReport({ evolvedIds, diff, currentScenarios });
    writeVerifyReport(verifyReportPath, report);
    console.log(`\n✓ Rapport écrit: ${relative(root, verifyReportPath)}`);
  }

  if (updateSnapshot) {
    writeSnapshot(snapshotPath, currentScenarios);
    console.log(`\n✓ ${join('tests/snapshots', SNAPSHOT_FILENAME)} updated.`);
  }

  if (hasDiff) {
    if (isFirstGeneration) {
      console.log('\nPremière génération du snapshot MD5.');
      if (refreshMode) {
        console.log('Scénarios rafraîchis:');
        for (const id of evolvedIds) console.log(`  + ${id}`);
        return { exitCode: 1, evolvedIds };
      }
      return { exitCode: 0, evolvedIds };
    }
    if (verifyMode) {
      console.log('\nScénarios à rafraîchir:');
      for (const id of evolvedIds) console.log(`  ~ ${id}`);
      console.log('\nLancez `make snapshots-refresh`, puis committez.');
      return { exitCode: 1, evolvedIds };
    }
    if (refreshMode) {
      console.log('\nScénarios rafraîchis:');
      for (const id of evolvedIds) console.log(`  ~ ${id}`);
      console.log('\nCommittez snapshot.json et les GIF mis à jour.');
      return { exitCode: 1, evolvedIds };
    }
    console.log('\nLes snapshots ont évolué. Committez les GIF et snapshot.json si c’est voulu.');
    return { exitCode: 0, evolvedIds };
  }

  if (verifyMode) {
    console.log('\n✓ Snapshots de steps à jour.');
  } else if (refreshMode) {
    console.log('\n✓ Aucun snapshot à rafraîchir.');
  }

  return { exitCode: 0, evolvedIds: [] };
}

async function captureAllExamples({ browser, files, outDir, recordVideo, useTempDir }) {
  const currentScenarios = {};

  for (const file of files) {
    const relPath = join('examples', file);
    const { scenario } = readScenarioFile(relPath);
    const prefix = scenario.id;

    console.log(`→ ${relPath} (${scenario.id})`);
    const outputs = await captureScenario({
      scenario,
      outDir,
      prefix,
      baseUrl: requestedBaseUrl,
      recordVideo,
      saveFinalPng: false,
      captureStepHashes: true,
      browser,
    });
    currentScenarios[prefix] = { steps: outputs.stepHashes ?? {} };
    if (!useTempDir) {
      logCaptureOutputs(root, outputs);
    } else if (outputs.gif) {
      console.log(`  · ${prefix}.gif (temp)`);
    }
  }

  return currentScenarios;
}

async function captureWithRetries({ browser, files, baselineScenarios, recordVideo, useTempDir }) {
  let tempDir = null;
  try {
    const shouldRetry = refreshMode || verifyMode;
    let attempt = 0;

    let currentScenarios = null;
    let comparison = null;

    while (true) {
      removeTempDir(tempDir);
      tempDir = useTempDir ? createCaptureTempDir() : null;
      const outDir = tempDir ?? snapshotsDir;

      if (attempt === 0) {
        console.log(
          tempDir
            ? `Capturing ${files.length} example(s) → ${tempDir}`
            : `Capturing ${files.length} example(s) → tests/snapshots/`,
        );
      } else {
        console.log(
          `\nDiff instable détectée — retry ${attempt}/${MAX_SNAPSHOT_RETRIES} → ${tempDir ?? 'tests/snapshots/'}`,
        );
      }

      currentScenarios = await captureAllExamples({
        browser,
        files,
        outDir,
        recordVideo,
        useTempDir,
      });
      console.log(`\n${files.length} snapshot(s) hashed (attempt ${attempt + 1}).`);

      comparison = compareToBaseline(baselineScenarios, currentScenarios);
      if (!comparison.ok) {
        return { tempDir, currentScenarios, comparison, keepTemp: false };
      }

      // First generation or plain capture: no flakiness retry loop.
      if (!shouldRetry || comparison.isFirstGeneration || !comparison.hasDiff) {
        if (shouldRetry && attempt > 0 && !comparison.hasDiff) {
          console.log('\n✓ Diff non reproduite après retry — considérée comme flaky.');
        }
        return { tempDir, currentScenarios, comparison, keepTemp: comparison.hasDiff };
      }

      if (attempt >= MAX_SNAPSHOT_RETRIES) {
        console.log(
          `\nDiff confirmée après ${MAX_SNAPSHOT_RETRIES} retry(s) — changement considéré comme réel.`,
        );
        return { tempDir, currentScenarios, comparison, keepTemp: true };
      }

      console.log(
        `\nDiff vs baseline détectée (scénarios: ${comparison.evolvedIds.join(', ') || 'n/a'}).`,
      );
      attempt += 1;
    }
  } catch (err) {
    removeTempDir(tempDir);
    throw err;
  }
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
  let tempDir;

  try {
    previewProc = await startPreviewServer(requestedBaseUrl);
    browser = await firefox.launch();

    const useTempDir = refreshMode || verifyMode;
    const recordVideo = refreshMode || (!verifyMode && !values['no-video']);

    const result = await captureWithRetries({
      browser,
      files,
      baselineScenarios,
      recordVideo,
      useTempDir,
    });
    tempDir = result.tempDir;

    const updateSnapshot =
      !verifyMode &&
      (!refreshMode || result.comparison.hasDiff || result.comparison.isFirstGeneration);

    const { exitCode, evolvedIds } = finalizeComparison({
      comparison: result.comparison,
      currentScenarios: result.currentScenarios,
      updateSnapshot,
    });

    if (refreshMode && tempDir && evolvedIds.length > 0) {
      promoteEvolvedVideos(tempDir, evolvedIds);
    }

    process.exit(exitCode);
  } finally {
    removeTempDir(tempDir);
    await closeBrowser(browser);
    await stopPreviewServer(previewProc);
  }

  process.exit(0);
}

captureSnapshots().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
