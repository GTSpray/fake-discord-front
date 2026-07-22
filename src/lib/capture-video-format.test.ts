import { describe, expect, it } from 'vitest';
import { resolveVideoFormat, VIDEO_FORMATS } from '../../scripts/capture-lib.mjs';

describe('resolveVideoFormat', () => {
  it('accepts gif, mp4 and webm', () => {
    expect(VIDEO_FORMATS).toEqual(['gif', 'mp4', 'webm']);
    expect(resolveVideoFormat('gif')).toBe('gif');
    expect(resolveVideoFormat('MP4')).toBe('mp4');
    expect(resolveVideoFormat(' webm ')).toBe('webm');
  });

  it('rejects unknown formats', () => {
    expect(() => resolveVideoFormat('avi')).toThrow(/Unsupported video format/);
  });
});
