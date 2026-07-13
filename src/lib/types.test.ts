import { describe, expect, it } from 'vitest';
import { DEFAULT_VIEWER, resolveViewer, VIEWER_DEFAULT_AVATAR } from './types.ts';

describe('resolveViewer', () => {
  it('uses defaults when viewer is omitted', () => {
    expect(
      resolveViewer({
        guild: { name: 'G' },
        channel: { name: 'c' },
      }),
    ).toEqual({
      name: DEFAULT_VIEWER.name,
      status: DEFAULT_VIEWER.status,
      avatarUrl: undefined,
    });
  });

  it('merges viewer overrides', () => {
    expect(
      resolveViewer({
        guild: { name: 'G' },
        channel: { name: 'c' },
        viewer: {
          name: 'Modo',
          status: 'Idle',
          avatarUrl: 'https://example.com/avatar.png',
        },
      }),
    ).toEqual({
      name: 'Modo',
      status: 'Idle',
      avatarUrl: 'https://example.com/avatar.png',
    });
  });

  it('exposes a bundled default avatar asset', () => {
    expect(VIEWER_DEFAULT_AVATAR).toBeTruthy();
  });
});
