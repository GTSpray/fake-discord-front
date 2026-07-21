import { DiscordCommand, DiscordMessage } from '@skyra/discord-components-react';
import type { PendingBotReply } from '../lib/scenarioTypes.ts';
import { DEFAULT_BOT_NAME } from '../lib/types.ts';
import { skyraAuthorProps, skyraCommand } from './skyraAuthor.ts';
import { skyraTimestampProps } from '../lib/skyraTimestamp.ts';
import { InteractionDots } from './InteractionDots.tsx';

export function BotPendingReplyMessage({ pending }: { pending: PendingBotReply }) {
  const authorProps = skyraAuthorProps(pending.author ?? { name: DEFAULT_BOT_NAME, bot: true });

  return (
    <DiscordMessage
      {...authorProps}
      {...skyraTimestampProps(pending.timestamp)}
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
