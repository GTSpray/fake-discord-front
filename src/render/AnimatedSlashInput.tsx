import { useMemo } from 'react';
import { TypeAnimation } from 'react-type-animation';
import type { SlashTypingAnimation } from '../lib/types.ts';
import { buildSlashTypingSequence } from './buildSlashTypingSequence.ts';

export function AnimatedSlashInput({ animation }: { animation: SlashTypingAnimation }) {
  const sequence = useMemo(
    () => buildSlashTypingSequence(animation),
    [animation],
  );

  return (
    <TypeAnimation
      key={animation.id}
      sequence={sequence}
      speed={{ type: 'keyStrokeDelayInMs', value: animation.msPerChar }}
      wrapper="span"
      cursor={false}
      className="slash-input-display"
      preRenderFirstString={Boolean(animation.from)}
      omitDeletionAnimation
    />
  );
}
