import type { CustomEmoji } from './types.ts';

export function indexEmojisById(emojis: CustomEmoji[] | undefined): Map<string, CustomEmoji> {
  const map = new Map<string, CustomEmoji>();
  for (const emoji of emojis ?? []) {
    map.set(emoji.id, emoji);
  }
  return map;
}

export function resolveScenarioEmojis(emojis: CustomEmoji[] | undefined): CustomEmoji[] {
  return emojis ?? [];
}
