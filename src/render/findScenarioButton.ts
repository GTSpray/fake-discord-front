/** Locate a Skyra discord-button by its visible label (scenario click targets). */
export function findScenarioButtonRect(label: string): DOMRect | null {
  const normalized = label.trim();

  for (const host of document.querySelectorAll('discord-button')) {
    const attr = host.getAttribute('data-scenario-button-label');
    if (attr === normalized) {
      return host.getBoundingClientRect();
    }
  }

  for (const host of document.querySelectorAll('discord-button')) {
    const text = host.textContent?.replace(/\s+/g, ' ').trim();
    if (text === normalized) {
      return host.getBoundingClientRect();
    }
  }

  return null;
}

export function buttonCenter(rect: DOMRect): { x: number; y: number } {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}
