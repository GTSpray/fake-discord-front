import type { MentionableUser } from './types.ts';

export function indexUsersById(users: MentionableUser[] | undefined): Map<string, MentionableUser> {
  const map = new Map<string, MentionableUser>();
  for (const user of users ?? []) {
    map.set(user.id, user);
  }
  return map;
}

export function resolveScenarioUsers(users: MentionableUser[] | undefined): MentionableUser[] {
  return users ?? [];
}
