import type {
  PendingBotReply,
  PlaybackState,
  Scenario,
  ScenarioAction,
  ScenarioPlayerSnapshot,
  ScenarioStatus,
} from '../lib/scenarioTypes.ts';
import { resolveScenarioEmojis } from '../lib/emojiResolve.ts';
import {
  resolveApplyState,
  resolveEphemeral,
  resolveModal,
  resolveModalFill,
  resolveScenarioChrome,
  resolveSuggestions,
  resolveUserMessage,
} from '../lib/scenarioResolve.ts';
import { formatSlashInvocationCommand } from '../lib/slashCommand.ts';
import {
  commandMatchRevealAfter,
  resolveCommandMatchSuggestions,
} from '../lib/slashCommandMatch.ts';
import type {
  ModalLayer,
  SlashCommandParam,
  SlashInvocation,
  Author,
  ChannelMessage,
  SlashLayer,
} from '../lib/types.ts';
import { DEFAULT_BOT_NAME, resolveViewer } from '../lib/types.ts';
import { formatSkyraClockTime } from '../lib/skyraTimestamp.ts';
import { runCursorClick } from './cursorBridge.ts';
import { runTyping } from './typingBridge.ts';

/** Pause avant de continuer à taper dans la barre slash (ex. entre "/poll" et " create") */
const DEFAULT_DELAY_BEFORE_TYPING_MS = 1250;
/** Pause avant de remplir chaque champ de modale */
const DEFAULT_DELAY_BEFORE_MODAL_FIELD_MS = 900;
/** Pause avant modale / éphémère / message bot */
const DEFAULT_BOT_RESPONSE_MS = 1200;
const DEFAULT_BOT_PENDING_TEXT = 'Sending command...';
/** Random keystroke delay for type / typeSlashParam (ms) */
export const DEFAULT_MS_PER_CHAR_MIN = 150;
export const DEFAULT_MS_PER_CHAR_MAX = 200;

export function randomMsPerChar(
  min = DEFAULT_MS_PER_CHAR_MIN,
  max = DEFAULT_MS_PER_CHAR_MAX,
): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function defaultBotAuthor(): Author {
  return { name: DEFAULT_BOT_NAME, bot: true };
}

/** Message bot de la réponse à venir (ignore l’historique du salon dans applyState). */
function findPendingReplyMessage(
  messages: ChannelMessage[] | undefined,
): ChannelMessage | undefined {
  if (!messages?.length) return undefined;
  return (
    messages.find((m) => m.interaction) ??
    messages.find((m) => m.slashInvocation) ??
    messages.find((m) => m.author?.bot)
  );
}

function formatPendingTimestamp(): string {
  return formatSkyraClockTime(new Date());
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(id);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

function emptyModalValues(modal: ModalLayer): ModalLayer {
  return {
    ...modal,
    values: {},
    roleDisplay: modal.roleDisplay
      ? Object.fromEntries(Object.keys(modal.roleDisplay).map((k) => [k, '']))
      : undefined,
  };
}

export function createInitialState(scenario: Scenario): PlaybackState {
  return {
    chrome: resolveScenarioChrome(scenario),
    emojis: resolveScenarioEmojis(scenario.emojis),
    messages: [],
    slash: null,
    modal: null,
    modalClosing: false,
    ephemeral: null,
    highlightedButton: null,
    loadingButton: null,
    cursorTarget: null,
    pendingBotReply: null,
  };
}

export type StateListener = (snapshot: ScenarioPlayerSnapshot) => void;

export class ScenarioRunner {
  private state: PlaybackState;
  private actionIndex = 0;
  private completedActionIndex = -1;
  private status: ScenarioStatus = 'idle';
  private abort?: AbortController;
  private pauseGate?: { resolve: () => void };
  private listeners = new Set<StateListener>();
  private typingId = 0;
  private captureStepMode = false;
  private captureStepGate?: { resolve: () => void };

  constructor(private scenario: Scenario) {
    this.state = createInitialState(scenario);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      this.captureStepMode = params.get('capture_steps') === '1';
    }
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  private emit() {
    const snap = this.snapshot();
    for (const listener of this.listeners) listener(snap);
    if (typeof window !== 'undefined') {
      (window as ScenarioWindow).__SCENARIO_PLAYER__ = {
        status: snap.status,
        actionIndex: snap.actionIndex,
        completedActionIndex: this.completedActionIndex,
        totalActions: snap.totalActions,
        scenarioId: this.scenario.id,
      };
      window.__SCENARIO_CAPTURE_NEXT_STEP__ = () => {
        this.captureStepGate?.resolve();
        this.captureStepGate = undefined;
      };
      window.dispatchEvent(new CustomEvent('scenario-player-update', { detail: snap }));
      if (snap.status === 'done') {
        window.dispatchEvent(new CustomEvent('scenario-complete', { detail: snap }));
      }
    }
  }

  private snapshot(): ScenarioPlayerSnapshot {
    return {
      status: this.status,
      actionIndex: this.actionIndex,
      totalActions: this.scenario.actions.length,
      state: structuredClone(this.state),
    };
  }

  private patch(partial: Partial<PlaybackState>) {
    this.state = { ...this.state, ...partial };
    this.emit();
  }

  private async waitIfPaused() {
    while (this.status === 'paused') {
      await new Promise<void>((resolve) => {
        this.pauseGate = { resolve };
      });
    }
  }

  private async waitForCaptureStep(signal: AbortSignal) {
    if (!this.captureStepMode) return;
    await new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      this.captureStepGate = { resolve };
      signal.addEventListener('abort', () => {
        this.captureStepGate = undefined;
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });
  }

  async play() {
    if (this.status === 'playing') return;

    const isFresh = this.status === 'idle' || this.status === 'done';
    if (isFresh) {
      this.abort?.abort();
      this.abort = new AbortController();
      this.actionIndex = 0;
      this.completedActionIndex = -1;
      this.state = createInitialState(this.scenario);
    } else if (!this.abort) {
      this.abort = new AbortController();
    }

    const signal = this.abort!.signal;
    this.status = 'playing';
    this.emit();

    try {
      for (; this.actionIndex < this.scenario.actions.length; this.actionIndex++) {
        await this.waitIfPaused();
        if (signal.aborted) return;

        const action = this.scenario.actions[this.actionIndex];
        await this.runAction(action, signal);
        this.completedActionIndex = this.actionIndex;
        this.emit();
        await this.waitForCaptureStep(signal);
      }
      this.status = 'done';
      this.emit();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (this.status === 'playing') {
          this.status = 'idle';
          this.emit();
        }
        return;
      }
      throw err;
    }
  }

  pause() {
    if (this.status !== 'playing') return;
    this.status = 'paused';
    this.emit();
  }

  resume() {
    if (this.status !== 'paused') return;
    this.status = 'playing';
    this.pauseGate?.resolve();
    this.pauseGate = undefined;
    this.emit();
  }

  stop() {
    this.abort?.abort();
    this.status = 'idle';
    this.actionIndex = 0;
    this.completedActionIndex = -1;
    this.state = createInitialState(this.scenario);
    this.emit();
  }

  getState(): PlaybackState {
    return structuredClone(this.state);
  }

  private isBotResponseAction(action: ScenarioAction | undefined): boolean {
    if (!action) return false;
    switch (action.type) {
      case 'openModal':
      case 'showEphemeral':
        return true;
      case 'applyState':
        return Boolean(action.layers?.messages?.length || action.layers?.ephemeral);
      default:
        return false;
    }
  }

  private getResponseDelayMs(action: ScenarioAction): number | undefined {
    if ('responseDelayMs' in action && action.responseDelayMs !== undefined) {
      return action.responseDelayMs;
    }
    return undefined;
  }

  private nextAction(): ScenarioAction | undefined {
    return this.scenario.actions[this.actionIndex + 1];
  }

  private shouldShowPendingReply(
    next: ScenarioAction,
    trigger: 'pressEnter' | 'submitModal' | 'clickButton',
  ): boolean {
    if (next.type === 'openModal') return true;
    if (next.type === 'showEphemeral') return true;
    if (next.type === 'applyState') {
      if (trigger === 'pressEnter') {
        return Boolean(next.layers?.messages?.length);
      }
      if (trigger === 'submitModal') return false;
      return false;
    }
    return false;
  }

  private resolveSlashInvocationForPending(next: ScenarioAction): SlashInvocation | undefined {
    if (next.type === 'applyState') {
      const msg = findPendingReplyMessage(next.layers?.messages);
      if (msg?.slashInvocation) return msg.slashInvocation;
    }
    if (next.type === 'showEphemeral') {
      return next.ephemeral.slashInvocation;
    }
    const input = this.state.slash?.input ?? '';
    if (input.startsWith('/')) {
      const viewer = resolveViewer(this.state.chrome);
      const command = formatSlashInvocationCommand(input, this.state.slash?.params);
      return {
        user: {
          name: viewer.name,
          ...(viewer.avatarUrl ? { avatarUrl: viewer.avatarUrl } : {}),
        },
        command,
      };
    }
    return this.state.ephemeral?.slashInvocation;
  }

  private resolveAuthorForPending(next: ScenarioAction): Author {
    if (next.type === 'applyState') {
      const msg = findPendingReplyMessage(next.layers?.messages);
      if (msg?.author) return msg.author;
    }
    if (next.type === 'showEphemeral' && next.ephemeral.author) {
      return next.ephemeral.author;
    }
    return defaultBotAuthor();
  }

  private buildPendingReply(next: ScenarioAction, ephemeral: boolean): PendingBotReply {
    return {
      slashInvocation: this.resolveSlashInvocationForPending(next),
      text: this.scenario.defaults?.botPendingText ?? DEFAULT_BOT_PENDING_TEXT,
      timestamp: formatPendingTimestamp(),
      ephemeral,
      author: this.resolveAuthorForPending(next),
    };
  }

  private async awaitBotResponseAfterUserAction(
    signal: AbortSignal,
    trigger: 'submitModal' | 'clickButton',
  ) {
    const next = this.nextAction();
    if (!next || !this.isBotResponseAction(next)) return;
    if (this.shouldShowPendingReply(next, trigger)) {
      this.patch({
        pendingBotReply: this.buildPendingReply(next, trigger === 'submitModal'),
      });
    }
    await this.awaitBotResponse(signal, this.getResponseDelayMs(next));
  }

  private async awaitBotResponse(signal: AbortSignal, responseDelayMs?: number) {
    if (this.captureStepMode) return;

    const ms = responseDelayMs ?? this.scenario.defaults?.botResponseMs ?? DEFAULT_BOT_RESPONSE_MS;
    if (ms <= 0) {
      this.patch({ pendingBotReply: null });
      return;
    }

    await sleep(ms, signal);
  }

  private async runAction(action: ScenarioAction, signal: AbortSignal) {
    switch (action.type) {
      case 'wait':
        if (!this.captureStepMode) {
          await sleep(action.ms, signal);
        }
        break;

      case 'focusInput':
        this.patch({
          slash: { input: '', focused: true, suggestions: undefined },
          highlightedButton: null,
          cursorTarget: null,
        });
        break;

      case 'type':
        await this.typeText(action, signal);
        break;

      case 'setSlashParams':
        this.setSlashParams(action);
        break;

      case 'typeSlashParam':
        await this.typeSlashParam(action, signal);
        break;

      case 'pressEnter':
        await this.pressEnter(action, signal);
        break;

      case 'openModal': {
        const modal = resolveModal(action);
        this.patch({
          slash: null,
          modal: emptyModalValues(modal),
          modalClosing: false,
          pendingBotReply: null,
        });
        break;
      }

      case 'fillModal':
        await this.fillModal(action, signal);
        break;

      case 'submitModal':
        if (this.captureStepMode) {
          this.patch({ modal: null, modalClosing: false, highlightedButton: null });
          await this.awaitBotResponseAfterUserAction(signal, 'submitModal');
          break;
        }
        this.patch({ modalClosing: true, highlightedButton: null });
        await sleep(280, signal);
        this.patch({ modal: null, modalClosing: false });
        await this.awaitBotResponseAfterUserAction(signal, 'submitModal');
        break;

      case 'showEphemeral': {
        const ephemeral = resolveEphemeral(action);
        this.patch({
          ephemeral,
          modal: null,
          slash: null,
          pendingBotReply: null,
          loadingButton: null,
        });
        break;
      }

      case 'clickButton': {
        if (this.captureStepMode) {
          this.patch({ highlightedButton: action.label, cursorTarget: null, loadingButton: null });
          const next = this.nextAction();
          if (next && this.isBotResponseAction(next)) {
            this.patch({ highlightedButton: null, loadingButton: action.label });
            await this.awaitBotResponseAfterUserAction(signal, 'clickButton');
          }
          break;
        }
        this.patch({ cursorTarget: action.label, highlightedButton: null, loadingButton: null });
        await runCursorClick(signal);
        this.patch({ highlightedButton: action.label, cursorTarget: null });
        await sleep(220, signal);
        const next = this.nextAction();
        if (next && this.isBotResponseAction(next)) {
          this.patch({ highlightedButton: null, loadingButton: action.label });
          await this.awaitBotResponseAfterUserAction(signal, 'clickButton');
        } else {
          this.patch({ highlightedButton: null });
        }
        break;
      }

      case 'applyState': {
        const resolved = resolveApplyState(action);
        this.patch({
          chrome: resolved.chrome ?? this.state.chrome,
          messages: resolved.messages,
          slash: resolved.slash,
          modal: resolved.modal,
          ephemeral: resolved.ephemeral,
          modalClosing: false,
          highlightedButton: null,
          loadingButton: null,
          cursorTarget: null,
          pendingBotReply: null,
        });
        if (action.holdMs && !this.captureStepMode) await sleep(action.holdMs, signal);
        break;
      }
    }
  }

  private resolveTypeSlashSuggestions(
    action: Extract<ScenarioAction, { type: 'type' }>,
    input: string,
  ): Pick<SlashLayer, 'suggestions' | 'suggestionMode' | 'activeSuggestionIndex'> {
    const revealConfig = action.revealSuggestions;
    if (!revealConfig) return {};

    if ((revealConfig.mode ?? 'subcommand') === 'subcommand') {
      const resolved = resolveSuggestions(revealConfig);
      return {
        suggestions: resolved.suggestions,
        suggestionMode: resolved.mode,
        activeSuggestionIndex: resolved.activeIndex,
      };
    }

    const auto = resolveCommandMatchSuggestions(
      input,
      revealConfig.suggestions,
      revealConfig.activeIndex,
    );
    return {
      suggestions: auto?.suggestions,
      suggestionMode: auto?.mode,
      activeSuggestionIndex: auto?.activeIndex,
    };
  }

  private resolveMsPerChar(): number {
    return randomMsPerChar();
  }

  private resolveRevealAfter(
    action: Extract<ScenarioAction, { type: 'type' }>,
    from: string,
    to: string,
  ): string | undefined {
    const revealConfig = action.revealSuggestions;
    if (!revealConfig) return undefined;
    if (revealConfig.after) return revealConfig.after;
    if (revealConfig.mode === 'commandMatch') {
      return commandMatchRevealAfter(from, to);
    }
    return undefined;
  }

  private async typeText(action: Extract<ScenarioAction, { type: 'type' }>, signal: AbortSignal) {
    const current = this.state.slash ?? { input: '', focused: true };
    const from = current.input;
    const to = from + action.text;

    if (this.captureStepMode) {
      const resolved = this.resolveTypeSlashSuggestions(action, to);
      this.patch({
        slash: {
          ...current,
          input: to,
          focused: true,
          ...resolved,
          typingAnimation: undefined,
        },
      });
      return;
    }

    const ms = this.resolveMsPerChar();
    const typingId = ++this.typingId;
    const revealAfter = this.resolveRevealAfter(action, from, to);

    const delayBefore =
      action.delayBeforeMs ?? (from.length > 0 ? DEFAULT_DELAY_BEFORE_TYPING_MS : 0);
    if (delayBefore > 0) {
      await sleep(delayBefore, signal);
    }

    await runTyping(signal, {
      onStart: () => {
        this.patch({
          slash: {
            ...current,
            input: to,
            focused: true,
            typingAnimation: {
              id: typingId,
              from,
              to,
              msPerChar: ms,
              revealAfter,
            },
          },
        });
      },
      onReveal: () => {
        if (!revealAfter || !this.state.slash) return;
        const resolved = this.resolveTypeSlashSuggestions(action, revealAfter);
        if (!resolved.suggestions?.length) return;
        this.patch({
          slash: {
            ...this.state.slash,
            ...resolved,
          },
        });
      },
      onDone: () => {
        const resolved = this.resolveTypeSlashSuggestions(action, to);
        this.patch({
          slash: {
            ...current,
            input: to,
            focused: true,
            ...resolved,
            typingAnimation: undefined,
          },
        });
      },
    });
  }

  private setSlashParams(action: Extract<ScenarioAction, { type: 'setSlashParams' }>) {
    const current = this.state.slash ?? { input: '', focused: true };
    const params: SlashCommandParam[] = action.params.map((param) => ({
      name: param.name,
      ...(param.description ? { description: param.description } : {}),
      ...(param.value !== undefined ? { value: param.value } : {}),
    }));

    this.patch({
      slash: {
        ...current,
        focused: true,
        params,
        activeParamIndex: action.activeParamIndex ?? 0,
        suggestions: undefined,
        suggestionMode: undefined,
        activeSuggestionIndex: undefined,
        typingAnimation: undefined,
        paramTypingAnimation: undefined,
      },
    });
  }

  private async typeSlashParam(
    action: Extract<ScenarioAction, { type: 'typeSlashParam' }>,
    signal: AbortSignal,
  ) {
    if (!this.state.slash?.params?.length) return;

    const paramIndex = this.state.slash.params.findIndex((param) => param.name === action.param);
    if (paramIndex < 0) return;

    const params = this.state.slash.params.map((param) => ({ ...param }));
    const from = params[paramIndex].value ?? '';
    const to = from + action.text;
    const slashBase = this.state.slash;

    if (this.captureStepMode) {
      params[paramIndex] = { ...params[paramIndex], value: to };
      const nextActiveIndex = paramIndex + 1 < params.length ? paramIndex + 1 : paramIndex;
      this.patch({
        slash: {
          ...slashBase,
          params,
          activeParamIndex: nextActiveIndex,
          focused: true,
          paramTypingAnimation: undefined,
        },
      });
      return;
    }

    const ms = this.resolveMsPerChar();
    const typingId = ++this.typingId;

    const delayBefore =
      action.delayBeforeMs ?? (from.length > 0 ? DEFAULT_DELAY_BEFORE_TYPING_MS : 0);
    if (delayBefore > 0) {
      await sleep(delayBefore, signal);
    }

    await runTyping(signal, {
      onStart: () => {
        params[paramIndex] = { ...params[paramIndex], value: to };
        this.patch({
          slash: {
            ...slashBase,
            params,
            activeParamIndex: paramIndex,
            focused: true,
            paramTypingAnimation: {
              id: typingId,
              paramIndex,
              from,
              to,
              msPerChar: ms,
            },
          },
        });
      },
      onDone: () => {
        params[paramIndex] = { ...params[paramIndex], value: to };
        const nextActiveIndex = paramIndex + 1 < params.length ? paramIndex + 1 : paramIndex;
        this.patch({
          slash: {
            ...slashBase,
            params,
            activeParamIndex: nextActiveIndex,
            focused: true,
            paramTypingAnimation: undefined,
          },
        });
      },
    });
  }

  private async pressEnter(
    action: Extract<ScenarioAction, { type: 'pressEnter' }>,
    signal: AbortSignal,
  ) {
    const messages = [...this.state.messages];
    if (action.userMessage) {
      const msg = resolveUserMessage(action.userMessage);
      if (msg) messages.push(msg);
    }
    const next = this.nextAction();
    const awaitingBot = this.isBotResponseAction(next);
    const showPending = awaitingBot && next && this.shouldShowPendingReply(next, 'pressEnter');

    this.patch({
      messages,
      slash: null,
      pendingBotReply: showPending ? this.buildPendingReply(next!, false) : null,
    });

    if (awaitingBot) {
      await this.awaitBotResponse(signal, this.getResponseDelayMs(next!));
    }
  }

  private async fillModal(
    action: Extract<ScenarioAction, { type: 'fillModal' }>,
    signal: AbortSignal,
  ) {
    const source = resolveModalFill(action);
    if (!this.state.modal) return;

    const targetValues = source.values;
    const fieldIds = Object.keys(targetValues);

    if (this.captureStepMode) {
      const values = Object.fromEntries(
        fieldIds.map((fieldId) => [fieldId, String(targetValues[fieldId] ?? '')]),
      );
      this.patch({
        modal: {
          ...this.state.modal,
          values,
          roleDisplay: source.roleDisplay,
        },
      });
      return;
    }

    const values: Record<string, string | string[] | null> = {
      ...(this.state.modal.values ?? {}),
    };
    const delayBeforeField = action.delayBeforeFieldMs ?? DEFAULT_DELAY_BEFORE_MODAL_FIELD_MS;
    const msPerChar = action.msPerField ?? 100;

    for (const fieldId of fieldIds) {
      if (delayBeforeField > 0) {
        await sleep(delayBeforeField, signal);
      }

      const fullValue = String(targetValues[fieldId] ?? '');
      values[fieldId] = '';

      for (let i = 1; i <= fullValue.length; i++) {
        values[fieldId] = fullValue.slice(0, i);
        this.patch({
          modal: {
            ...this.state.modal,
            values: { ...values },
            roleDisplay: source.roleDisplay,
          },
        });
        await sleep(msPerChar, signal);
      }
    }
  }
}

interface ScenarioWindow extends Window {
  __SCENARIO_PLAYER__?: {
    status: ScenarioStatus;
    actionIndex: number;
    completedActionIndex: number;
    totalActions: number;
    scenarioId: string;
  };
  __SCENARIO_CAPTURE_NEXT_STEP__?: () => void;
}

declare const window: ScenarioWindow;
