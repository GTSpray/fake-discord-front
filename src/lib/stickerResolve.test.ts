import { describe, expect, it } from 'vitest';
import {
  BUNDLED_STICKERS,
  DEFAULT_WAVE_STICKER,
  listBundledStickerIds,
  resolveSticker,
  resolveStickerImageUrl,
} from './stickerResolve.ts';

describe('bundled sticker catalog', () => {
  it('exposes the four greeting stickers', () => {
    expect(listBundledStickerIds()).toEqual([
      'wumpus_hello',
      'nelly_greetings',
      'clyde_greetings',
      'sup_dogo',
    ]);
    expect(BUNDLED_STICKERS).toHaveLength(4);
  });
});

describe('resolveSticker', () => {
  it('resolves each bundled sticker by id', () => {
    for (const id of listBundledStickerIds()) {
      const resolved = resolveSticker(id);
      expect(resolved.kind).toBe('lottie');
      if (resolved.kind === 'lottie') {
        expect(resolved.id).toBe(id);
        expect(resolved.animationData).toEqual(expect.objectContaining({ v: expect.any(String) }));
      }
    }
  });

  it('also accepts id.json filenames', () => {
    expect(resolveSticker('wumpus_hello.json').kind).toBe('lottie');
    expect(resolveSticker('clyde_greetings.json').kind).toBe('lottie');
  });

  it('treats HTTP .json URLs as remote Lottie', () => {
    expect(resolveSticker('https://cdn.example/hi.json')).toEqual({
      kind: 'lottie-url',
      url: 'https://cdn.example/hi.json',
    });
  });

  it('passes through image URLs', () => {
    expect(resolveSticker('https://cdn.example/sticker.png')).toEqual({
      kind: 'image',
      url: 'https://cdn.example/sticker.png',
    });
  });

  it('defaults the wave sticker to wumpus_hello', () => {
    expect(DEFAULT_WAVE_STICKER).toBe('wumpus_hello');
    expect(resolveSticker(DEFAULT_WAVE_STICKER).kind).toBe('lottie');
  });
});

describe('resolveStickerImageUrl', () => {
  it('returns HTTP image URLs only', () => {
    expect(resolveStickerImageUrl('https://cdn.example/sticker.png')).toBe(
      'https://cdn.example/sticker.png',
    );
    expect(resolveStickerImageUrl('nelly_greetings')).toBeNull();
    expect(resolveStickerImageUrl('https://cdn.example/hi.json')).toBeNull();
  });
});
