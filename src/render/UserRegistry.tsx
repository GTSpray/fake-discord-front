import { useMemo, type ReactNode } from 'react';
import { indexUsersById } from '../lib/userResolve.ts';
import type { MentionableUser } from '../lib/types.ts';
import { UserRegistryContext } from './useUserRegistry.ts';

export function UserRegistryProvider({
  users,
  children,
}: {
  users: MentionableUser[];
  children: ReactNode;
}) {
  const byId = useMemo(() => indexUsersById(users), [users]);
  return <UserRegistryContext.Provider value={byId}>{children}</UserRegistryContext.Provider>;
}
