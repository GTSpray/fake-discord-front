import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeScenario } from '../test/scenarioFixtures.ts';
import { createInitialState, ScenarioRunner } from './ScenarioRunner.ts';

vi.mock('./typingBridge.ts', () => ({
  runTyping: vi.fn(async (_signal, handlers) => {
    handlers.onStart();
    handlers.onReveal?.();
    handlers.onDone();
  }),
  revealTyping: vi.fn(),
  completeTyping: vi.fn(),
}));

vi.mock('./cursorBridge.ts', () => ({
  runCursorClick: vi.fn(async () => {}),
}));

describe('ScenarioRunner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates an empty initial playback state', () => {
    const scenario = makeScenario([{ type: 'wait', ms: 1 }]);
    const state = createInitialState(scenario);

    expect(state.messages).toEqual([]);
    expect(state.slash).toBeNull();
    expect(state.modal).toBeNull();
    expect(state.chrome.channel.name).toBe('general');
  });

  it('plays wait and focusInput actions', async () => {
    const runner = new ScenarioRunner(
      makeScenario([{ type: 'wait', ms: 500 }, { type: 'focusInput' }]),
    );

    const playPromise = runner.play();
    await vi.runAllTimersAsync();
    await playPromise;

    const snapshot = runner.getState();
    expect(snapshot.slash).toEqual({ input: '', focused: true, suggestions: undefined });
  });

  it('uses the interaction author for the pending bot reply', async () => {
    const botAuthor = {
      name: 'Bot',
      bot: true,
      avatarUrl: 'https://example.com/bot.png',
    };
    const runner = new ScenarioRunner(
      makeScenario(
        [
          { type: 'focusInput' },
          { type: 'type', text: '/poll create', msPerChar: 0 },
          { type: 'pressEnter' },
          {
            type: 'applyState',
            layers: {
              messages: [
                {
                  author: botAuthor,
                  content: 'Done',
                  slashInvocation: {
                    user: { name: 'Alice' },
                    command: 'poll create',
                  },
                },
              ],
            },
          },
        ],
        {
          defaults: { botResponseMs: 300, botPendingText: 'Waiting…' },
        },
      ),
    );

    const pendingAuthors: (typeof botAuthor | undefined)[] = [];
    runner.subscribe((snapshot) => {
      pendingAuthors.push(snapshot.state.pendingBotReply?.author);
    });

    const playPromise = runner.play();
    await vi.runAllTimersAsync();
    await playPromise;

    expect(pendingAuthors).toContainEqual(botAuthor);
  });

  it('shows a pending bot reply before applyState messages', async () => {
    const runner = new ScenarioRunner(
      makeScenario(
        [
          { type: 'focusInput' },
          { type: 'type', text: '/poll create', msPerChar: 0 },
          { type: 'pressEnter' },
          {
            type: 'applyState',
            layers: {
              messages: [
                {
                  author: { name: 'Bot', bot: true },
                  content: 'Done',
                  slashInvocation: {
                    user: { name: 'Alice' },
                    command: 'poll create',
                  },
                },
              ],
            },
          },
        ],
        {
          defaults: { botResponseMs: 300, botPendingText: 'Waiting…' },
        },
      ),
    );

    const statuses: string[] = [];
    runner.subscribe((snapshot) => {
      statuses.push(snapshot.status);
    });

    const playPromise = runner.play();
    await vi.runAllTimersAsync();
    await playPromise;

    expect(statuses.at(-1)).toBe('done');
    expect(runner.getState().messages).toHaveLength(1);
    expect(runner.getState().messages[0]?.content).toBe('Done');
  });

  it('stop resets playback to idle', async () => {
    const runner = new ScenarioRunner(makeScenario([{ type: 'wait', ms: 10_000 }]));

    const playPromise = runner.play();
    await vi.advanceTimersByTimeAsync(100);
    runner.stop();
    await playPromise;

    expect(runner.getState().messages).toEqual([]);
  });

  it('pause and resume keep progress', async () => {
    const runner = new ScenarioRunner(
      makeScenario([{ type: 'wait', ms: 1000 }, { type: 'focusInput' }]),
    );

    let actionIndexWhilePaused = -1;
    runner.subscribe((snapshot) => {
      if (snapshot.status === 'paused') {
        actionIndexWhilePaused = snapshot.actionIndex;
      }
    });

    const playPromise = runner.play();
    await vi.advanceTimersByTimeAsync(200);
    runner.pause();
    await vi.advanceTimersByTimeAsync(500);

    expect(actionIndexWhilePaused).toBe(0);
    expect(runner.getState().slash).toBeNull();

    runner.resume();
    await vi.runAllTimersAsync();
    await playPromise;

    expect(runner.getState().slash?.focused).toBe(true);
  });

  it('types slash command params one step at a time', async () => {
    const runner = new ScenarioRunner(
      makeScenario([
        { type: 'focusInput' },
        { type: 'type', text: '/alias set', msPerChar: 0 },
        {
          type: 'setSlashParams',
          params: [
            { name: 'alias', description: 'alias du message' },
            { name: 'message', description: 'contenu du message' },
          ],
        },
        { type: 'typeSlashParam', param: 'alias', text: 'toto', msPerChar: 0 },
        { type: 'typeSlashParam', param: 'message', text: 'Hello', msPerChar: 0 },
      ]),
    );

    const playPromise = runner.play();
    await vi.runAllTimersAsync();
    await playPromise;

    const slash = runner.getState().slash;
    expect(slash?.params).toEqual([
      { name: 'alias', description: 'alias du message', value: 'toto' },
      { name: 'message', description: 'contenu du message', value: 'Hello' },
    ]);
    expect(slash?.activeParamIndex).toBe(1);
  });

  it('reveals command match suggestions after three characters', async () => {
    const runner = new ScenarioRunner(
      makeScenario([
        { type: 'focusInput' },
        {
          type: 'type',
          text: '/alias set',
          msPerChar: 0,
          revealSuggestions: {
            mode: 'commandMatch',
            activeIndex: 2,
            suggestions: [
              { name: '/alias ls', description: 'liste', botName: 'Bot' },
              { name: '/alias set', description: 'definit', botName: 'Bot' },
            ],
          },
        },
      ]),
    );

    const playPromise = runner.play();
    await vi.runAllTimersAsync();
    await playPromise;

    const slash = runner.getState().slash;
    expect(slash?.input).toBe('/alias set');
    expect(slash?.suggestionMode).toBe('commandMatch');
    expect(slash?.suggestions).toEqual([
      { name: '/alias set', description: 'definit', botName: 'Bot' },
    ]);
  });
});
