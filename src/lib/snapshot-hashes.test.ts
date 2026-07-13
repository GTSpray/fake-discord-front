import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  diffHashes,
  hasHashDiff,
  hashSnapshotFiles,
  md5File,
} from '../../scripts/snapshot-hashes.mjs';

describe('snapshot-hashes', () => {
  it('computes a stable md5 for a file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'snapshot-hash-'));
    const filePath = join(dir, 'sample.png');
    writeFileSync(filePath, 'hello');

    expect(md5File(filePath)).toBe('5d41402abc4b2a76b9719d911017c592');
  });

  it('hashes only png and webm files in a directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'snapshot-hash-'));
    writeFileSync(join(dir, 'a.png'), 'png');
    writeFileSync(join(dir, 'b.webm'), 'webm');
    writeFileSync(join(dir, 'manifest.json'), '{}');
    writeFileSync(join(dir, 'notes.txt'), 'ignore');

    expect(Object.keys(hashSnapshotFiles(dir)).sort()).toEqual(['a.png', 'b.webm']);
  });

  it('detects added, changed, removed and unchanged files', () => {
    const previous = {
      'same.png': '111',
      'old.png': '222',
    };
    const current = {
      'same.png': '111',
      'old.png': '333',
      'new.png': '444',
    };

    const diff = diffHashes(previous, current);

    expect(diff.unchanged).toEqual([{ name: 'same.png', hash: '111' }]);
    expect(diff.changed).toEqual([{ name: 'old.png', previous: '222', current: '333' }]);
    expect(diff.added).toEqual([{ name: 'new.png', hash: '444' }]);
    expect(diff.removed).toEqual([]);
    expect(hasHashDiff(diff)).toBe(true);
  });
});
