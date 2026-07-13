import { describe, expect, it } from 'vitest';
import { makeScenario } from '../test/scenarioFixtures.ts';
import {
  readScenarioUpload,
  restoreUploadedScenario,
  ScenarioParseError,
} from './uploadScenario.ts';
import { UPLOAD_SCENARIO_STORAGE_KEY } from './scenarioTypes.ts';

describe('uploadScenario', () => {
  it('validates JSON when reading an uploaded file', async () => {
    const scenario = makeScenario([{ type: 'focusInput' }]);
    const file = new File([JSON.stringify(scenario)], 'demo.json', {
      type: 'application/json',
    });

    await expect(readScenarioUpload(file)).resolves.toEqual(scenario);
  });

  it('rejects invalid JSON files on upload', async () => {
    const file = new File(['{'], 'broken.json', { type: 'application/json' });
    await expect(readScenarioUpload(file)).rejects.toThrow(/JSON invalide/);
  });

  it('rejects schema violations on upload', async () => {
    const file = new File([JSON.stringify({ title: 'missing id' })], 'bad.json', {
      type: 'application/json',
    });
    await expect(readScenarioUpload(file)).rejects.toThrow(ScenarioParseError);
  });

  it('validates sessionStorage on restore', () => {
    sessionStorage.setItem(UPLOAD_SCENARIO_STORAGE_KEY, JSON.stringify({ title: 'bad' }));

    const restored = restoreUploadedScenario();

    expect(restored.scenario).toBeNull();
    expect(restored.error).toBeTruthy();
    expect(sessionStorage.getItem(UPLOAD_SCENARIO_STORAGE_KEY)).toBeNull();
  });
});
