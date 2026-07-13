import type { ChannelMessage, Chrome, EphemeralLayer, ModalLayer } from './types.ts';
import type { Scenario, ScenarioAction, SlashSuggestion } from './scenarioTypes.ts';

export function resolveScenarioChrome(scenario: Scenario): Chrome {
  return scenario.chrome;
}

export function resolveSuggestions(
  reveal: NonNullable<Extract<ScenarioAction, { type: 'type' }>['revealSuggestions']>,
): SlashSuggestion[] | undefined {
  return reveal.suggestions;
}

export function resolveUserMessage(
  userMessage: NonNullable<Extract<ScenarioAction, { type: 'pressEnter' }>['userMessage']>,
): ChannelMessage | undefined {
  return userMessage;
}

export function resolveModal(action: Extract<ScenarioAction, { type: 'openModal' }>): ModalLayer {
  return action.modal;
}

export function resolveModalFill(action: Extract<ScenarioAction, { type: 'fillModal' }>): {
  values: Record<string, string | string[] | null>;
  roleDisplay?: Record<string, string>;
} {
  return { values: action.values, roleDisplay: action.roleDisplay };
}

export function resolveEphemeral(
  action: Extract<ScenarioAction, { type: 'showEphemeral' }>,
): EphemeralLayer {
  return action.ephemeral;
}

export function resolveApplyState(action: Extract<ScenarioAction, { type: 'applyState' }>): {
  chrome?: Chrome;
  messages: ChannelMessage[];
  slash: null;
  modal: ModalLayer | null;
  ephemeral: EphemeralLayer | null;
} {
  return {
    chrome: action.chrome,
    messages: action.layers?.messages ?? [],
    slash: null,
    modal: action.layers?.modal ?? null,
    ephemeral: action.layers?.ephemeral ?? null,
  };
}
