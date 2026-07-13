import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export const MANIFEST_FILENAME = 'manifest.json';
const SNAPSHOT_EXT = /\.(png|webm)$/i;

export function md5File(filePath) {
  const hash = createHash('md5');
  hash.update(readFileSync(filePath));
  return hash.digest('hex');
}

export function hashSnapshotFiles(snapshotsDir) {
  const files = {};

  for (const name of readdirSync(snapshotsDir).sort()) {
    if (!SNAPSHOT_EXT.test(name)) continue;
    files[name] = md5File(join(snapshotsDir, name));
  }

  return files;
}

export function loadManifest(manifestPath) {
  if (!existsSync(manifestPath)) return null;

  const raw = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (!raw?.files || typeof raw.files !== 'object') {
    throw new Error(`Invalid snapshot manifest: ${manifestPath}`);
  }

  return raw;
}

export function writeManifest(manifestPath, files) {
  const payload = {
    algorithm: 'md5',
    files,
  };
  writeFileSync(manifestPath, `${JSON.stringify(payload, null, 2)}\n`);
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

export function printHashDiff(diff, { root, snapshotsDir }) {
  const rel = (name) => relative(root, join(snapshotsDir, name));

  if (!hasHashDiff(diff)) {
    console.log('\nSnapshot MD5: aucune évolution détectée.');
    for (const { name, hash } of diff.unchanged) {
      console.log(`  = ${rel(name)}  ${hash}`);
    }
    return;
  }

  console.log('\nSnapshot MD5: évolution détectée.');

  for (const { name, hash } of diff.unchanged) {
    console.log(`  = ${rel(name)}  ${hash}`);
  }
  for (const { name, hash } of diff.added) {
    console.log(`  + ${rel(name)}  ${hash}`);
  }
  for (const { name, previous, current } of diff.changed) {
    console.log(`  ~ ${rel(name)}`);
    console.log(`      was ${previous}`);
    console.log(`      now ${current}`);
  }
  for (const { name, hash } of diff.removed) {
    console.log(`  - ${rel(name)}  ${hash}`);
  }
}
