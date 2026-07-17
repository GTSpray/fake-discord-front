/** Fixed clock for ?capture=1 — must stay in sync with scripts/capture-lib.mjs */
export const CAPTURE_FIXED_DATE_ISO = '2026-06-16T12:17:00.000Z';

export function installCaptureClock(): void {
  const params = new URLSearchParams(window.location.search);
  if (params.get('capture') !== '1') return;

  const fixedMs = Date.parse(CAPTURE_FIXED_DATE_ISO);

  class CaptureDate extends Date {
    constructor(...args: [] | ConstructorParameters<typeof Date>) {
      if (args.length === 0) {
        super(fixedMs);
      } else {
        super(...args);
      }
    }

    static override now(): number {
      return fixedMs;
    }
  }

  window.Date = CaptureDate as typeof Date;
}
