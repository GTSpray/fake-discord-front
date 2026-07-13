import Ajv2020 from 'ajv/dist/2020.js';
import type { ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import scenarioSchema from '../../schema/scenario.schema.json';
import type { Scenario } from './scenarioTypes.ts';

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

const validate = ajv.compile(scenarioSchema);

export class ScenarioValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScenarioValidationError';
  }
}

function formatErrors(errors: ErrorObject[] | null | undefined): string {
  if (!errors?.length) return 'JSON invalide';
  return errors
    .map((err) => {
      const path = err.instancePath || '/';
      return `${path} ${err.message ?? 'invalide'}`;
    })
    .join('\n');
}

/** Valide un objet JSON contre le schéma playback. */
export function validateScenario(raw: unknown): Scenario {
  const ok = validate(raw);
  if (!ok) {
    throw new ScenarioValidationError(formatErrors(validate.errors));
  }
  return raw as unknown as Scenario;
}
