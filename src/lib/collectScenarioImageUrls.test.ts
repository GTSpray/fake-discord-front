import { describe, expect, it } from 'vitest';
import { makeScenario } from '../test/scenarioFixtures.ts';
import { collectScenarioImageUrls } from './collectScenarioImageUrls.ts';
import { ComponentType, VIEWER_DEFAULT_AVATAR } from './types.ts';

describe('collectScenarioImageUrls', () => {
  it('collects chrome and message avatar URLs', () => {
    const scenario = makeScenario(
      [
        {
          type: 'pressEnter',
          userMessage: {
            author: { name: 'Alice', avatarUrl: 'https://cdn.example/alice.png' },
            content: 'hello',
          },
        },
      ],
      {
        chrome: {
          guild: { name: 'G', iconUrl: 'https://cdn.example/guild.png' },
          channel: { name: 'c' },
          viewer: { name: 'Alice', avatarUrl: 'https://cdn.example/viewer.png' },
        },
      },
    );

    const urls = collectScenarioImageUrls(scenario);

    expect(urls).toContain('https://cdn.example/guild.png');
    expect(urls).toContain('https://cdn.example/viewer.png');
    expect(urls).toContain('https://cdn.example/alice.png');
  });

  it('ignores non-http avatar paths such as bundled defaults', () => {
    const scenario = makeScenario([{ type: 'wait', ms: 1 }]);
    const urls = collectScenarioImageUrls(scenario);

    expect(urls.every((url) => url.startsWith('http'))).toBe(true);
    expect(urls).not.toContain(VIEWER_DEFAULT_AVATAR);
  });

  it('collects CV2 thumbnail and media gallery URLs from applyState', () => {
    const scenario = makeScenario([
      {
        type: 'applyState',
        layers: {
          messages: [
            {
              author: { name: 'Bot', bot: true },
              interaction: {
                type: 4,
                data: {
                  components: [
                    {
                      type: ComponentType.Thumbnail,
                      media: { url: 'https://cdn.example/thumb.png' },
                    },
                    {
                      type: ComponentType.MediaGallery,
                      items: [{ media: { url: 'https://cdn.example/gallery.png' } }],
                    },
                  ],
                },
              },
            },
          ],
        },
      },
    ]);

    expect(collectScenarioImageUrls(scenario)).toEqual(
      expect.arrayContaining(['https://cdn.example/thumb.png', 'https://cdn.example/gallery.png']),
    );
  });

  it('collects top-level custom emoji URLs', () => {
    const scenario = makeScenario([{ type: 'wait', ms: 1 }], {
      emojis: [
        {
          id: '1',
          name: 'party',
          url: 'https://cdn.example/party.gif',
          animated: true,
        },
      ],
    });

    expect(collectScenarioImageUrls(scenario)).toContain('https://cdn.example/party.gif');
  });
});
