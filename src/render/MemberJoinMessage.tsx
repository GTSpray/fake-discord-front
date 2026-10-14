import { DiscordSystemMessage } from '@skyra/discord-components-react';
import type { ReactNode } from 'react';
import {
  DEFAULT_MEMBER_JOIN_WAVE_LABEL,
  defaultMemberJoinContent,
  type ChannelMessage,
} from '../lib/types.ts';
import { formatSkyraClockTime } from '../lib/skyraTimestamp.ts';
import waveWumpusUrl from '../styles/wumpus-hi-animation.svg';

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

export function MemberJoinMessage({ message }: { message: ChannelMessage }) {
  const memberName = message.author.name;
  const content = message.content?.trim() || defaultMemberJoinContent(memberName);
  const timestamp = message.timestamp ?? formatSkyraClockTime();
  const showWave = message.system?.wave !== false;
  const waveLabel = message.system?.waveLabel?.trim() || DEFAULT_MEMBER_JOIN_WAVE_LABEL;

  return (
    <div className="member-join">
      <DiscordSystemMessage type="join" timestamp={timestamp}>
        {highlightMemberName(content, memberName)}
      </DiscordSystemMessage>
      {showWave && (
        <button type="button" className="member-join-wave" disabled tabIndex={-1}>
          <img className="member-join-wave__icon" src={waveWumpusUrl} alt="" width={24} height={24} />
          <span className="member-join-wave__label">{waveLabel}</span>
        </button>
      )}
    </div>
  );
}
