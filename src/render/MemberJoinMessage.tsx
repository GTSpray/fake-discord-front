import {
  DiscordReaction,
  DiscordReactions,
  DiscordSystemMessage,
} from '@skyra/discord-components-react';
import type { ReactNode } from 'react';
import { resolveMessageReactions } from '../lib/emojiResolve.ts';
import { DEFAULT_WAVE_STICKER } from '../lib/stickerResolve.ts';
import {
  DEFAULT_MEMBER_JOIN_WAVE_LABEL,
  defaultMemberJoinContent,
  type ChannelMessage,
} from '../lib/types.ts';
import { formatSkyraClockTime } from '../lib/skyraTimestamp.ts';
import { StickerMedia } from './StickerMedia.tsx';
import { useEmojiRegistry } from './useEmojiRegistry.ts';

/** Highlight every occurrence of the member name the way Discord styles join mentions. */
export function highlightMemberName(content: string, memberName: string): ReactNode[] {
  if (!memberName) return [content];
  const parts = content.split(memberName);
  if (parts.length === 1) return [content];
  const nodes: ReactNode[] = [];
  parts.forEach((part, index) => {
    if (part) nodes.push(part);
    if (index < parts.length - 1) {
      nodes.push(<i key={`member-${index}`}>{memberName}</i>);
    }
  });
  return nodes;
}

export function MemberJoinMessage({
  message,
  highlightedButton,
}: {
  message: ChannelMessage;
  highlightedButton?: string | null;
}) {
  const memberName = message.author.name;
  const content = message.content?.trim() || defaultMemberJoinContent(memberName);
  const timestamp = message.timestamp ?? formatSkyraClockTime();
  const showWave = message.system?.wave !== false;
  const waveLabel = message.system?.waveLabel?.trim() || DEFAULT_MEMBER_JOIN_WAVE_LABEL;
  const isHighlighted = highlightedButton != null && highlightedButton === waveLabel;
  const emojiById = useEmojiRegistry();
  const resolvedReactions = resolveMessageReactions(message.reactions, emojiById);

  return (
    <div className="member-join">
      <DiscordSystemMessage type="join" timestamp={timestamp}>
        {highlightMemberName(content, memberName)}
      </DiscordSystemMessage>
      {showWave && (
        <button
          type="button"
          className={['member-join-wave', isHighlighted ? 'member-join-wave--highlighted' : undefined]
            .filter(Boolean)
            .join(' ')}
          data-scenario-button-label={waveLabel}
          disabled
          tabIndex={-1}
        >
          <StickerMedia
            className="member-join-wave__icon"
            url={message.system?.waveSticker?.trim() || DEFAULT_WAVE_STICKER}
            size={28}
            loop
          />
          <span className="member-join-wave__label">{waveLabel}</span>
        </button>
      )}
      {resolvedReactions.length > 0 && (
        <div className="member-join-reactions">
          <DiscordReactions>
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
        </div>
      )}
    </div>
  );
}
