import type { Scenario } from './scenarioTypes.ts';
import { UPLOAD_SCENARIO_STORAGE_KEY } from './scenarioTypes.ts';
import { ScenarioValidationError, validateScenario } from './validateScenario.ts';

export { ScenarioValidationError as ScenarioParseError };

function parseStoredScenario(raw: string): Scenario {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ScenarioValidationError('JSON invalide');
  }
  return validateScenario(parsed);
}

/** Lit un fichier uploadé, parse le JSON et valide contre le schéma. */
export async function readScenarioUpload(file: File): Promise<Scenario> {
  return parseStoredScenario(await file.text());
}

/** Restaure le scénario depuis sessionStorage en le validant au runtime. */
export function restoreUploadedScenario(): { scenario: Scenario | null; error: string | null } {
  const raw = sessionStorage.getItem(UPLOAD_SCENARIO_STORAGE_KEY);
  if (!raw) return { scenario: null, error: null };

  try {
    return { scenario: parseStoredScenario(raw), error: null };
  } catch (err) {
    clearUploadedScenario();
    const message =
      err instanceof ScenarioValidationError ? err.message : 'Fichier playback invalide';
    return { scenario: null, error: message };
  }
}

export function saveUploadedScenario(scenario: Scenario): void {
  sessionStorage.setItem(UPLOAD_SCENARIO_STORAGE_KEY, JSON.stringify(scenario));
}

/** @deprecated Use restoreUploadedScenario() — kept for scripts that inject sessionStorage. */
export function loadUploadedScenario(): Scenario | null {
  return restoreUploadedScenario().scenario;
}

export function clearUploadedScenario(): void {
  sessionStorage.removeItem(UPLOAD_SCENARIO_STORAGE_KEY);
}

export function publishScenarioLoadError(message: string | null): void {
  if (typeof window === 'undefined') return;
  if (message) {
    window.__SCENARIO_LOAD_ERROR__ = message;
  } else {
    delete window.__SCENARIO_LOAD_ERROR__;
  }
}
