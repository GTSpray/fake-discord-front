/// <reference types="vite/client" />
/// <reference types="vitest/config" />

interface ScenarioPlayerGlobal {
  status: 'idle' | 'playing' | 'paused' | 'done';
  actionIndex: number;
  totalActions: number;
  scenarioId: string;
}

declare global {
  interface Window {
    __SCENARIO_LOAD_ERROR__?: string;
    __SCENARIO_PLAYER__?: ScenarioPlayerGlobal;
  }
}

export {};
