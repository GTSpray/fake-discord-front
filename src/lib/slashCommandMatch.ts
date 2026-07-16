import type { SlashSuggestion } from './types.ts';

/** Afficher l’autocomplétion dès le « / ». */
export const SLASH_COMMAND_MATCH_CHARS = 0;

export function slashQueryLength(input: string): number {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return 0;
  return trimmed.length - 1;
}

export function commandMatchRevealAfter(from: string, to: string): string | undefined {
  if (slashQueryLength(to) < SLASH_COMMAND_MATCH_CHARS) return undefined;
  if (slashQueryLength(from) >= SLASH_COMMAND_MATCH_CHARS && from.startsWith('/')) {
    return undefined;
  }

  for (let i = 1; i <= to.length; i++) {
    const prefix = to.slice(0, i);
    if (slashQueryLength(prefix) >= SLASH_COMMAND_MATCH_CHARS && prefix.startsWith('/')) {
      return prefix;
    }
  }

  return undefined;
}

export function filterSlashCommandMatches(
  input: string,
  pool: SlashSuggestion[],
): SlashSuggestion[] {
  const query = input.trim().toLowerCase();
  if (!query.startsWith('/')) return [];
  if (slashQueryLength(query) < SLASH_COMMAND_MATCH_CHARS) return [];
  return pool.filter((command) => command.name.toLowerCase().startsWith(query));
}

export function splitMatchedCommandName(
  name: string,
  query: string,
): { matched: string; rest: string } {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedName = name.toLowerCase();

  if (!normalizedQuery || !normalizedName.startsWith(normalizedQuery)) {
    return { matched: '', rest: name };
  }

  const matchLength = normalizedQuery.length;
  return {
    matched: name.slice(0, matchLength),
    rest: name.slice(matchLength),
  };
}

export function isFullSlashCommandMatch(input: string, suggestions?: SlashSuggestion[]): boolean {
  return resolveExactSlashCommandMatch(input, suggestions) !== undefined;
}

export function splitSlashInputCommand(
  input: string,
  suggestions?: SlashSuggestion[],
): { matched: string; rest: string; isFullMatch: boolean } {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) {
    return { matched: trimmed, rest: '', isFullMatch: false };
  }

  const exact = resolveExactSlashCommandMatch(trimmed, suggestions);
  if (exact) {
    return {
      matched: exact.name,
      rest: trimmed.slice(exact.name.length),
      isFullMatch: true,
    };
  }

  return { matched: trimmed, rest: '', isFullMatch: false };
}

export function resolveExactSlashCommandMatch(
  input: string,
  pool?: SlashSuggestion[],
): SlashSuggestion | undefined {
  if (!pool?.length) return undefined;
  const query = input.trim().toLowerCase();
  return pool.find((command) => command.name.toLowerCase() === query);
}

export function resolveActiveCommandMatchIndex(
  input: string,
  matches: SlashSuggestion[],
  preferred?: number,
): number {
  if (!matches.length) return 0;

  if (preferred !== undefined) {
    return Math.min(Math.max(preferred, 0), matches.length - 1);
  }

  const query = input.trim().toLowerCase();
  const exact = matches.findIndex((command) => command.name.toLowerCase() === query);
  if (exact >= 0) return exact;

  return 0;
}

export interface ResolvedCommandMatchSuggestions {
  suggestions: SlashSuggestion[];
  mode: 'commandMatch';
  activeIndex: number;
}

export function resolveCommandMatchSuggestions(
  input: string,
  pool: SlashSuggestion[],
  preferredActive?: number,
): ResolvedCommandMatchSuggestions | undefined {
  const suggestions = filterSlashCommandMatches(input, pool);
  if (!suggestions.length) return undefined;

  return {
    suggestions,
    mode: 'commandMatch',
    activeIndex: resolveActiveCommandMatchIndex(input, suggestions, preferredActive),
  };
}
