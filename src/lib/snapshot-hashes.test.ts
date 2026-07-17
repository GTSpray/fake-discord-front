import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  diffHashes,
  expectedSnapshotArtifacts,
  findMissingArtifacts,
  hasHashDiff,
  hashSnapshotFiles,
  listSnapshotArtifacts,
  md5File,
} from '../../scripts/snapshot-hashes.mjs';

describe('snapshot-hashes', () => {
  it('computes a stable md5 for a file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'snapshot-hash-'));
    const filePath = join(dir, 'sample.webm');
    writeFileSync(filePath, 'hello');

    expect(md5File(filePath)).toBe('5d41402abc4b2a76b9719d911017c592');
  });

  it('hashes only webm files in a directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'snapshot-hash-'));
    writeFileSync(join(dir, 'a.webm'), 'webm');
    writeFileSync(join(dir, 'a.png'), 'png');
    writeFileSync(join(dir, 'manifest.json'), '{}');

    expect(Object.keys(hashSnapshotFiles(dir)).sort()).toEqual(['a.webm']);
  });

  it('detects added, changed, removed and unchanged files', () => {
    const previous = {
      'same.webm': '111',
      'old.webm': '222',
    };
    const current = {
      'same.webm': '111',
      'old.webm': '333',
      'new.webm': '444',
    };

    const diff = diffHashes(previous, current);

    expect(diff.unchanged).toEqual([{ name: 'same.webm', hash: '111' }]);
    expect(diff.changed).toEqual([{ name: 'old.webm', previous: '222', current: '333' }]);
    expect(diff.added).toEqual([{ name: 'new.webm', hash: '444' }]);
    expect(diff.removed).toEqual([]);
    expect(hasHashDiff(diff)).toBe(true);
  });

  it('lists webm artifacts on disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'snapshot-hash-'));
    writeFileSync(join(dir, 'a.webm'), 'webm');
    writeFileSync(join(dir, 'a.png'), 'png');

    expect(listSnapshotArtifacts(dir)).toEqual(['a.webm']);
  });

  it('lists missing snapshot artifacts for examples', () => {
    const expected = expectedSnapshotArtifacts(['say-hello-flow', 'gimme-otter']);
    const missing = findMissingArtifacts(expected, ['gimme-otter.webm']);

    expect(missing).toEqual(['say-hello-flow.webm']);
  });
});
