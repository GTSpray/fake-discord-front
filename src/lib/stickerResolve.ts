import clydeGreetings from '../styles/stickers/clyde_greetings.json';
import nellyGreetings from '../styles/stickers/nelly_greetings.json';
import dogoSup from '../styles/stickers/sup_dogo.json';
import wumpusHello from '../styles/stickers/wumpus_hello.json';

type LottieAnimationData = object;

export interface BundledStickerDef {
  /** Stable id used in playback JSON (`url` / `waveSticker`) */
  id: string;
  /** Display name */
  name: string;
  /** Lottie animation payload */
  animationData: LottieAnimationData;
}

/**
 * Catalog of bundled greeting stickers.
 * Reference any of these by `id` (or `id.json`) in `stickers[].url` / `system.waveSticker`.
 */
export const BUNDLED_STICKERS: readonly BundledStickerDef[] = [
  { id: 'wumpus_hello', name: 'Wumpus Hello', animationData: wumpusHello },
  { id: 'nelly_greetings', name: 'Nelly Greetings', animationData: nellyGreetings },
  { id: 'clyde_greetings', name: 'Clyde Greetings', animationData: clydeGreetings },
  { id: 'sup_dogo', name: 'Sup Dogo', animationData: dogoSup },
] as const;

export type BundledStickerId = (typeof BUNDLED_STICKERS)[number]['id'];

/** Default wave CTA sticker. */
export const DEFAULT_WAVE_STICKER: BundledStickerId = 'wumpus_hello';

const BUNDLED_BY_KEY: Record<string, BundledStickerDef> = {};
for (const sticker of BUNDLED_STICKERS) {
  BUNDLED_BY_KEY[sticker.id] = sticker;
  BUNDLED_BY_KEY[`${sticker.id}.json`] = sticker;
}

export type ResolvedSticker =
  | { kind: 'lottie'; id?: string; name?: string; animationData: LottieAnimationData }
  | { kind: 'lottie-url'; url: string }
  | { kind: 'image'; url: string };

function stickerKey(url: string): string {
  return url.trim().replace(/^\.\//, '').split('/').pop() ?? url.trim();
}

function isJsonSticker(url: string): boolean {
  const key = stickerKey(url).toLowerCase();
  return key.endsWith('.json') || key.endsWith('.lottie');
}

/** List of stable bundled sticker ids (for docs / schema). */
export function listBundledStickerIds(): BundledStickerId[] {
  return BUNDLED_STICKERS.map((s) => s.id);
}

/** Resolve a sticker ref (bundled id, HTTP Lottie JSON, or image URL). */
export function resolveSticker(url: string): ResolvedSticker {
  const key = stickerKey(url);
  const bundled = BUNDLED_BY_KEY[key] ?? BUNDLED_BY_KEY[key.replace(/\.json$/i, '')];
  if (bundled) {
    return {
      kind: 'lottie',
      id: bundled.id,
      name: bundled.name,
      animationData: bundled.animationData,
    };
  }

  if (/^https?:\/\//i.test(url) && isJsonSticker(url)) {
    return { kind: 'lottie-url', url };
  }

  return { kind: 'image', url };
}

/** Image / remote URL only — used by image-URL collectors. */
export function resolveStickerImageUrl(url: string): string | null {
  const resolved = resolveSticker(url);
  if (resolved.kind === 'image' && /^https?:\/\//i.test(resolved.url)) return resolved.url;
  return null;
}
