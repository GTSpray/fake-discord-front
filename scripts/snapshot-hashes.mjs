import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export const SNAPSHOT_FILENAME = 'snapshot.json';
const SNAPSHOT_VIDEO_FILE = /^[a-z0-9][a-z0-9-]*\.webm$/i;

export function isSnapshotVideoArtifact(name) {
  return SNAPSHOT_VIDEO_FILE.test(name);
}

export function listSnapshotVideos(snapshotsDir) {
  return readdirSync(snapshotsDir)
    .filter((name) => isSnapshotVideoArtifact(name))
    .sort();
}

export function md5File(filePath) {
  const hash = createHash('md5');
  hash.update(readFileSync(filePath));
  return hash.digest('hex');
}

export function loadSnapshot(snapshotPath) {
  if (!existsSync(snapshotPath)) return null;

  const raw = JSON.parse(readFileSync(snapshotPath, 'utf8'));
  if (!raw?.scenarios || typeof raw.scenarios !== 'object') {
    throw new Error(`Invalid snapshot file: ${snapshotPath}`);
  }

  return raw;
}

export function writeSnapshot(snapshotPath, scenarios) {
  const payload = {
    algorithm: 'md5',
    artifact: 'step-png',
    scenarios,
  };
  writeFileSync(snapshotPath, `${JSON.stringify(payload, null, 2)}\n`);
}

export function diffHashes(previousFiles, currentFiles) {
  const unchanged = [];
  const changed = [];
  const added = [];
  const removed = [];

  for (const [name, hash] of Object.entries(currentFiles)) {
    if (!(name in previousFiles)) {
      added.push({ name, hash });
      continue;
    }
    if (previousFiles[name] !== hash) {
      changed.push({ name, previous: previousFiles[name], current: hash });
      continue;
    }
    unchanged.push({ name, hash });
  }

  for (const name of Object.keys(previousFiles)) {
    if (!(name in currentFiles)) {
      removed.push({ name, hash: previousFiles[name] });
    }
  }

  return { unchanged, changed, added, removed };
}

export function hasHashDiff(diff) {
  return diff.changed.length > 0 || diff.added.length > 0 || diff.removed.length > 0;
}

export function expectedSnapshotArtifacts(scenarioIds) {
  return scenarioIds.map((id) => `${id}.webm`);
}

export function findMissingArtifacts(expectedNames, availableNames) {
  const available = new Set(availableNames);
  return expectedNames.filter((name) => !available.has(name));
}

export function printMissingArtifacts(missing, { root, snapshotsDir }) {
  const rel = (name) => relative(root, join(snapshotsDir, name));
  console.log('\nSnapshots manquants:');
  for (const name of missing) {
    console.log(`  ! ${rel(name)}`);
  }
}

export function printHashDiff(diff) {
  if (!hasHashDiff(diff)) {
    console.log('\nSnapshot MD5 (step PNG): aucune évolution détectée.');
    for (const { name, hash } of diff.unchanged) {
      console.log(`  = ${name}  ${hash}`);
    }
    return;
  }

  console.log('\nSnapshot MD5 (step PNG): évolution détectée.');

  for (const { name, hash } of diff.unchanged) {
    console.log(`  = ${name}  ${hash}`);
  }
  for (const { name, hash } of diff.added) {
    console.log(`  + ${name}  ${hash}`);
  }
  for (const { name, previous, current } of diff.changed) {
    console.log(`  ~ ${name}`);
    console.log(`      was ${previous}`);
    console.log(`      now ${current}`);
  }
  for (const { name, hash } of diff.removed) {
    console.log(`  - ${name}  ${hash}`);
  }
}

export function flattenScenarioStepHashes(scenarios) {
  const flat = {};
  for (const [scenarioId, data] of Object.entries(scenarios)) {
    const steps = data?.steps ?? {};
    for (const [stepKey, hash] of Object.entries(steps)) {
      flat[`${scenarioId}#${stepKey}`] = hash;
    }
  }
  return flat;
}

export function validateSnapshotCoverage(scenarioIds, scenarios) {
  const missing = [];
  for (const id of scenarioIds) {
    const stepEntries = Object.entries(scenarios?.[id]?.steps ?? {});
    if (stepEntries.length === 0) {
      missing.push(id);
    }
  }
  return missing;
}

/** Scenario ids whose step hashes changed, were added, or were removed. */
export function listEvolvedScenarioIds(previousScenarios, currentScenarios) {
  const previous = previousScenarios ?? {};
  const current = currentScenarios ?? {};
  const previousHashes = flattenScenarioStepHashes(previous);
  const currentHashes = flattenScenarioStepHashes(current);
  const diff = diffHashes(previousHashes, currentHashes);
  const evolved = new Set();

  for (const { name } of [...diff.changed, ...diff.added, ...diff.removed]) {
    evolved.add(name.split('#')[0]);
  }
  for (const id of Object.keys(current)) {
    if (!(id in previous)) evolved.add(id);
  }
  for (const id of Object.keys(previous)) {
    if (!(id in current)) evolved.add(id);
  }

  return [...evolved].sort();
}
