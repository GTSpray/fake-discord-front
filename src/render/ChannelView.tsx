import {
  DiscordCommand,
  DiscordMessage,
  DiscordMessages,
  DiscordReaction,
  DiscordReactions,
  DiscordReply,
} from '@skyra/discord-components-react';
import { useEffect, useRef } from 'react';
import { resolveMessageReactions } from '../lib/emojiResolve.ts';
import type { ChannelMessage, EphemeralLayer, MessageReply } from '../lib/types.ts';
import type { PendingBotReply } from '../lib/scenarioTypes.ts';
import { BotPendingReplyMessage } from './BotPendingReply.tsx';
import { IconHash, IconThreads } from './discordIcons.tsx';
import { InteractionBody } from './InteractionComponents.tsx';
import { Markdown } from './markdown.tsx';
import { MemberJoinMessage } from './MemberJoinMessage.tsx';
import { SkyraMarkdown } from './skyraMarkdown.tsx';
import { StickerMedia } from './StickerMedia.tsx';
import { skyraAuthorProps, skyraCommand, defaultBotProps } from './skyraAuthor.ts';
import { skyraTimestampProps } from '../lib/skyraTimestamp.ts';
import { useEmojiRegistry } from './useEmojiRegistry.ts';

const SYSTEM_REPLY_STYLE = `
  .discord-replied-message-username,
  .discord-application-tag,
  .discord-clan-tag {
    display: none !important;
  }
`;

/** Reply bar: normal (avatar + name) or system (badge arrow + content only). */
function MessageReplyBar({ reply }: { reply: MessageReply }) {
  const hostRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!reply.system) return;
    const host = hostRef.current;
    const shadow = host?.shadowRoot;
    if (!shadow || shadow.querySelector('[data-system-reply-overrides]')) return;
    const style = document.createElement('style');
    style.setAttribute('data-system-reply-overrides', '');
    style.textContent = SYSTEM_REPLY_STYLE;
    shadow.appendChild(style);
  }, [reply.system, reply.content]);

  if (reply.system) {
    return (
      <DiscordReply
        // lit-react host element — needed to inject shadow CSS (hide username)
        ref={hostRef as never}
        slot="reply"
        compactMode
        author=""
        className="discord-reply--system"
      >
        {reply.content}
      </DiscordReply>
    );
  }

  return (
    <DiscordReply slot="reply" {...skyraAuthorProps(reply.author ?? { name: 'User' })}>
      {reply.content}
    </DiscordReply>
  );
}

function SkyraMessageItem({
  message,
  highlightedButton,
  loadingButton,
  openMessageSelect,
  loadingMessageSelect,
  messageSelectValues,
}: {
  message: ChannelMessage;
  highlightedButton?: string | null;
  loadingButton?: string | null;
  openMessageSelect?: string | null;
  loadingMessageSelect?: string | null;
  messageSelectValues?: Record<string, string>;
}) {
  const {
    author,
    content,
    timestamp,
    deletedReply,
    reply,
    stickers,
    slashInvocation,
    interaction,
    ephemeral,
    reactions,
  } = message;
  const Content = ephemeral ? SkyraMarkdown : Markdown;
  const emojiById = useEmojiRegistry();
  const resolvedReactions = resolveMessageReactions(reactions, emojiById);

  return (
    <DiscordMessage
      {...skyraAuthorProps(author)}
      {...skyraTimestampProps(timestamp)}
      ephemeral={ephemeral || undefined}
    >
      {deletedReply ? (
        <DiscordReply slot="reply" deleted />
      ) : (
        reply && <MessageReplyBar reply={reply} />
      )}
      {slashInvocation && (
        <DiscordCommand
          slot="reply"
          {...skyraAuthorProps(slashInvocation.user)}
          command={skyraCommand(slashInvocation.command)}
        />
      )}
      {content && <Content content={content} />}
      {stickers && stickers.length > 0 && (
        <div className="message-stickers">
          {stickers.map((sticker) => (
            <StickerMedia
              key={`${sticker.name ?? ''}:${sticker.url}`}
              className="message-sticker"
              url={sticker.url}
              name={sticker.name}
              size={160}
              loop={sticker.loop !== false}
            />
          ))}
        </div>
      )}
      {interaction?.type === 4 && interaction.data && (
        <InteractionBody
          data={interaction.data}
          highlightedButton={highlightedButton}
          loadingButton={loadingButton}
          openMessageSelect={openMessageSelect}
          loadingMessageSelect={loadingMessageSelect}
          messageSelectValues={messageSelectValues}
          useSkyraMarkdown={Boolean(ephemeral)}
        />
      )}
      {resolvedReactions.length > 0 && (
        <DiscordReactions slot="reactions">
          {resolvedReactions.map((reaction) => (
            <DiscordReaction
              key={`${reaction.name}:${reaction.url}`}
              emoji={reaction.url}
              name={reaction.name}
              count={reaction.count}
              reacted={reaction.reacted || undefined}
            />
          ))}
        </DiscordReactions>
      )}
    </DiscordMessage>
  );
}

function SkyraEphemeralMessage({
  ephemeral,
  highlightedButton,
  loadingButton,
  openMessageSelect,
  loadingMessageSelect,
  messageSelectValues,
}: {
  ephemeral: EphemeralLayer;
  highlightedButton?: string | null;
  loadingButton?: string | null;
  openMessageSelect?: string | null;
  loadingMessageSelect?: string | null;
  messageSelectValues?: Record<string, string>;
}) {
  if (ephemeral.type !== 4 || !ephemeral.data) return null;

  return (
    <DiscordMessage
      {...(ephemeral.author ? skyraAuthorProps(ephemeral.author) : defaultBotProps())}
      {...skyraTimestampProps()}
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
        openMessageSelect={openMessageSelect}
        loadingMessageSelect={loadingMessageSelect}
        messageSelectValues={messageSelectValues}
        useSkyraMarkdown
      />
    </DiscordMessage>
  );
}

function ThreadIntro({ name, startedBy }: { name: string; startedBy?: string }) {
  return (
    <div className="thread-intro">
      <div className="thread-intro__icon" aria-hidden>
        <IconThreads />
      </div>
      <h2 className="thread-intro__title">{name}</h2>
      {startedBy && (
        <p className="thread-intro__started">
          Started by <strong>{startedBy}</strong>
        </p>
      )}
      <hr className="thread-intro__divider" />
    </div>
  );
}

export function ChannelView({
  messages,
  ephemeral,
  pendingBotReply,
  highlightedButton,
  loadingButton,
  openMessageSelect,
  loadingMessageSelect,
  messageSelectValues,
  guildName,
  showWelcome = true,
  threadIntro,
}: {
  messages?: ChannelMessage[];
  ephemeral?: EphemeralLayer | null;
  pendingBotReply?: PendingBotReply | null;
  highlightedButton?: string | null;
  loadingButton?: string | null;
  openMessageSelect?: string | null;
  loadingMessageSelect?: string | null;
  messageSelectValues?: Record<string, string>;
  guildName?: string;
  channelName?: string;
  showWelcome?: boolean;
  threadIntro?: { name: string; startedBy?: string } | null;
}) {
  const messagesRef = useRef<HTMLDivElement>(null);
  const hasMessages = Boolean(messages?.length);
  const hasEphemeral = Boolean(ephemeral) && !pendingBotReply?.ephemeral;
  const hasPending = Boolean(pendingBotReply);
  const hasContent = hasMessages || hasEphemeral || hasPending;
  const showThreadIntro = Boolean(threadIntro);
  // clickButton targets the last matching wave CTA — only highlight that one.
  let lastWaveJoinIndex = -1;
  if (messages) {
    for (let j = messages.length - 1; j >= 0; j--) {
      if (messages[j].system?.type === 'join' && messages[j].system?.wave !== false) {
        lastWaveJoinIndex = j;
        break;
      }
    }
  }

  useEffect(() => {
    if (!hasContent) return;
    const scrollParent = messagesRef.current?.closest('.channel-content');
    if (!scrollParent) return;
    scrollParent.scrollTop = scrollParent.scrollHeight;
  }, [hasContent, messages, ephemeral, pendingBotReply, loadingButton]);

  if (!hasContent && !showThreadIntro) {
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
      {threadIntro && <ThreadIntro name={threadIntro.name} startedBy={threadIntro.startedBy} />}
      {(hasMessages || hasEphemeral || hasPending) && (
        <DiscordMessages noBackground>
          {messages?.map((msg, i) =>
            msg.system?.type === 'join' ? (
              <MemberJoinMessage
                key={i}
                message={msg}
                highlightedButton={i === lastWaveJoinIndex ? highlightedButton : null}
              />
            ) : (
              <SkyraMessageItem
                key={i}
                message={msg}
                highlightedButton={highlightedButton}
                loadingButton={loadingButton}
                openMessageSelect={openMessageSelect}
                loadingMessageSelect={loadingMessageSelect}
                messageSelectValues={messageSelectValues}
              />
            ),
          )}
          {pendingBotReply && <BotPendingReplyMessage pending={pendingBotReply} />}
          {ephemeral && !pendingBotReply?.ephemeral && (
            <SkyraEphemeralMessage
              ephemeral={ephemeral}
              highlightedButton={highlightedButton}
              loadingButton={loadingButton}
              openMessageSelect={openMessageSelect}
              loadingMessageSelect={loadingMessageSelect}
              messageSelectValues={messageSelectValues}
            />
          )}
        </DiscordMessages>
      )}
    </div>
  );
}
