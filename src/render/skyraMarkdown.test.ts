import { describe, expect, it } from 'vitest';
import { parseBlocks } from './skyraMarkdown.tsx';

describe('parseBlocks', () => {
  it('keeps consecutive numbered items in one ordered list', () => {
    const content =
      "## Repas de fin d'année\n\n1. Quel jour ?\n    - mercredi\n    - jeudi\n    - vendredi\n2. avez vous des alergenes";

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
          { text: 'avez vous des alergenes' },
        ],
      },
    ]);
  });
});
