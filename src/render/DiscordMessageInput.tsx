import type { ReactNode } from 'react';
import { IconApps, IconAttach, IconEmoji, IconGift } from './discordIcons.tsx';

export function DiscordMessageInput({
  channelName,
  children,
  variant = 'idle',
  flush = false,
  botAvatarUrl,
}: {
  channelName: string;
  children?: ReactNode;
  variant?: 'idle' | 'focused';
  /** Retire le padding horizontal (géré par le parent, ex. SlashBar) */
  flush?: boolean;
  /** Remplace le bouton « + » par l’avatar du bot (commande slash sélectionnée) */
  botAvatarUrl?: string;
}) {
  return (
    <div
      className={`discord-composer${variant === 'idle' ? ' discord-composer--idle' : ''}${
        flush ? ' discord-composer--flush' : ''
      }`}
    >
      <div className={`message-input-bar message-input-bar--${variant}`}>
        {botAvatarUrl ? (
          <img
            className="input-addon input-addon--bot-avatar"
            src={botAvatarUrl}
            alt=""
            width={24}
            height={24}
          />
        ) : (
          <button type="button" className="input-addon" disabled aria-label="Upload a File">
            <IconAttach />
          </button>
        )}
        <div className="message-input-wrapper">
          {children ?? <span className="message-input-placeholder">Message #{channelName}</span>}
        </div>
        <div className="message-input-trailing">
          <button type="button" className="message-input-icon-btn" disabled aria-label="Send Gift">
            <IconGift />
          </button>
          <button
            type="button"
            className="message-input-icon-btn"
            disabled
            aria-label="Select Emoji"
          >
            <IconEmoji />
          </button>
          <button type="button" className="message-input-icon-btn" disabled aria-label="Apps">
            <IconApps />
          </button>
        </div>
      </div>
    </div>
  );
}
