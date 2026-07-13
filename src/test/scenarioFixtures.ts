import type { Scenario, ScenarioAction } from '../lib/scenarioTypes.ts';

export function makeScenario(actions: ScenarioAction[], overrides?: Partial<Scenario>): Scenario {
  return {
    id: 'test-scenario',
    title: 'Test scenario',
    chrome: {
      guild: { name: 'Demo guild' },
      channel: { name: 'general' },
      viewer: { name: 'Alice', status: 'Online' },
    },
    actions,
    ...overrides,
  };
}
