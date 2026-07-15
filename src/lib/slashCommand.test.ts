import { describe, expect, it } from 'vitest';
import { formatSlashInvocationCommand } from './slashCommand.ts';

describe('formatSlashInvocationCommand', () => {
  it('strips the leading slash from the command input', () => {
    expect(formatSlashInvocationCommand('/poll create')).toBe('poll create');
  });

  it('appends filled param values', () => {
    expect(
      formatSlashInvocationCommand('/alias set', [
        { name: 'alias', value: 'toto' },
        { name: 'message', value: 'Hello' },
      ]),
    ).toBe('alias set alias:toto message:Hello');
  });

  it('ignores empty param values', () => {
    expect(
      formatSlashInvocationCommand('/alias set', [
        { name: 'alias', value: 'toto' },
        { name: 'message' },
      ]),
    ).toBe('alias set alias:toto');
  });
});
