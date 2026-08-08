import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  findFlashFrameIndices,
  filterFlashFramesFile,
  GIF_MUX_FLAGS,
  GIF_VF,
  meanAbsDiffBytes,
  replaceFlashFrames,
  resolveFfmpegBinary,
  resolveVideoFormat,
  resolveVideoFormats,
  stabilizeScreencastWebm,
  VIDEO_FORMATS,
  VIDEO_FPS,
} from '../../scripts/capture-lib.mjs';

function hasFfmpeg(): boolean {
  try {
    resolveFfmpegBinary();
    return true;
  } catch {
    return false;
  }
}

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

describe('resolveVideoFormats', () => {
  it('accepts a single format', () => {
    expect(resolveVideoFormats('gif')).toEqual(['gif']);
    expect(resolveVideoFormats('MP4')).toEqual(['mp4']);
  });

  it('accepts comma/space-separated lists and arrays', () => {
    expect(resolveVideoFormats('gif,mp4,webm')).toEqual(['gif', 'mp4', 'webm']);
    expect(resolveVideoFormats('gif, mp4')).toEqual(['gif', 'mp4']);
    expect(resolveVideoFormats(['webm', 'GIF'])).toEqual(['webm', 'gif']);
    expect(resolveVideoFormats(['gif', 'mp4', 'gif'])).toEqual(['gif', 'mp4']);
    // parseArgs multiple:true keeps commas inside a single argv token
    expect(resolveVideoFormats(['webm,mp4'])).toEqual(['webm', 'mp4']);
    expect(resolveVideoFormats(['gif', 'mp4,webm'])).toEqual(['gif', 'mp4', 'webm']);
  });

  it('rejects unknown formats in a list', () => {
    expect(() => resolveVideoFormats('gif,avi')).toThrow(/Unsupported video format/);
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

describe('video stabilize settings', () => {
  it('uses a constant FPS for webm/mp4 re-encode', () => {
    expect(VIDEO_FPS).toBe(30);
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

  it('filterFlashFramesFile streams the same tear replacement', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flash-file-'));
    const frameSize = 4;
    const rawPath = join(dir, 'in.rgb');
    const outPath = join(dir, 'out.rgb');
    try {
      writeFileSync(
        rawPath,
        Buffer.concat([
          Buffer.alloc(frameSize, 1),
          Buffer.alloc(frameSize, 9),
          Buffer.alloc(frameSize, 2),
        ]),
      );
      expect(filterFlashFramesFile(rawPath, outPath, frameSize)).toBe(1);
      const out = readFileSync(outPath);
      expect([...out.subarray(0, 4)]).toEqual([1, 1, 1, 1]);
      expect([...out.subarray(4, 8)]).toEqual([1, 1, 1, 1]);
      expect([...out.subarray(8, 12)]).toEqual([2, 2, 2, 2]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.skipIf(!hasFfmpeg())('stabilizeScreencastWebm drops tear frames from a synthetic webm', () => {
    const ffmpeg = resolveFfmpegBinary();
    const dir = mkdtempSync(join(tmpdir(), 'stabilize-test-'));
    const w = 64;
    const h = 36;
    const frameSize = w * h * 3;
    const solid = (v: number) => Buffer.alloc(frameSize, v);

    try {
      const rawPath = join(dir, 'in.rgb');
      writeFileSync(
        rawPath,
        Buffer.concat([solid(40), solid(41), solid(200), solid(42), solid(43)]),
      );

      const dirtyWebm = join(dir, 'dirty.webm');
      execFileSync(
        ffmpeg,
        [
          '-y',
          '-loglevel',
          'error',
          '-f',
          'rawvideo',
          '-pix_fmt',
          'rgb24',
          '-s',
          `${w}x${h}`,
          '-r',
          String(VIDEO_FPS),
          '-i',
          rawPath,
          '-an',
          '-c:v',
          'libvpx',
          '-b:v',
          '200k',
          '-auto-alt-ref',
          '0',
          dirtyWebm,
        ],
        { stdio: 'inherit' },
      );

      const cleanWebm = join(dir, 'clean.webm');
      const removed = stabilizeScreencastWebm(ffmpeg, dirtyWebm, cleanWebm);
      expect(removed).toBeGreaterThanOrEqual(1);
      expect(existsSync(cleanWebm)).toBe(true);

      const cleanRaw = join(dir, 'clean.rgb');
      execFileSync(
        ffmpeg,
        [
          '-y',
          '-loglevel',
          'error',
          '-i',
          cleanWebm,
          '-vf',
          `fps=${VIDEO_FPS},format=rgb24`,
          '-f',
          'rawvideo',
          cleanRaw,
        ],
        { stdio: ['ignore', 'ignore', 'inherit'] },
      );
      const buf = readFileSync(cleanRaw);
      const frames: Uint8Array[] = [];
      for (let offset = 0; offset < buf.length; offset += frameSize) {
        frames.push(Uint8Array.prototype.slice.call(buf, offset, offset + frameSize));
      }
      expect(findFlashFrameIndices(frames)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
