import { afterEach, describe, expect, it, vi } from 'vitest';
import { CAPTURE_FIXED_DATE_ISO, installCaptureClock } from './captureClock.ts';

describe('installCaptureClock', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('freezes Date when capture=1', () => {
    vi.stubGlobal('location', { search: '?capture=1' });

    installCaptureClock();

    expect(Date.now()).toBe(Date.parse(CAPTURE_FIXED_DATE_ISO));
    expect(new Date().toISOString()).toBe(CAPTURE_FIXED_DATE_ISO);
    expect(new Date()).toBeInstanceOf(Date);
  });

  it('does nothing outside capture mode', () => {
    vi.stubGlobal('location', { search: '' });
    const before = Date.now;

    installCaptureClock();

    expect(Date.now).toBe(before);
  });
});
