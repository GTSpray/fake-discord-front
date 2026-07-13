export interface TypingHandlers {
  onStart: () => void;
  onReveal?: () => void;
  onDone: () => void;
}

interface ActiveTyping extends TypingHandlers {
  resolve: () => void;
  reject: (err: Error) => void;
}

let active: ActiveTyping | null = null;

export function runTyping(signal: AbortSignal, handlers: TypingHandlers): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const onAbort = () => {
      active = null;
      reject(new DOMException('Aborted', 'AbortError'));
    };

    signal.addEventListener('abort', onAbort, { once: true });

    active = {
      ...handlers,
      resolve: () => {
        signal.removeEventListener('abort', onAbort);
        handlers.onDone();
        active = null;
        resolve();
      },
      reject: (err) => {
        signal.removeEventListener('abort', onAbort);
        active = null;
        reject(err);
      },
    };

    handlers.onStart();
  });
}

export function revealTyping(): void {
  active?.onReveal?.();
}

export function completeTyping(): void {
  active?.resolve();
}
