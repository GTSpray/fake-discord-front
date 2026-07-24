import { describe, expect, it } from 'vitest';
import {
  findFlashFrameIndices,
  GIF_MUX_FLAGS,
  GIF_VF,
  meanAbsDiffBytes,
  replaceFlashFrames,
  resolveVideoFormat,
  VIDEO_FORMATS,
} from '../../scripts/capture-lib.mjs';

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

describe('GIF encode settings', () => {
  it('uses a full-frame palette without Bayer dither (avoids flat-color flicker)', () => {
    expect(GIF_VF).toContain('palettegen=stats_mode=full');
    expect(GIF_VF).toContain('reserve_transparent=0');
    expect(GIF_VF).toContain('paletteuse=dither=none');
    expect(GIF_VF).toContain('hqdn3d=');
    expect(GIF_VF).not.toContain('stats_mode=diff');
    expect(GIF_VF).not.toContain('dither=bayer');
  });

  it('disables GIF sub-rectangle offsetting (avoids viewer flash on 1×1 tiles)', () => {
    expect(GIF_MUX_FLAGS).toBe('-offsetting');
  });
});

describe('screencast tear-frame detection', () => {
  it('computes mean abs byte diff', () => {
    expect(meanAbsDiffBytes(Uint8Array.of(0, 10), Uint8Array.of(0, 20))).toBe(5);
  });

  it('flags a one-frame tear between two similar neighbors', () => {
    const a = new Uint8Array(12).fill(50);
    const tear = new Uint8Array(12).fill(80);
    const c = new Uint8Array(12).fill(52);
    expect(findFlashFrameIndices([a, tear, c])).toEqual([1]);
  });

  it('does not flag real motion spanning three frames', () => {
    const a = new Uint8Array(12).fill(10);
    const b = new Uint8Array(12).fill(40);
    const c = new Uint8Array(12).fill(70);
    expect(findFlashFrameIndices([a, b, c])).toEqual([]);
  });

  it('replaces tear frames with the previous frame', () => {
    const frames = [
      new Uint8Array(4).fill(1),
      new Uint8Array(4).fill(9),
      new Uint8Array(4).fill(2),
    ];
    replaceFlashFrames(frames, [1]);
    expect([...frames[1]]).toEqual([1, 1, 1, 1]);
  });
});
