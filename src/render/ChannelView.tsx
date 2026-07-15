import {
  DiscordCommand,
  DiscordMessage,
  DiscordMessages,
  DiscordReply,
} from '@skyra/discord-components-react';
import { useEffect, useRef } from 'react';
import type { ChannelMessage, EphemeralLayer } from '../lib/types.ts';
import type { PendingBotReply } from '../lib/scenarioTypes.ts';
import { BotPendingReplyMessage } from './BotPendingReply.tsx';
import { IconHash } from './discordIcons.tsx';
import { InteractionBody } from './InteractionComponents.tsx';
import { Markdown } from './markdown.tsx';
import { skyraAuthorProps, skyraCommand, defaultBotProps } from './skyraAuthor.ts';

function SkyraMessageItem({
  message,
  highlightedButton,
  loadingButton,
}: {
  message: ChannelMessage;
  highlightedButton?: string | null;
  loadingButton?: string | null;
}) {
  const { author, content, timestamp, deletedReply, slashInvocation, interaction } = message;
  const useTwentyFour = Boolean(timestamp && /^\d{1,2}:\d{2}$/.test(timestamp));

  return (
    <DiscordMessage
      {...skyraAuthorProps(author)}
      timestamp={timestamp ?? null}
      twentyFour={useTwentyFour}
    >
      {deletedReply && <DiscordReply slot="reply" deleted />}
      {slashInvocation && (
        <DiscordCommand
          slot="reply"
          {...skyraAuthorProps(slashInvocation.user)}
          command={skyraCommand(slashInvocation.command)}
        />
      )}
      {content && <Markdown content={content} />}
      {interaction?.type === 4 && interaction.data && (
        <InteractionBody
          data={interaction.data}
          highlightedButton={highlightedButton}
          loadingButton={loadingButton}
        />
      )}
    </DiscordMessage>
  );
}

function SkyraEphemeralMessage({
  ephemeral,
  highlightedButton,
  loadingButton,
}: {
  ephemeral: EphemeralLayer;
  highlightedButton?: string | null;
  loadingButton?: string | null;
}) {
  if (ephemeral.type !== 4 || !ephemeral.data) return null;

  return (
    <DiscordMessage
      {...(ephemeral.author ? skyraAuthorProps(ephemeral.author) : defaultBotProps())}
      ephemeral
    >
      {ephemeral.slashInvocation && (
        <DiscordCommand
          slot="reply"
          {...skyraAuthorProps(ephemeral.slashInvocation.user)}
          command={skyraCommand(ephemeral.slashInvocation.command)}
        />
      )}
      <InteractionBody
        data={ephemeral.data}
        highlightedButton={highlightedButton}
        loadingButton={loadingButton}
        useSkyraMarkdown
      />
    </DiscordMessage>
  );
}

export function ChannelView({
  messages,
  ephemeral,
  pendingBotReply,
  highlightedButton,
  loadingButton,
  guildName,
  showWelcome = true,
}: {
  messages?: ChannelMessage[];
  ephemeral?: EphemeralLayer | null;
  pendingBotReply?: PendingBotReply | null;
  highlightedButton?: string | null;
  loadingButton?: string | null;
  guildName?: string;
  channelName?: string;
  showWelcome?: boolean;
}) {
  const messagesRef = useRef<HTMLDivElement>(null);
  const hasMessages = Boolean(messages?.length);
  const hasEphemeral = Boolean(ephemeral) && !pendingBotReply?.ephemeral;
  const hasPending = Boolean(pendingBotReply);
  const hasContent = hasMessages || hasEphemeral || hasPending;

  useEffect(() => {
    if (!hasContent) return;
    const scrollParent = messagesRef.current?.closest('.channel-content');
    if (!scrollParent) return;
    scrollParent.scrollTop = scrollParent.scrollHeight;
  }, [hasContent, messages, ephemeral, pendingBotReply, loadingButton]);

  if (!hasContent) {
    if (!showWelcome) {
      return <div className="channel-messages" />;
    }
    return (
      <div className="channel-messages channel-messages--empty channel-messages--welcome">
        <div className="welcome-block">
          <div className="welcome-block__icon" aria-hidden>
            <IconHash />
          </div>
          <h2 className="welcome-block__title">Welcome to {guildName ?? 'this server'}</h2>
          <p className="welcome-block__subtitle">This is the beginning of this server.</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={messagesRef} className="channel-messages channel-messages--skyra">
      <DiscordMessages noBackground>
        {messages?.map((msg, i) => (
          <SkyraMessageItem
            key={i}
            message={msg}
            highlightedButton={highlightedButton}
            loadingButton={loadingButton}
          />
        ))}
        {pendingBotReply && <BotPendingReplyMessage pending={pendingBotReply} />}
        {ephemeral && !pendingBotReply?.ephemeral && (
          <SkyraEphemeralMessage
            ephemeral={ephemeral}
            highlightedButton={highlightedButton}
            loadingButton={loadingButton}
          />
        )}
      </DiscordMessages>
    </div>
  );
}
