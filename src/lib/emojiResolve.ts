import type { CustomEmoji, MessageReaction } from './types.ts';

const CUSTOM_EMOJI_MENTION = /^<(a?):([a-zA-Z0-9_]+):(\d+)>$/;

const TWEMOJI_CDN = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72';

export interface ResolvedMessageReaction {
  url: string;
  name: string;
  count: number;
  reacted: boolean;
}

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

/** Convert a unicode emoji string to a Twemoji PNG URL. */
export function twemojiUrl(emoji: string): string {
  const codepoints = toCodePoints(emoji);
  return `${TWEMOJI_CDN}/${codepoints}.png`;
}

function toCodePoints(emoji: string): string {
  const points: string[] = [];
  for (const char of emoji) {
    const cp = char.codePointAt(0);
    if (cp === undefined) continue;
    // Twemoji omits U+FE0F variation selector in filenames
    if (cp === 0xfe0f) continue;
    points.push(cp.toString(16));
  }
  return points.join('-');
}

/**
 * Resolve a reaction emoji string to an image URL + display name.
 * Returns null when a custom mention cannot be found in the registry.
 */
export function resolveReactionEmoji(
  emoji: string,
  emojiById: Map<string, CustomEmoji> = new Map(),
): { url: string; name: string } | null {
  const custom = CUSTOM_EMOJI_MENTION.exec(emoji);
  if (custom) {
    const name = custom[2];
    const id = custom[3];
    const resolved = emojiById.get(id);
    if (!resolved) return null;
    return { url: resolved.url, name: `:${resolved.name}:` };
  }

  return { url: twemojiUrl(emoji), name: emoji };
}

/** Resolve scenario reactions for Skyra DiscordReaction props. Skips unresolved custom emotes. */
export function resolveMessageReactions(
  reactions: MessageReaction[] | undefined,
  emojiById: Map<string, CustomEmoji> = new Map(),
): ResolvedMessageReaction[] {
  if (!reactions?.length) return [];

  const out: ResolvedMessageReaction[] = [];
  for (const reaction of reactions) {
    const resolved = resolveReactionEmoji(reaction.emoji, emojiById);
    if (!resolved) continue;
    out.push({
      url: resolved.url,
      name: resolved.name,
      count: reaction.count ?? 1,
      reacted: reaction.reacted ?? false,
    });
  }
  return out;
}
