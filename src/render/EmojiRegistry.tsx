import { useMemo, type ReactNode } from 'react';
import { indexEmojisById } from '../lib/emojiResolve.ts';
import type { CustomEmoji } from '../lib/types.ts';
import { EmojiRegistryContext } from './useEmojiRegistry.ts';

export function EmojiRegistryProvider({
  emojis,
  children,
}: {
  emojis: CustomEmoji[];
  children: ReactNode;
}) {
  const byId = useMemo(() => indexEmojisById(emojis), [emojis]);
  return <EmojiRegistryContext.Provider value={byId}>{children}</EmojiRegistryContext.Provider>;
}
