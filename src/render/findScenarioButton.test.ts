import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buttonCenter,
  findScenarioButtonRect,
  waitForScenarioButtonRect,
} from './findScenarioButton.ts';

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

  it('uses interactive element rect from shadow DOM when available', () => {
    const host = document.createElement('discord-button');
    host.setAttribute('data-scenario-button-label', 'Valider');
    host.getBoundingClientRect = () => new DOMRect(0, 0, 20, 20);

    const shadow = host.attachShadow({ mode: 'open' });
    const innerButton = document.createElement('button');
    innerButton.getBoundingClientRect = () => new DOMRect(120, 300, 100, 40);
    shadow.append(innerButton);

    document.body.append(host);

    expect(findScenarioButtonRect('Valider')).toEqual(new DOMRect(120, 300, 100, 40));
  });

  it('falls back to host rect when shadow DOM inner element has zero size', () => {
    const host = document.createElement('discord-button');
    host.setAttribute('data-scenario-button-label', 'Publier');
    host.getBoundingClientRect = () => new DOMRect(50, 200, 100, 40);

    const shadow = host.attachShadow({ mode: 'open' });
    const innerButton = document.createElement('button');
    innerButton.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0);
    shadow.append(innerButton);

    document.body.append(host);

    expect(findScenarioButtonRect('Publier')).toEqual(new DOMRect(50, 200, 100, 40));
  });

  it('finds buttons nested inside another shadow root', () => {
    const shell = document.createElement('div');
    const shellShadow = shell.attachShadow({ mode: 'open' });
    const host = document.createElement('discord-button');
    host.setAttribute('data-scenario-button-label', 'Valider');
    host.getBoundingClientRect = () => new DOMRect(300, 420, 120, 36);
    shellShadow.append(host);
    document.body.append(shell);

    expect(findScenarioButtonRect('Valider')).toEqual(new DOMRect(300, 420, 120, 36));
  });

  it('prefers the visible button when multiple hosts share the same label', () => {
    const hidden = document.createElement('discord-button');
    hidden.setAttribute('data-scenario-button-label', 'Valider');
    hidden.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0);

    const visible = document.createElement('discord-button');
    visible.setAttribute('data-scenario-button-label', 'Valider');
    visible.getBoundingClientRect = () => new DOMRect(120, 300, 100, 40);

    document.body.append(hidden, visible);

    expect(findScenarioButtonRect('Valider')).toEqual(new DOMRect(120, 300, 100, 40));
  });

  it('returns null when no button matches', () => {
    expect(findScenarioButtonRect('Missing')).toBeNull();
  });

  it('returns null when matching buttons have zero size', () => {
    const button = document.createElement('discord-button');
    button.setAttribute('data-scenario-button-label', 'Valider');
    button.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0);
    document.body.append(button);

    expect(findScenarioButtonRect('Valider')).toBeNull();
  });

  it('computes button center coordinates', () => {
    expect(buttonCenter(new DOMRect(10, 20, 100, 40))).toEqual({ x: 60, y: 40 });
  });

  it('waits until a button becomes measurable', async () => {
    vi.useFakeTimers();

    const host = document.createElement('discord-button');
    host.setAttribute('data-scenario-button-label', 'Valider');
    host.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0);
    document.body.append(host);

    const pending = waitForScenarioButtonRect('Valider', 500);

    await vi.advanceTimersByTimeAsync(120);
    host.getBoundingClientRect = () => new DOMRect(120, 300, 100, 40);

    await vi.advanceTimersByTimeAsync(50);
    await expect(pending).resolves.toEqual(new DOMRect(120, 300, 100, 40));

    vi.useRealTimers();
  }, 10_000);
});
