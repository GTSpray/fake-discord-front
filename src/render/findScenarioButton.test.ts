import { beforeEach, describe, expect, it } from 'vitest';
import { buttonCenter, findScenarioButtonRect } from './findScenarioButton.ts';

describe('findScenarioButton', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('finds a button by data-scenario-button-label', () => {
    const button = document.createElement('discord-button');
    button.setAttribute('data-scenario-button-label', 'Valider');
    button.getBoundingClientRect = () => new DOMRect(10, 20, 100, 40);
    document.body.append(button);

    expect(findScenarioButtonRect('Valider')).toEqual(new DOMRect(10, 20, 100, 40));
  });

  it('falls back to visible text content', () => {
    const button = document.createElement('discord-button');
    button.textContent = '  Publier  ';
    button.getBoundingClientRect = () => new DOMRect(0, 0, 80, 32);
    document.body.append(button);

    expect(findScenarioButtonRect('Publier')).toEqual(new DOMRect(0, 0, 80, 32));
  });

  it('returns null when no button matches', () => {
    expect(findScenarioButtonRect('Missing')).toBeNull();
  });

  it('computes button center coordinates', () => {
    expect(buttonCenter(new DOMRect(10, 20, 100, 40))).toEqual({ x: 60, y: 40 });
  });
});
