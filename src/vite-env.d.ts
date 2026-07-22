/// <reference types="vite/client" />
/// <reference types="vitest/config" />

interface ScenarioPlayerGlobal {
  status: 'idle' | 'playing' | 'paused' | 'done';
  actionIndex: number;
  completedActionIndex?: number;
  totalActions: number;
  scenarioId: string;
}

declare global {
  interface Window {
    __SCENARIO_LOAD_ERROR__?: string;
    __SCENARIO_PLAYER__?: ScenarioPlayerGlobal;
    __SCENARIO_CAPTURE_NEXT_STEP__?: () => void;
    /** Set while capture+record mode is waiting for the capture script to start recording. */
    __SCENARIO_CAPTURE_ARMED__?: boolean;
    /** Resolve the record gate so autoplay can start after screencast.start(). */
    __SCENARIO_CAPTURE_BEGIN__?: () => void;
  }
}

export {};
