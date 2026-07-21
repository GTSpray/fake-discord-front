import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { completeCursorClick } from '../scenario/cursorBridge.ts';
import { buttonCenter, waitForScenarioButtonRect } from './findScenarioButton.ts';
import pointerArrowIcon from '../styles/pointer-arrow-icon.svg';

const MOVE_DURATION_MS = 750;
const CLICK_HOLD_MS = 140;
const FRAME_MS = 16;
const CURSOR_ORIGIN_OFFSET_Y = 50;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function queryCursorAnchor(root: HTMLElement | null): HTMLElement | null {
  const scope = root ?? document;

  const discover = scope.querySelector('.guild-rail__action[aria-label="Discover"]');
  if (discover instanceof HTMLElement) return discover;

  const actions = scope.querySelectorAll('.guild-rail__action:not(.guild-rail__action--bottom)');
  const secondAction = actions[1];
  if (secondAction instanceof HTMLElement) return secondAction;

  const server = scope.querySelector('.guild-rail__server');
  if (server instanceof HTMLElement) return server;

  return null;
}

function getScenarioCursorOrigin(root: HTMLElement | null): { x: number; y: number } {
  const anchor = queryCursorAnchor(root);
  if (anchor) {
    const r = anchor.getBoundingClientRect();
    const offsetY = anchor.classList.contains('guild-rail__server') ? 136 : CURSOR_ORIGIN_OFFSET_Y;
    return { x: r.left + r.width / 2, y: r.bottom + offsetY };
  }

  if (root) {
    const r = root.getBoundingClientRect();
    return { x: r.left + 36, y: r.top + 228 };
  }

  return { x: 36, y: 228 };
}

function defaultOrigin(canvas: HTMLElement | null): { x: number; y: number } {
  return getScenarioCursorOrigin(canvas);
}

async function animateCursorMove(
  from: { x: number; y: number },
  to: { x: number; y: number },
  apply: (point: { x: number; y: number }) => void,
  isCancelled: () => boolean,
): Promise<void> {
  const startedAt = performance.now();

  while (true) {
    if (isCancelled()) return;

    const elapsed = performance.now() - startedAt;
    const t = Math.min(1, elapsed / MOVE_DURATION_MS);
    const e = easeInOutCubic(t);
    apply({
      x: from.x + (to.x - from.x) * e,
      y: from.y + (to.y - from.y) * e,
    });

    if (t >= 1) return;
    await sleep(FRAME_MS);
  }
}

interface CursorPose {
  x: number;
  y: number;
  visible: boolean;
  pressing: boolean;
}

export function ScenarioCursor({
  target,
  canvasRef,
  returnHome = false,
}: {
  target: string | null;
  canvasRef: RefObject<HTMLElement | null>;
  returnHome?: boolean;
}) {
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const hasAnimated = useRef(false);
  const [pose, setPose] = useState<CursorPose>({
    x: 0,
    y: 0,
    visible: false,
    pressing: false,
  });

  useEffect(() => {
    if (!returnHome) return;
    hasAnimated.current = false;
    const origin = getScenarioCursorOrigin(canvasRef.current);
    lastPos.current = origin;
    setPose({ ...origin, visible: true, pressing: false });
  }, [returnHome, canvasRef]);

  useEffect(() => {
    const placeIdle = () => {
      if (hasAnimated.current) return;
      const origin = getScenarioCursorOrigin(canvasRef.current);
      lastPos.current = origin;
      setPose({ ...origin, visible: true, pressing: false });
    };

    placeIdle();
    window.addEventListener('resize', placeIdle);
    return () => window.removeEventListener('resize', placeIdle);
  }, [canvasRef]);

  useEffect(() => {
    if (!target) return;

    hasAnimated.current = true;

    let cancelled = false;
    let bridgeCompleted = false;
    const runId = target;

    const finishClick = () => {
      if (bridgeCompleted) return;
      bridgeCompleted = true;
      completeCursorClick();
    };

    const run = async () => {
      try {
        await sleep(32);
        if (cancelled) return;

        const rect = await waitForScenarioButtonRect(target);
        if (cancelled) return;

        const from = lastPos.current ?? defaultOrigin(canvasRef.current);
        const to = rect ? buttonCenter(rect) : from;

        await animateCursorMove(
          from,
          to,
          (point) => {
            setPose({ ...point, visible: true, pressing: false });
          },
          () => cancelled,
        );

        if (cancelled) return;

        lastPos.current = to;
        setPose({ x: to.x, y: to.y, visible: true, pressing: true });
        await sleep(CLICK_HOLD_MS);

        if (cancelled || runId !== target) return;

        setPose({ x: to.x, y: to.y, visible: true, pressing: false });
      } finally {
        finishClick();
      }
    };

    void run();

    return () => {
      cancelled = true;
      finishClick();
    };
  }, [target, canvasRef]);

  if (!pose.visible) return null;

  return createPortal(
    <div
      className="scenario-cursor-host"
      style={{ transform: `translate(${pose.x}px, ${pose.y}px)` }}
      aria-hidden
    >
      <img
        src={pointerArrowIcon}
        className={`scenario-cursor${pose.pressing ? ' scenario-cursor--pressing' : ''}`}
        alt=""
        draggable={false}
      />
    </div>,
    document.body,
  );
}
