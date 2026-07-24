import { createContext, useContext } from 'react';
import type { CustomEmoji } from '../lib/types.ts';

export const EmojiRegistryContext = createContext<Map<string, CustomEmoji>>(new Map());

export function useEmojiRegistry(): Map<string, CustomEmoji> {
  return useContext(EmojiRegistryContext);
}
