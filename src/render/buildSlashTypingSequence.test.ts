import { describe, expect, it } from 'vitest';
import { buildSlashTypingSequence } from './buildSlashTypingSequence.ts';

describe('buildSlashTypingSequence', () => {
  it('returns only onComplete when from equals to', () => {
    const sequence = buildSlashTypingSequence({
      id: 1,
      from: '/poll',
      to: '/poll',
      msPerChar: 50,
    });

    expect(sequence).toHaveLength(1);
    expect(typeof sequence[0]).toBe('function');
  });

  it('types from prefix to full string when reveal is not configured', () => {
    const sequence = buildSlashTypingSequence({
      id: 1,
      from: '/poll',
      to: '/poll create',
      msPerChar: 50,
    });

    expect(sequence).toEqual(['/poll', '/poll create', expect.any(Function)]);
  });

  it('inserts reveal callback when revealAfter matches mid-string', () => {
    const sequence = buildSlashTypingSequence({
      id: 1,
      from: '/poll',
      to: '/poll create',
      msPerChar: 50,
      revealAfter: '/poll ',
    });

    expect(sequence).toEqual([
      '/poll',
      '/poll ',
      expect.any(Function),
      '/poll create',
      expect.any(Function),
    ]);
  });

  it('types the full string when from is empty', () => {
    const sequence = buildSlashTypingSequence({
      id: 1,
      from: '',
      to: '/poll',
      msPerChar: 50,
    });

    expect(sequence).toEqual(['/poll', expect.any(Function)]);
  });
});
