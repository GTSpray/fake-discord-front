import { describe, expect, it } from 'vitest';
import type { MentionableUser } from './types.ts';
import { indexUsersById, resolveScenarioUsers } from './userResolve.ts';

const users: MentionableUser[] = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Arthur' },
];

describe('indexUsersById', () => {
  it('indexes users by id', () => {
    const byId = indexUsersById(users);
    expect(byId.get('1')?.name).toBe('Alice');
    expect(byId.get('2')?.name).toBe('Arthur');
  });

  it('returns an empty map when users is undefined', () => {
    expect(indexUsersById(undefined).size).toBe(0);
  });
});

describe('resolveScenarioUsers', () => {
  it('returns the list or an empty array', () => {
    expect(resolveScenarioUsers(users)).toEqual(users);
    expect(resolveScenarioUsers(undefined)).toEqual([]);
  });
});
