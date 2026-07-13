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
    void preloadRef.current.then(() => {
      if (!cancelled) void runner.play();
    });

    return () => {
      cancelled = true;
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
