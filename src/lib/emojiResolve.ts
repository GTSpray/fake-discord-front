import type { CustomEmoji } from './types.ts';

/** Discord custom emoji mention: <:name:id> or <a:name:id> */
export const CUSTOM_EMOJI_MENTION_RE = /<(a?):([a-zA-Z0-9_]{2,32}):(\d+)>/g;

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
