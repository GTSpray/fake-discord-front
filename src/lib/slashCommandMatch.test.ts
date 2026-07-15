import { describe, expect, it } from 'vitest';
import {
  SLASH_COMMAND_MATCH_CHARS,
  commandMatchRevealAfter,
  filterSlashCommandMatches,
  resolveCommandMatchSuggestions,
  slashQueryLength,
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

  it('filters once three characters are typed after slash', () => {
    expect(filterSlashCommandMatches('/al', pool)).toEqual([]);
    expect(filterSlashCommandMatches('/ali', pool)).toHaveLength(3);
    expect(filterSlashCommandMatches('/poll', pool)).toHaveLength(1);
  });

  it('reveals suggestions at the third character during typing', () => {
    expect(commandMatchRevealAfter('', '/ali')).toBe('/ali');
    expect(commandMatchRevealAfter('', '/alias set')).toBe('/ali');
    expect(commandMatchRevealAfter('/ali', '/alias set')).toBeUndefined();
  });

  it('resolves the preferred active command index', () => {
    const resolved = resolveCommandMatchSuggestions('/ali', pool, 2);
    expect(resolved?.activeIndex).toBe(2);
    expect(SLASH_COMMAND_MATCH_CHARS).toBe(3);
  });
});
