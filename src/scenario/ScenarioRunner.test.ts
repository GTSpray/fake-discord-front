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
    expect(state.emojis).toEqual([]);
    expect(state.slash).toBeNull();
    expect(state.modal).toBeNull();
    expect(state.chrome.channel.name).toBe('general');
  });

  it('indexes scenario emojis into the initial playback state', () => {
    const scenario = makeScenario([{ type: 'wait', ms: 1 }], {
      emojis: [
        {
          id: '42',
          name: 'party',
          url: 'https://cdn.example/party.gif',
          animated: true,
        },
      ],
    });

    expect(createInitialState(scenario).emojis).toEqual(scenario.emojis);
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

  it('picks a random keystroke delay between 150 and 200 ms', async () => {
    const samples = new Set<number>();

    for (let i = 0; i < 30; i++) {
      let capturedMsPerChar: number | undefined;
      const runner = new ScenarioRunner(
        makeScenario([{ type: 'focusInput' }, { type: 'type', text: '/poll' }]),
      );
      runner.subscribe((snapshot) => {
        const ms = snapshot.state.slash?.typingAnimation?.msPerChar;
        if (ms !== undefined) capturedMsPerChar = ms;
      });
      const playPromise = runner.play();
      await vi.runAllTimersAsync();
      await playPromise;
      expect(capturedMsPerChar).toBeGreaterThanOrEqual(150);
      expect(capturedMsPerChar).toBeLessThanOrEqual(200);
      if (capturedMsPerChar !== undefined) samples.add(capturedMsPerChar);
    }

    expect(samples.size).toBeGreaterThan(1);
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
          { type: 'type', text: '/poll create' },
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
          { type: 'type', text: '/poll create' },
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

  it('shows a pending bot reply before openModal', async () => {
    const runner = new ScenarioRunner(
      makeScenario(
        [
          { type: 'focusInput' },
          { type: 'type', text: '/poll create' },
          { type: 'pressEnter' },
          {
            type: 'openModal',
            modal: {
              type: 9,
              data: {
                title: 'Créer un sondage',
                components: [],
              },
            },
          },
        ],
        {
          defaults: { botResponseMs: 300, botPendingText: 'Waiting…' },
        },
      ),
    );

    const pendingTexts: (string | undefined)[] = [];
    let sawPendingBeforeModal = false;
    runner.subscribe((snapshot) => {
      pendingTexts.push(snapshot.state.pendingBotReply?.text);
      if (snapshot.state.pendingBotReply && !snapshot.state.modal) {
        sawPendingBeforeModal = true;
      }
    });

    const playPromise = runner.play();
    await vi.runAllTimersAsync();
    await playPromise;

    expect(sawPendingBeforeModal).toBe(true);
    expect(pendingTexts).toContain('Waiting…');
    expect(runner.getState().pendingBotReply).toBeNull();
    expect(runner.getState().modal?.data.title).toBe('Créer un sondage');
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
        { type: 'type', text: '/alias set' },
        {
          type: 'setSlashParams',
          params: [
            { name: 'alias', description: 'alias du message' },
            { name: 'message', description: 'contenu du message' },
          ],
        },
        { type: 'typeSlashParam', param: 'alias', text: 'toto' },
        { type: 'typeSlashParam', param: 'message', text: 'Hello' },
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
