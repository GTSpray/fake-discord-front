import { describe, expect, it } from 'vitest';
import {
  indexEmojisById,
  resolveMessageReactions,
  resolveReactionEmoji,
  twemojiUrl,
} from './emojiResolve.ts';
import type { CustomEmoji } from './types.ts';

const customEmojis: CustomEmoji[] = [
  {
    id: '123456789',
    name: 'otter',
    url: 'https://cdn.example/otter.png',
  },
];

describe('twemojiUrl', () => {
  it('maps a simple unicode emoji to a Twemoji CDN URL', () => {
    expect(twemojiUrl('👍')).toBe(
      'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f44d.png',
    );
  });

  it('strips variation selectors from filenames', () => {
    expect(twemojiUrl('❤️')).toBe(
      'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2764.png',
    );
  });
});

describe('resolveReactionEmoji', () => {
  it('resolves unicode to Twemoji', () => {
    expect(resolveReactionEmoji('😂')).toEqual({
      url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f602.png',
      name: '😂',
    });
  });

  it('resolves custom mentions via the emoji registry', () => {
    const byId = indexEmojisById(customEmojis);
    expect(resolveReactionEmoji('<:otter:123456789>', byId)).toEqual({
      url: 'https://cdn.example/otter.png',
      name: ':otter:',
    });
  });

  it('returns null for unknown custom mentions', () => {
    expect(resolveReactionEmoji('<:missing:999>', indexEmojisById(customEmojis))).toBeNull();
  });
});

describe('resolveMessageReactions', () => {
  it('applies count and reacted defaults', () => {
    expect(resolveMessageReactions([{ emoji: '👍' }])).toEqual([
      {
        url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f44d.png',
        name: '👍',
        count: 1,
        reacted: false,
      },
    ]);
  });

  it('preserves count and reacted when set', () => {
    expect(resolveMessageReactions([{ emoji: '👍', count: 3, reacted: true }], new Map())).toEqual([
      {
        url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f44d.png',
        name: '👍',
        count: 3,
        reacted: true,
      },
    ]);
  });

  it('skips unresolved custom reactions', () => {
    expect(
      resolveMessageReactions(
        [{ emoji: '<:missing:1>' }, { emoji: '<:otter:123456789>', count: 2 }],
        indexEmojisById(customEmojis),
      ),
    ).toEqual([
      {
        url: 'https://cdn.example/otter.png',
        name: ':otter:',
        count: 2,
        reacted: false,
      },
    ]);
  });
});
