import { useRef } from 'react';
import { isThreadActive } from '../lib/types.ts';
import type { PlaybackState } from '../lib/scenarioTypes.ts';
import { ChannelView } from '../render/ChannelView.tsx';
import { DiscordShell } from '../render/DiscordShell.tsx';
import { DiscordMessageInput } from '../render/DiscordMessageInput.tsx';
import { EmojiRegistryProvider } from '../render/EmojiRegistry.tsx';
import { ModalOverlay } from '../render/ModalOverlay.tsx';
import { ScenarioCursor } from '../render/ScenarioCursor.tsx';
import { SlashBar } from '../render/SlashBar.tsx';

interface ScenarioCanvasProps {
  state: PlaybackState;
  scenarioDone?: boolean;
}

export function ScenarioCanvas({ state, scenarioDone }: ScenarioCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const {
    chrome,
    emojis,
    messages,
    slash,
    modal,
    modalClosing,
    modalSubmitting,
    ephemeral,
    highlightedButton,
    loadingButton,
    cursorTarget,
    pendingBotReply,
  } = state;

  const threadActive = isThreadActive(chrome);
  const inputChannelName = threadActive && chrome.thread ? chrome.thread.name : chrome.channel.name;

  return (
    <EmojiRegistryProvider emojis={emojis}>
      <div
        ref={canvasRef}
        className="studio-canvas"
        data-scenario-playing={state ? 'true' : undefined}
      >
        <DiscordShell
          chrome={chrome}
          inputBar={
            slash ? (
              <SlashBar slash={slash} channelName={inputChannelName} />
            ) : (
              <DiscordMessageInput channelName={inputChannelName} />
            )
          }
        >
          <div className="channel-content">
            <ChannelView
              messages={messages}
              ephemeral={ephemeral}
              pendingBotReply={pendingBotReply}
              highlightedButton={highlightedButton}
              loadingButton={loadingButton}
              guildName={chrome.guild.name}
              channelName={inputChannelName}
              showWelcome={false}
              threadIntro={
                threadActive && chrome.thread
                  ? { name: chrome.thread.name, startedBy: chrome.thread.startedBy }
                  : null
              }
            />
          </div>
        </DiscordShell>

        {modal && (
          <ModalOverlay
            modal={modal}
            closing={modalClosing}
            submitting={modalSubmitting}
            useTopLayer={false}
          />
        )}

        <ScenarioCursor target={cursorTarget} canvasRef={canvasRef} returnHome={scenarioDone} />
      </div>
    </EmojiRegistryProvider>
  );
}
