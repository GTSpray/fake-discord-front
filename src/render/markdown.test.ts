import { describe, expect, it } from 'vitest';
import { indexEmojisById } from '../lib/emojiResolve.ts';
import type { CustomEmoji } from '../lib/types.ts';
import { renderMarkdown } from './renderMarkdown.ts';

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

describe('renderMarkdown', () => {
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

  it('formats mentions and bold around emojis', () => {
    const html = renderMarkdown('**gg** <@123> <a:imout:238528>', indexEmojisById(emojis));
    expect(html).toContain('<strong>gg</strong>');
    expect(html).toContain('md-user-mention');
    expect(html).toContain('src="https://cdn.example/imout.png"');
  });

  it('renders headings, subtext, underline and block quotes', () => {
    const html = renderMarkdown(
      [
        '# Compte rendu du vote',
        "## Repas de fin d'année",
        '### 1. Quel jour ?',
        '-# Votez pour la date',
        '__Réponse n°1:__',
        '> Non, aucune',
      ].join('\n'),
    );

    expect(html).toContain('<h1 class="md-h1">Compte rendu du vote</h1>');
    expect(html).toContain('<h2 class="md-h2">Repas de fin d\'année</h2>');
    expect(html).toContain('<h3 class="md-h3">1. Quel jour ?</h3>');
    expect(html).toContain('<span class="md-subtext">Votez pour la date</span>');
    expect(html).toContain('<u>Réponse n°1:</u>');
    expect(html).toContain('<blockquote class="md-quote">');
    expect(html).toContain('Non, aucune');
  });

  it('still renders a heading after a block quote', () => {
    const html = renderMarkdown('> quoted\n### After quote');
    expect(html).toContain('<blockquote class="md-quote">');
    expect(html).toContain('<h3 class="md-h3">After quote</h3>');
  });

  it('renders Discord-style unordered lists with nested circles', () => {
    const html = renderMarkdown('* This is another list\n* of stuff\n- and things');
    expect(html).toContain('<ul class="md-list">');
    expect(html).toContain('<li>This is another list</li>');
    expect(html).toContain('<li>of stuff</li>');
    expect(html).toContain('<li>and things</li>');
    expect(html).not.toContain('* This');
    expect(html).not.toContain('- and');
  });

  it('nests indented list items', () => {
    const html = renderMarkdown('- parent\n  - child\n  - child2');
    expect(html).toContain('<li>parent<ul class="md-list md-list--nested">');
    expect(html).toContain('<li>child</li>');
    expect(html).toContain('<li>child2</li>');
  });

  it('renders ordered lists', () => {
    const html = renderMarkdown('1. First\n2. Second');
    expect(html).toContain('<ol class="md-list">');
    expect(html).toContain('<li>First</li>');
    expect(html).toContain('<li>Second</li>');
  });

  it('keeps -# as subtext, not a list', () => {
    const html = renderMarkdown('-# not a bullet');
    expect(html).toContain('<span class="md-subtext">not a bullet</span>');
    expect(html).not.toContain('<ul');
  });
});
