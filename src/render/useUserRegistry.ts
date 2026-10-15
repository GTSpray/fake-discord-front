import { createContext, useContext } from 'react';
import type { MentionableUser } from '../lib/types.ts';

export const UserRegistryContext = createContext<Map<string, MentionableUser>>(new Map());

export function useUserRegistry(): Map<string, MentionableUser> {
  return useContext(UserRegistryContext);
}
