import { describe, expect, it } from 'vitest';
import { makeScenario } from '../test/scenarioFixtures.ts';
import { ScenarioParseError, parseScenario } from './parseScenario.ts';

describe('parseScenario', () => {
  it('parses a valid object', () => {
    const scenario = makeScenario([{ type: 'focusInput' }]);
    expect(parseScenario(scenario)).toEqual(scenario);
  });

  it('rejects non-object payloads', () => {
    expect(() => parseScenario(null)).toThrow(ScenarioParseError);
    expect(() => parseScenario([])).toThrow(/objet JSON/);
    expect(() => parseScenario('string')).toThrow(ScenarioParseError);
  });
});
