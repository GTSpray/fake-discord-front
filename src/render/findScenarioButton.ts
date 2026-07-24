const LOOKUP_RETRY_MS = 50;
const LOOKUP_MAX_ATTEMPTS = 40;

/** Sentinel `cursorTarget` for the Skyra modal Submit button. */
export const CURSOR_TARGET_MODAL_SUBMIT = '__modalSubmit';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isValidRect(rect: DOMRect): boolean {
  return rect.width > 0 && rect.height > 0;
}

function captureRoot(): Document | Element {
  return document.querySelector('[data-capture-root]') ?? document;
}

function queryDeep(tagName: string, root: Document | Element = captureRoot()): Element[] {
  const results: Element[] = [];
  const lowerTag = tagName.toLowerCase();

  const walk = (node: Document | ShadowRoot | Element) => {
    for (const el of node.querySelectorAll(tagName)) {
      if (el.tagName.toLowerCase() === lowerTag) results.push(el);
    }
    for (const el of node.querySelectorAll('*')) {
      if (el.shadowRoot) walk(el.shadowRoot);
    }
  };

  walk(root);

  return results;
}

function measureElementRect(element: HTMLElement): DOMRect | null {
  void element.offsetHeight;
  const rect = element.getBoundingClientRect();
  if (isValidRect(rect)) return rect;

  const clientRect = element.getClientRects()[0];
  if (clientRect && isValidRect(clientRect)) return clientRect;

  if (element.offsetWidth > 0 && element.offsetHeight > 0) {
    return new DOMRect(rect.x, rect.y, element.offsetWidth, element.offsetHeight);
  }

  return null;
}

function measureScenarioButtonHost(host: Element): DOMRect | null {
  const shadow = host.shadowRoot;
  const interactive = shadow?.querySelector('button, a');
  if (interactive instanceof HTMLElement) {
    const innerRect = measureElementRect(interactive);
    if (innerRect) return innerRect;
  }

  if (host instanceof HTMLElement) {
    return measureElementRect(host);
  }

  const hostRect = host.getBoundingClientRect();
  return isValidRect(hostRect) ? hostRect : null;
}

function hostMatchesLabel(host: Element, normalized: string): boolean {
  const attr = host.getAttribute('data-scenario-button-label');
  if (attr === normalized) return true;

  const text = host.textContent?.replace(/\s+/g, ' ').trim();
  return text === normalized;
}

function findMatchingButtonHosts(label: string): Element[] {
  const normalized = label.trim();
  return queryDeep('discord-button').filter((host) => hostMatchesLabel(host, normalized));
}

function pickBestButtonRect(candidates: Element[]): DOMRect | null {
  let best: { rect: DOMRect; score: number } | null = null;

  for (const host of candidates) {
    const rect = measureScenarioButtonHost(host);
    if (!rect) continue;

    const score = rect.width * rect.height + rect.top;
    if (!best || score > best.score) {
      best = { rect, score };
    }
  }

  return best?.rect ?? null;
}

/** Locate a Skyra discord-button by its visible label (scenario click targets). */
export function findScenarioButtonRect(label: string): DOMRect | null {
  return pickBestButtonRect(findMatchingButtonHosts(label));
}

function findModalSubmitButtons(): HTMLElement[] {
  const results: HTMLElement[] = [];

  // ModalOverlay portals to document.body, outside [data-capture-root].
  for (const host of queryDeep('discord-modal', document)) {
    const submit = host.shadowRoot?.querySelector('.discord-modal-button-submit');
    if (submit instanceof HTMLElement) results.push(submit);
  }

  return results;
}

/** Locate the Skyra modal Submit control inside the open modal shadow root. */
export function findModalSubmitRect(): DOMRect | null {
  let best: { rect: DOMRect; score: number } | null = null;

  for (const button of findModalSubmitButtons()) {
    const rect = measureElementRect(button);
    if (!rect) continue;

    const score = rect.width * rect.height + rect.top;
    if (!best || score > best.score) {
      best = { rect, score };
    }
  }

  return best?.rect ?? null;
}

/** Resolve any scenario cursor target (channel button label or modal Submit). */
export function findScenarioClickTargetRect(target: string): DOMRect | null {
  if (target === CURSOR_TARGET_MODAL_SUBMIT) return findModalSubmitRect();
  return findScenarioButtonRect(target);
}

export async function waitForScenarioButtonRect(
  label: string,
  timeoutMs = LOOKUP_MAX_ATTEMPTS * LOOKUP_RETRY_MS,
): Promise<DOMRect | null> {
  return waitForScenarioClickTargetRect(label, timeoutMs);
}

export async function waitForScenarioClickTargetRect(
  target: string,
  timeoutMs = LOOKUP_MAX_ATTEMPTS * LOOKUP_RETRY_MS,
): Promise<DOMRect | null> {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    const rect = findScenarioClickTargetRect(target);
    if (rect) return rect;
    await sleep(LOOKUP_RETRY_MS);
  }

  return null;
}

export function buttonCenter(rect: DOMRect): { x: number; y: number } {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}
