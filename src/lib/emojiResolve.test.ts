import { describe, expect, it } from 'vitest';
import { indexEmojisById } from './emojiResolve.ts';
import { renderMarkdown } from '../render/markdown.tsx';
import type { CustomEmoji } from './types.ts';

const emojis: CustomEmoji[] = [
  {
    id: '861449',
    name: 'shutseagullmeme',
    url: 'https://cdn.example/shutseagullmeme.png',
    animated: true,
  },
  {
    id: '238528',
    name: 'imout',
    url: 'https://cdn.example/imout.png',
  },
];

describe('renderMarkdown custom emoji', () => {
  it('resolves <:name:id> and <a:name:id> via the emoji map', () => {
    const byId = indexEmojisById(emojis);
    const html = renderMarkdown('gg <a:shutseagullmeme:861449> + <a:imout:238528>', byId);

    expect(html).toContain('src="https://cdn.example/shutseagullmeme.png"');
    expect(html).toContain('alt=":shutseagullmeme:"');
    expect(html).toContain('src="https://cdn.example/imout.png"');
    expect(html).toContain('class="md-custom-emoji"');
  });

  it('falls back to :name: when the id is unknown', () => {
    const html = renderMarkdown('hi <:missing:999>', indexEmojisById(emojis));
    expect(html).toContain(':missing:');
    expect(html).not.toContain('md-custom-emoji');
  });

  it('still formats mentions and bold around emojis', () => {
    const html = renderMarkdown('**gg** <@123> <a:imout:238528>', indexEmojisById(emojis));
    expect(html).toContain('<strong>gg</strong>');
    expect(html).toContain('md-user-mention');
    expect(html).toContain('src="https://cdn.example/imout.png"');
  });
});
