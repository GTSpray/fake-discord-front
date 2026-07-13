import type { ReactNode } from 'react';
import type { Chrome } from '../lib/types.ts';
import { resolveViewer, VIEWER_DEFAULT_AVATAR } from '../lib/types.ts';
import { DiscordChannelHeader } from './DiscordChannelHeader.tsx';
import { DiscordTitleBar } from './DiscordTitleBar.tsx';
import {
  IconCalendar,
  IconChevronDown,
  IconCompass,
  IconDiscord,
  IconDownload,
  IconHash,
  IconChevronMicro,
  IconHeadphones,
  IconInvite,
  IconMicMuted,
  IconPlus,
  IconSettings,
  IconSpeaker,
  IconUserPlus,
} from './discordIcons.tsx';

interface DiscordShellProps {
  chrome: Chrome;
  children: ReactNode;
  inputBar?: ReactNode;
  hideGuildSidebar?: boolean;
}

function GuildRail({ guild }: { guild: Chrome['guild'] }) {
  return (
    <aside className="guild-rail">
      <button type="button" className="guild-rail__home" disabled aria-label="Direct Messages">
        <IconDiscord className="guild-rail__discord-logo" />
      </button>
      <div className="guild-rail__separator" />
      <div className="guild-rail__server-cell guild-rail__server-cell--active">
        <div className="guild-rail__server" title={guild.name}>
          {guild.iconUrl ? (
            <img src={guild.iconUrl} alt="" />
          ) : (
            <span>{guild.name[0]?.toUpperCase()}</span>
          )}
        </div>
      </div>
      <button type="button" className="guild-rail__action" disabled aria-label="Add a Server">
        <IconPlus />
      </button>
      <button type="button" className="guild-rail__action" disabled aria-label="Discover">
        <IconCompass />
      </button>
      <button
        type="button"
        className="guild-rail__action guild-rail__action--bottom"
        disabled
        aria-label="Downloads"
      >
        <IconDownload />
      </button>
    </aside>
  );
}

function UserPanel({ chrome, showGuildRail }: { chrome: Chrome; showGuildRail: boolean }) {
  const viewer = resolveViewer(chrome);
  const avatar = viewer.avatarUrl ?? VIEWER_DEFAULT_AVATAR;

  return (
    <footer className={`user-panel-wrap${showGuildRail ? '' : ' user-panel-wrap--solo'}`}>
      <div className="user-panel">
        <div className="user-panel__profile">
          <div className="user-panel__avatar-wrap">
            <img className="user-panel__avatar" src={avatar} alt="" width={32} height={32} />
            <span className="user-panel__status-dot" aria-hidden />
          </div>
          <div className="user-panel__meta">
            <span className="user-panel__name">{viewer.name}</span>
            <span className="user-panel__status">{viewer.status}</span>
          </div>
        </div>
        <div className="user-panel__controls">
          <button
            type="button"
            className="user-panel__pill user-panel__pill--muted"
            disabled
            aria-label="Mute"
          >
            <span className="user-panel__pill-icon">
              <IconMicMuted />
            </span>
            <IconChevronMicro className="user-panel__pill-chevron" />
          </button>
          <button type="button" className="user-panel__pill" disabled aria-label="Deafen">
            <span className="user-panel__pill-icon">
              <IconHeadphones />
            </span>
            <IconChevronMicro className="user-panel__pill-chevron" />
          </button>
          <button
            type="button"
            className="user-panel__settings"
            disabled
            aria-label="User Settings"
          >
            <IconSettings />
          </button>
        </div>
      </div>
    </footer>
  );
}

function ChannelSidebar({ chrome }: { chrome: Chrome }) {
  return (
    <aside className="channel-sidebar">
      <header className="guild-header">
        <button type="button" className="guild-header__name-btn" disabled>
          <span className="guild-name">{chrome.guild.name}</span>
          <IconChevronDown className="guild-header__chevron" />
        </button>
        <button
          type="button"
          className="guild-header__icon-btn"
          disabled
          aria-label="Invite People"
        >
          <IconUserPlus />
        </button>
      </header>

      <nav className="channel-list">
        <button type="button" className="channel-list__event" disabled>
          <IconCalendar className="channel-list__event-icon" />
          <span>Events</span>
        </button>

        <div className="channel-category">
          <span>Text Channels</span>
          <IconChevronDown className="channel-category__chevron" />
        </div>
        <div className="channel-item channel-item--active">
          <IconHash className="channel-item__hash-icon" />
          <span className="channel-item__label">{chrome.channel.name}</span>
          <button
            type="button"
            className="channel-item__invite"
            disabled
            aria-label="Invite People"
          >
            <IconInvite />
          </button>
        </div>

        <div className="channel-category">
          <span>Voice Channels</span>
          <IconChevronDown className="channel-category__chevron" />
        </div>
        <div className="channel-item channel-item--voice">
          <IconSpeaker className="channel-item__speaker-icon" />
          <span className="channel-item__label">General</span>
        </div>
      </nav>
    </aside>
  );
}

export function DiscordShell({ chrome, children, inputBar, hideGuildSidebar }: DiscordShellProps) {
  return (
    <div className="discord-app theme-dark" data-capture-root>
      <DiscordTitleBar guild={chrome.guild} />
      <div className="discord-shell">
        <div className={`sidebar-column${hideGuildSidebar ? ' sidebar-column--solo' : ''}`}>
          {!hideGuildSidebar && <GuildRail guild={chrome.guild} />}
          <ChannelSidebar chrome={chrome} />
          <UserPanel chrome={chrome} showGuildRail={!hideGuildSidebar} />
        </div>
        <main className="main-panel">
          <DiscordChannelHeader channelName={chrome.channel.name} guildName={chrome.guild.name} />
          {children}
          {inputBar}
        </main>
      </div>
    </div>
  );
}
