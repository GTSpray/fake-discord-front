import type { Chrome } from '../lib/types.ts';
import { IconHelp, IconInbox } from './discordIcons.tsx';

export function DiscordTitleBar({ guild }: { guild: Chrome['guild'] }) {
  return (
    <header className="discord-title-bar">
      <div className="discord-title-bar__center">
        <span className="discord-title-bar__guild-icon" aria-hidden>
          {guild.iconUrl ? (
            <img src={guild.iconUrl} alt="" />
          ) : (
            <span>{guild.name[0]?.toUpperCase()}</span>
          )}
        </span>
        <span className="discord-title-bar__guild-name">{guild.name}</span>
      </div>
      <div className="discord-title-bar__actions">
        <button type="button" className="discord-title-bar__btn" disabled aria-label="Inbox">
          <IconInbox />
        </button>
        <button type="button" className="discord-title-bar__btn" disabled aria-label="Help">
          <IconHelp />
        </button>
      </div>
    </header>
  );
}
