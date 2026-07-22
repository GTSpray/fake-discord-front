import { useEffect, useMemo, useRef, useState } from 'react';
import { collectScenarioImageUrls } from '../lib/collectScenarioImageUrls.ts';
import { preloadImages } from '../lib/preloadImages.ts';
import type { Scenario } from '../lib/scenarioTypes.ts';
import type {
  PlaybackState,
  ScenarioPlayerSnapshot,
  ScenarioStatus,
} from '../lib/scenarioTypes.ts';
import { ScenarioRunner } from './ScenarioRunner.ts';

interface UseScenarioPlayerOptions {
  scenario: Scenario;
  autoplay?: boolean;
}

export function useScenarioPlayer({ scenario, autoplay = true }: UseScenarioPlayerOptions) {
  const runnerRef = useRef<ScenarioRunner | null>(null);
  const preloadRef = useRef<Promise<void>>(Promise.resolve());
  const [snapshot, setSnapshot] = useState<ScenarioPlayerSnapshot | null>(null);

  const runner = useMemo(() => new ScenarioRunner(scenario), [scenario]);
  const [readyScenarioId, setReadyScenarioId] = useState<string | null>(null);

  useEffect(() => {
    runnerRef.current = runner;
  }, [runner]);

  useEffect(() => {
    let cancelled = false;

    const urls = collectScenarioImageUrls(scenario);
    const preload = preloadImages(urls);
    preloadRef.current = preload;

    void preload.then(() => {
      if (!cancelled) setReadyScenarioId(scenario.id);
    });

    return () => {
      cancelled = true;
    };
  }, [scenario]);

  const imagesReady = readyScenarioId === scenario.id;

  useEffect(() => {
    const unsub = runner.subscribe(setSnapshot);
    return unsub;
  }, [runner]);

  useEffect(() => {
    if (!autoplay || !imagesReady) return;

    let cancelled = false;
    void preloadRef.current.then(async () => {
      if (cancelled) return;

      const params = new URLSearchParams(window.location.search);
      const recordGate = params.get('capture') === '1' && params.get('record') === '1';
      if (recordGate) {
        await new Promise<void>((resolve) => {
          window.__SCENARIO_CAPTURE_BEGIN__ = () => {
            delete window.__SCENARIO_CAPTURE_BEGIN__;
            resolve();
          };
          window.__SCENARIO_CAPTURE_ARMED__ = true;
        });
        delete window.__SCENARIO_CAPTURE_ARMED__;
      }

      if (!cancelled) void runner.play();
    });

    return () => {
      cancelled = true;
      delete window.__SCENARIO_CAPTURE_ARMED__;
      delete window.__SCENARIO_CAPTURE_BEGIN__;
      runner.stop();
    };
  }, [runner, autoplay, imagesReady]);

  const play = () => {
    void preloadRef.current.then(() => runnerRef.current?.play());
  };
  const pause = () => runnerRef.current?.pause();
  const resume = () => runnerRef.current?.resume();
  const stop = () => runnerRef.current?.stop();

  return {
    snapshot,
    state: snapshot?.state ?? null,
    status: (snapshot?.status ?? 'idle') as ScenarioStatus,
    scenario,
    imagesReady,
    play,
    pause,
    resume,
    stop,
  };
}

export type { PlaybackState, ScenarioPlayerSnapshot };
