import { describe, expect, it } from 'vitest';
import {
  SLASH_COMMAND_MATCH_CHARS,
  commandMatchRevealAfter,
  filterSlashCommandMatches,
  resolveCommandMatchSuggestions,
  resolveExactSlashCommandMatch,
  slashQueryLength,
  splitMatchedCommandName,
  splitSlashInputCommand,
  isFullSlashCommandMatch,
} from './slashCommandMatch.ts';

const pool = [
  { name: '/alias ls', description: 'liste' },
  { name: '/alias say', description: 'say' },
  { name: '/alias set', description: 'set' },
  { name: '/poll create', description: 'poll' },
];

describe('slashCommandMatch', () => {
  it('counts characters after the slash', () => {
    expect(slashQueryLength('/')).toBe(0);
    expect(slashQueryLength('/a')).toBe(1);
    expect(slashQueryLength('/ali')).toBe(3);
  });

  it('filters from the slash character', () => {
    expect(filterSlashCommandMatches('/', pool)).toHaveLength(4);
    expect(filterSlashCommandMatches('/ali', pool)).toHaveLength(3);
    expect(filterSlashCommandMatches('/poll', pool)).toHaveLength(1);
  });

  it('reveals suggestions as soon as slash is typed', () => {
    expect(commandMatchRevealAfter('', '/')).toBe('/');
    expect(commandMatchRevealAfter('', '/alias set')).toBe('/');
    expect(commandMatchRevealAfter('/', '/a')).toBeUndefined();
    expect(SLASH_COMMAND_MATCH_CHARS).toBe(0);
  });

  it('splits matched command names for display', () => {
    expect(splitMatchedCommandName('/alias set', '/ali')).toEqual({
      matched: '/ali',
      rest: 'as set',
    });
    expect(splitSlashInputCommand('/ali', pool)).toEqual({
      matched: '/ali',
      rest: '',
      isFullMatch: false,
    });
    expect(splitSlashInputCommand('/alias set', pool)).toEqual({
      matched: '/alias set',
      rest: '',
      isFullMatch: true,
    });
    expect(isFullSlashCommandMatch('/alias set', pool)).toBe(true);
    expect(isFullSlashCommandMatch('/ali', pool)).toBe(false);
  });

  it('resolves exact slash command matches', () => {
    expect(resolveExactSlashCommandMatch('/alias set', pool)?.name).toBe('/alias set');
    expect(resolveExactSlashCommandMatch('/ali', pool)).toBeUndefined();
  });

  it('resolves the preferred active command index', () => {
    const resolved = resolveCommandMatchSuggestions('/ali', pool, 2);
    expect(resolved?.activeIndex).toBe(2);
  });
});
