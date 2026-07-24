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

  it('ignores channel history when resolving pending reply author and invoker', async () => {
    const botAuthor = {
      name: 'Bot',
      bot: true,
      avatarUrl: 'https://example.com/bot.png',
    };
    const runner = new ScenarioRunner(
      makeScenario(
        [
          { type: 'focusInput' },
          { type: 'type', text: '/gimme emoji' },
          { type: 'pressEnter' },
          {
            type: 'applyState',
            layers: {
              messages: [
                {
                  author: { name: 'Alice', color: '#ed4245' },
                  content: 'gg',
                },
                {
                  author: { name: 'Bob', color: '#57f287' },
                  content: '+1',
                },
                {
                  author: botAuthor,
                  slashInvocation: {
                    user: { name: 'You' },
                    command: 'gimme emoji',
                  },
                  interaction: {
                    type: 4,
                    data: { content: 'found' },
                  },
                },
              ],
            },
          },
        ],
        {
          defaults: { botResponseMs: 300, botPendingText: 'Envoi…' },
        },
      ),
    );

    const pending: Array<{
      author?: { name: string };
      invoker?: string;
    }> = [];
    runner.subscribe((snapshot) => {
      const reply = snapshot.state.pendingBotReply;
      if (reply) {
        pending.push({
          author: reply.author,
          invoker: reply.slashInvocation?.user.name,
        });
      }
    });

    const playPromise = runner.play();
    await vi.runAllTimersAsync();
    await playPromise;

    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every((p) => p.author?.name === botAuthor.name)).toBe(true);
    expect(pending.every((p) => p.invoker === 'You')).toBe(true);
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

  it('shows loading dots on the button but not a pending reply after clickButton', async () => {
    const runner = new ScenarioRunner(
      makeScenario(
        [
          {
            type: 'applyState',
            layers: {
              messages: [
                {
                  author: { name: 'Bot', bot: true },
                  content: 'Choose',
                  interaction: {
                    type: 4,
                    data: {
                      components: [
                        {
                          type: 1,
                          components: [{ type: 2, style: 1, label: 'Publier' }],
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
          { type: 'clickButton', label: 'Publier' },
          {
            type: 'applyState',
            layers: {
              messages: [
                {
                  author: { name: 'Bot', bot: true },
                  content: 'Published',
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

    let sawPending = false;
    let sawLoadingButton = false;
    runner.subscribe((snapshot) => {
      if (snapshot.state.pendingBotReply) sawPending = true;
      if (snapshot.state.loadingButton === 'Publier') sawLoadingButton = true;
    });

    const playPromise = runner.play();
    await vi.runAllTimersAsync();
    await playPromise;

    expect(sawPending).toBe(false);
    expect(sawLoadingButton).toBe(true);
    expect(runner.getState().messages[0]?.content).toBe('Published');
  });

  it('does not show pending reply when clickButton opens a modal', async () => {
    const runner = new ScenarioRunner(
      makeScenario(
        [
          {
            type: 'applyState',
            layers: {
              messages: [
                {
                  author: { name: 'Bot', bot: true },
                  content: 'Choose',
                  interaction: {
                    type: 4,
                    data: {
                      components: [
                        {
                          type: 1,
                          components: [{ type: 2, style: 1, label: 'Ajouter' }],
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
          { type: 'clickButton', label: 'Ajouter' },
          {
            type: 'openModal',
            modal: {
              type: 9,
              data: {
                title: 'Ajouter des choix',
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

    let sawPending = false;
    let sawLoadingButton = false;
    runner.subscribe((snapshot) => {
      if (snapshot.state.pendingBotReply) sawPending = true;
      if (snapshot.state.loadingButton === 'Ajouter') sawLoadingButton = true;
    });

    const playPromise = runner.play();
    await vi.runAllTimersAsync();
    await playPromise;

    expect(sawPending).toBe(false);
    expect(sawLoadingButton).toBe(true);
    expect(runner.getState().modal?.data.title).toBe('Ajouter des choix');
  });

  it('focuses each modal field while fillModal types into it', async () => {
    const runner = new ScenarioRunner(
      makeScenario([
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
        {
          type: 'fillModal',
          values: { title: 'Hi', question: 'When?' },
          msPerField: 10,
          delayBeforeFieldMs: 0,
        },
      ]),
    );

    const focusedSequence: Array<string | null | undefined> = [];
    runner.subscribe((snapshot) => {
      const field = snapshot.state.modal?.focusedField;
      if (field !== focusedSequence[focusedSequence.length - 1]) {
        focusedSequence.push(field);
      }
    });

    const playPromise = runner.play();
    await vi.runAllTimersAsync();
    await playPromise;

    expect(focusedSequence).toEqual(['title', 'question']);
    expect(runner.getState().modal?.focusedField).toBe('question');
    expect(runner.getState().modal?.values).toEqual({
      title: 'Hi',
      question: 'When?',
    });
  });

  it('opens a modal select with the cursor then picks an option', async () => {
    const runner = new ScenarioRunner(
      makeScenario([
        {
          type: 'openModal',
          modal: {
            type: 9,
            data: {
              title: 'Créer un sondage',
              components: [
                {
                  type: 18,
                  label: 'Role des sondés',
                  component: { type: 6, custom_id: 'role', required: false },
                },
              ],
            },
          },
        },
        {
          type: 'selectModalOption',
          field: 'role',
          option: '@Modérateurs',
          options: [
            { label: '@everyone', memberCount: 12 },
            { label: '@Modérateurs', memberCount: 1 },
            { label: '@Membres', memberCount: 8 },
          ],
        },
      ]),
    );

    const cursorTargets: Array<string | null> = [];
    const openWhileFocused: Array<{
      open: string | null | undefined;
      focused: string | null | undefined;
    }> = [];
    runner.subscribe((snapshot) => {
      const target = snapshot.state.cursorTarget;
      if (target !== cursorTargets[cursorTargets.length - 1]) {
        cursorTargets.push(target);
      }
      const open = snapshot.state.modal?.openSelectField;
      const focused = snapshot.state.modal?.focusedField;
      const last = openWhileFocused[openWhileFocused.length - 1];
      if (!last || last.open !== open || last.focused !== focused) {
        openWhileFocused.push({ open, focused });
      }
    });

    const playPromise = runner.play();
    await vi.runAllTimersAsync();
    await playPromise;

    expect(cursorTargets).toContain('__modalSelect:role');
    expect(cursorTargets).toContain('__modalSelectOption:@Modérateurs');
    expect(cursorTargets.indexOf('__modalSelect:role')).toBeLessThan(
      cursorTargets.indexOf('__modalSelectOption:@Modérateurs'),
    );
    expect(openWhileFocused).toContainEqual({ open: 'role', focused: 'role' });
    expect(runner.getState().modal?.roleDisplay).toEqual({ role: '@Modérateurs' });
    expect(runner.getState().modal?.openSelectField).toBeNull();
    expect(runner.getState().modal?.focusedField).toBe('role');
  });

  it('shows loading on modal submit but not a pending reply', async () => {
    const runner = new ScenarioRunner(
      makeScenario(
        [
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
          { type: 'submitModal' },
          {
            type: 'showEphemeral',
            ephemeral: {
              author: { name: 'Bot', bot: true },
              type: 4,
              data: { flags: 64, content: 'Done' },
            },
          },
        ],
        {
          defaults: { botResponseMs: 300, botPendingText: 'Waiting…' },
        },
      ),
    );

    let sawSubmitting = false;
    let sawPending = false;
    let sawSubmittingWhileModalOpen = false;
    let sawCursorOnSubmit = false;
    runner.subscribe((snapshot) => {
      if (snapshot.state.cursorTarget === '__modalSubmit') {
        sawCursorOnSubmit = true;
      }
      if (snapshot.state.modalSubmitting) {
        sawSubmitting = true;
        if (snapshot.state.modal && !snapshot.state.modalClosing) {
          sawSubmittingWhileModalOpen = true;
        }
      }
      if (snapshot.state.pendingBotReply) sawPending = true;
    });

    const playPromise = runner.play();
    await vi.runAllTimersAsync();
    await playPromise;

    expect(sawCursorOnSubmit).toBe(true);
    expect(sawSubmitting).toBe(true);
    expect(sawSubmittingWhileModalOpen).toBe(true);
    expect(sawPending).toBe(false);
    expect(runner.getState().modal).toBeNull();
    expect(runner.getState().ephemeral?.data?.content).toBe('Done');
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
