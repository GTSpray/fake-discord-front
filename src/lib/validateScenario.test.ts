import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeScenario } from '../test/scenarioFixtures.ts';
import { ScenarioValidationError, validateScenario } from './validateScenario.ts';

const root = resolve(import.meta.dirname, '../..');
const examplesDir = join(root, 'examples');

describe('validateScenario', () => {
  it('accepts a minimal valid scenario', () => {
    const scenario = makeScenario([{ type: 'wait', ms: 100 }]);
    expect(validateScenario(scenario)).toEqual(scenario);
  });

  it('rejects a scenario without required fields', () => {
    expect(() => validateScenario({ title: 'missing id' })).toThrow(ScenarioValidationError);
  });

  it('rejects an invalid action type', () => {
    const scenario = makeScenario([{ type: 'unknown' as 'wait', ms: 1 }]);
    expect(() => validateScenario(scenario)).toThrow(ScenarioValidationError);
  });

  it('validates every example playback file', () => {
    const files = readdirSync(examplesDir).filter((name) => name.endsWith('.json'));

    for (const file of files) {
      const raw = JSON.parse(readFileSync(join(examplesDir, file), 'utf8'));
      expect(() => validateScenario(raw), file).not.toThrow();
      expect(validateScenario(raw).id).toBeTruthy();
    }
  });

  it('accepts ephemeral messages inline in applyState layers.messages', () => {
    const scenario = makeScenario([
      {
        type: 'applyState',
        layers: {
          messages: [
            {
              author: { name: 'Alice' },
              content: 'channel msg',
            },
            {
              author: { name: 'Bot', bot: true },
              ephemeral: true,
              interaction: {
                type: 4,
                data: { flags: 64, content: 'Only you see this' },
              },
            },
          ],
        },
      },
    ]);

    expect(validateScenario(scenario)).toEqual(scenario);
  });
});
