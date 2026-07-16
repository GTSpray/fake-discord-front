import { useMemo } from 'react';
import { TypeAnimation } from 'react-type-animation';
import type { SlashParamTypingAnimation } from '../lib/types.ts';
import { buildSlashTypingSequence } from './buildSlashTypingSequence.ts';

export function AnimatedSlashParamValue({ animation }: { animation: SlashParamTypingAnimation }) {
  const sequence = useMemo(
    () => buildSlashTypingSequence(animation),
    [animation.id, animation.from, animation.to],
  );

  return (
    <TypeAnimation
      key={animation.id}
      sequence={sequence}
      speed={{ type: 'keyStrokeDelayInMs', value: animation.msPerChar }}
      wrapper="span"
      cursor={false}
      className="slash-param-value-text"
      preRenderFirstString={Boolean(animation.from)}
      omitDeletionAnimation
    />
  );
}
