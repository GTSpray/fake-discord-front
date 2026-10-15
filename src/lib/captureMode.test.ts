import { afterEach, describe, expect, it, vi } from 'vitest';
import { isCaptureStepsMode } from './captureMode.ts';

describe('isCaptureStepsMode', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is true when capture_steps=1', () => {
    vi.stubGlobal('location', { search: '?capture=1&capture_steps=1' });
    expect(isCaptureStepsMode()).toBe(true);
  });

  it('is false for capture without capture_steps (GIF/video pass)', () => {
    vi.stubGlobal('location', { search: '?capture=1' });
    expect(isCaptureStepsMode()).toBe(false);
  });

  it('is false with no query params', () => {
    vi.stubGlobal('location', { search: '' });
    expect(isCaptureStepsMode()).toBe(false);
  });
});
