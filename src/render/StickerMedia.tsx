import { Lottie } from 'lottie-react';
import { isCaptureStepsMode } from '../lib/captureMode.ts';
import { resolveSticker } from '../lib/stickerResolve.ts';

export function StickerMedia({
  url,
  name,
  className,
  size = 160,
  loop = true,
}: {
  url: string;
  name?: string;
  className?: string;
  size?: number;
  loop?: boolean;
}) {
  const resolved = resolveSticker(url);
  // Snapshot MD5 pass: freeze on first frame so hashes stay stable.
  const freeze = isCaptureStepsMode();

  if (resolved.kind === 'lottie' || resolved.kind === 'lottie-url') {
    const src = resolved.kind === 'lottie' ? resolved.animationData : resolved.url;
    const label = name ?? (resolved.kind === 'lottie' ? resolved.name : undefined);
    return (
      <Lottie
        className={className}
        src={src}
        loop={freeze ? false : loop}
        autoplay={!freeze}
        // Single-frame segment — playhead stays on frame 0.
        segment={freeze ? ([0, 0] as const) : undefined}
        data-lottie-frozen={freeze ? '1' : undefined}
        style={{ width: size, height: size }}
        aria-label={label}
      />
    );
  }

  return (
    <img
      className={className}
      src={resolved.url}
      alt={name ?? ''}
      width={size}
      height={size}
      draggable={false}
    />
  );
}
