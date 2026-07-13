import { DiscordCommand, DiscordMessage } from '@skyra/discord-components-react';
import type { PendingBotReply } from '../lib/scenarioTypes.ts';
import { DEFAULT_BOT_NAME } from '../lib/types.ts';
import { defaultAvatar, skyraAuthorProps, skyraCommand } from './skyraAuthor.ts';
import { InteractionDots } from './InteractionDots.tsx';

export function BotPendingReplyMessage({ pending }: { pending: PendingBotReply }) {
  const authorName = pending.authorName ?? DEFAULT_BOT_NAME;

  return (
    <DiscordMessage
      author={authorName}
      avatar={defaultAvatar(authorName)}
      bot
      timestamp={pending.timestamp}
      twentyFour
      ephemeral={pending.ephemeral || undefined}
    >
      {pending.slashInvocation && (
        <DiscordCommand
          slot="reply"
          {...skyraAuthorProps(pending.slashInvocation.user)}
          command={skyraCommand(pending.slashInvocation.command)}
        />
      )}
      <div className="bot-pending-reply">
        <InteractionDots variant="message" />
        <span className="bot-pending-reply__text">{pending.text}</span>
      </div>
    </DiscordMessage>
  );
}
