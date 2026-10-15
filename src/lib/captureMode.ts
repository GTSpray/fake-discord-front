/** True when Playwright hashes per-step PNGs (`?capture_steps=1`). */
export function isCaptureStepsMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('capture_steps') === '1';
}
