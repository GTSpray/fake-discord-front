export function runCursorClick(signal: AbortSignal): Promise<void> {
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
      resolve: () => {
        signal.removeEventListener('abort', onAbort);
        active = null;
        resolve();
      },
      reject: (err) => {
        signal.removeEventListener('abort', onAbort);
        active = null;
        reject(err);
      },
    };
  });
}

let active: {
  resolve: () => void;
  reject: (err: Error) => void;
} | null = null;

export function completeCursorClick(): void {
  active?.resolve();
}

export function failCursorClick(err: Error): void {
  active?.reject(err);
}
