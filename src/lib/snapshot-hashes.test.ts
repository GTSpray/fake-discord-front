import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  diffHashes,
  expectedSnapshotArtifacts,
  findMissingArtifacts,
  flattenScenarioStepHashes,
  hasHashDiff,
  listSnapshotVideos,
  md5File,
  validateSnapshotCoverage,
} from '../../scripts/snapshot-hashes.mjs';

describe('snapshot-hashes', () => {
  it('computes a stable md5 for a file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'snapshot-hash-'));
    const filePath = join(dir, 'sample.png');
    writeFileSync(filePath, 'hello');

    expect(md5File(filePath)).toBe('5d41402abc4b2a76b9719d911017c592');
  });

  it('lists only webm videos in snapshot directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'snapshot-hash-'));
    writeFileSync(join(dir, 'a.webm'), 'webm');
    writeFileSync(join(dir, 'a.png'), 'png');
    writeFileSync(join(dir, 'manifest.json'), '{}');

    expect(listSnapshotVideos(dir)).toEqual(['a.webm']);
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

  it('lists missing snapshot artifacts for examples', () => {
    const expected = expectedSnapshotArtifacts(['say-hello-flow', 'gimme-otter']);
    const missing = findMissingArtifacts(expected, ['gimme-otter.webm']);

    expect(missing).toEqual(['say-hello-flow.webm']);
  });

  it('flattens scenario step hashes', () => {
    const flat = flattenScenarioStepHashes({
      alpha: { steps: { '000-playing': 'aaa', '001-done': 'bbb' } },
    });
    expect(flat).toEqual({
      'alpha#000-playing': 'aaa',
      'alpha#001-done': 'bbb',
    });
  });

  it('detects scenarios without step coverage', () => {
    const missing = validateSnapshotCoverage(['a', 'b'], {
      a: { steps: { '000-playing': 'aaa' } },
      b: { steps: {} },
    });
    expect(missing).toEqual(['b']);
  });
});
