import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Scenario } from './lib/scenarioTypes.ts';
import {
  publishScenarioLoadError,
  readScenarioUpload,
  restoreUploadedScenario,
  saveUploadedScenario,
} from './lib/uploadScenario.ts';
import { EmptyState, StudioSidebar } from './render/StudioSidebar.tsx';
import { ScenarioCanvas } from './scenario/ScenarioCanvas.tsx';
import { useScenarioPlayer } from './scenario/useScenarioPlayer.ts';

function getParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    capture: params.get('capture') === '1',
    hideui: params.get('hideui'),
    autoplay: params.get('autoplay') !== '0',
  };
}

function searchWithHideUiFirst(params: URLSearchParams, hideui: string): string {
  const rest = new URLSearchParams(params);
  rest.delete('hideui');
  const ordered = new URLSearchParams();
  ordered.set('hideui', hideui);
  for (const [key, value] of rest.entries()) {
    ordered.append(key, value);
  }
  return ordered.toString();
}

function setHideUi(hidden: boolean) {
  const url = new URL(window.location.href);
  url.search = searchWithHideUiFirst(url.searchParams, hidden ? '1' : '0');
  window.history.pushState({}, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function PlaybackView({ scenario, autoplay }: { scenario: Scenario; autoplay: boolean }) {
  const { state, status, play, pause, resume, snapshot } = useScenarioPlayer({
    scenario,
    autoplay,
  });

  useEffect(() => {
    function onToggle() {
      if (status === 'playing') pause();
      else if (status === 'paused') resume();
      else play();
    }
    window.addEventListener('scenario-toggle-playback', onToggle);
    return () => window.removeEventListener('scenario-toggle-playback', onToggle);
  }, [status, play, pause, resume]);

  if (!state) {
    return <div className="studio-error">Chargement…</div>;
  }

  return (
    <>
      <ScenarioCanvas state={state} scenarioDone={status === 'done'} />
      {!autoplay &&
        createPortal(
          <div className="scenario-controls">
            <span className="scenario-status">
              {status === 'done'
                ? 'Terminé'
                : `${snapshot?.actionIndex ?? 0} / ${snapshot?.totalActions ?? 0}`}
            </span>
            {status === 'playing' && (
              <button type="button" onClick={pause}>
                Pause
              </button>
            )}
            {(status === 'paused' || status === 'idle' || status === 'done') && (
              <button type="button" onClick={status === 'paused' ? resume : play}>
                {status === 'done' ? 'Rejouer' : 'Lecture'}
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

export function App() {
  const [params, setParams] = useState(getParams);
  const [initialLoad] = useState(() => restoreUploadedScenario());
  const [scenario, setScenario] = useState<Scenario | null>(initialLoad.scenario);
  const [sessionError, setSessionError] = useState<string | null>(initialLoad.error);

  const refreshParams = useCallback(() => setParams(getParams()), []);

  const handleUpload = useCallback(async (file: File) => {
    const parsed = await readScenarioUpload(file);
    saveUploadedScenario(parsed);
    setSessionError(null);
    setScenario(parsed);
  }, []);

  useEffect(() => {
    publishScenarioLoadError(sessionError);
  }, [sessionError]);

  useEffect(() => {
    window.addEventListener('popstate', refreshParams);
    return () => window.removeEventListener('popstate', refreshParams);
  }, [refreshParams]);

  useEffect(() => {
    document.title = scenario?.title ? `${scenario.title} — Doc Studio` : 'Doc Studio';
  }, [scenario]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 's' || e.key === 'S') {
        setHideUi(true);
        refreshParams();
        return;
      }

      if (e.key === ' ' && scenario) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('scenario-toggle-playback'));
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [scenario, refreshParams]);

  const showStudioSidebar = params.hideui !== '1' && !params.capture;

  const handleHideUi = useCallback(() => {
    setHideUi(true);
    refreshParams();
  }, [refreshParams]);

  return (
    <div className={`studio-layout${showStudioSidebar ? '' : ' studio-layout--full'}`}>
      {showStudioSidebar && (
        <>
          <div className="studio-sidebar-spacer" aria-hidden />
          <StudioSidebar
            scenarioTitle={scenario?.title}
            onUpload={handleUpload}
            onHide={handleHideUi}
          />
        </>
      )}

      {scenario ? (
        <PlaybackView scenario={scenario} autoplay={params.autoplay} />
      ) : (
        <EmptyState onUpload={handleUpload} error={sessionError} />
      )}
    </div>
  );
}
