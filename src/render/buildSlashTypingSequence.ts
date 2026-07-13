import { completeTyping, revealTyping } from '../scenario/typingBridge.ts';
import type { SlashTypingAnimation } from '../lib/types.ts';

type SequenceStep = string | number | (() => void);

export function buildSlashTypingSequence(animation: SlashTypingAnimation): SequenceStep[] {
  const { from, to, revealAfter } = animation;

  if (from === to) {
    return [() => completeTyping()];
  }

  const onComplete = () => completeTyping();

  if (
    !revealAfter ||
    !to.includes(revealAfter) ||
    to.indexOf(revealAfter) + revealAfter.length >= to.length
  ) {
    if (from && to.startsWith(from)) {
      return [from, to, onComplete];
    }
    return [to, onComplete];
  }

  const revealEnd = to.indexOf(revealAfter) + revealAfter.length;
  const mid = to.slice(0, revealEnd);

  const sequence: SequenceStep[] = [];
  if (from) sequence.push(from);
  if (mid !== from) sequence.push(mid);
  sequence.push(() => revealTyping());
  if (to !== mid) sequence.push(to);
  sequence.push(onComplete);

  return sequence;
}
