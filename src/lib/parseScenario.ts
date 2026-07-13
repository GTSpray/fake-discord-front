import type { Scenario } from './scenarioTypes.ts';
import { ScenarioValidationError, validateScenario } from './validateScenario.ts';

export { ScenarioValidationError as ScenarioParseError };

/** @deprecated Use readScenarioUpload() or validateScenario() directly. */
export function parseScenario(raw: unknown): Scenario {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ScenarioValidationError('Le fichier doit être un objet JSON');
  }
  return validateScenario(raw);
}
