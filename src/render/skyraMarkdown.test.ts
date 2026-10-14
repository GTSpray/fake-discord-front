import { describe, expect, it } from 'vitest';
import { parseBlocks } from './parseSkyraBlocks.ts';
import { renderMarkdown } from './renderMarkdown.ts';

describe('parseBlocks', () => {
  it('keeps consecutive numbered items in one ordered list', () => {
    const content =
      "## Repas de fin d'année\n\n1. Quel jour ?\n    - mercredi\n    - jeudi\n    - vendredi\n2. avez vous des allergies";

    expect(parseBlocks(content)).toEqual([
      { kind: 'header', level: 2, text: "Repas de fin d'année" },
      {
        kind: 'ordered',
        start: 1,
        items: [
          {
            text: 'Quel jour ?',
            children: ['mercredi', 'jeudi', 'vendredi'],
          },
          { text: 'avez vous des allergies' },
        ],
      },
    ]);
  });

  it('keeps bold markers in paragraph text for inline markdown', () => {
    expect(parseBlocks('**Désactiver**\nQuel automatisme ?')).toEqual([
      { kind: 'paragraph', text: '**Désactiver**' },
      { kind: 'paragraph', text: 'Quel automatisme ?' },
    ]);
    expect(renderMarkdown('**Désactiver**')).toContain('<strong>Désactiver</strong>');
  });
});
