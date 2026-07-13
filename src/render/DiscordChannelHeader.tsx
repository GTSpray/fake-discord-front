import {
  IconBell,
  IconHash,
  IconPin,
  IconSearch,
  IconThreads,
  IconUsers,
} from './discordIcons.tsx';

export function DiscordChannelHeader({
  channelName,
  guildName,
}: {
  channelName: string;
  guildName: string;
}) {
  return (
    <header className="channel-toolbar">
      <div className="channel-toolbar__title">
        <IconHash className="channel-toolbar__hash" />
        <span className="channel-toolbar__name">{channelName}</span>
      </div>
      <div className="channel-toolbar__actions">
        <button type="button" className="channel-toolbar__btn" disabled aria-label="Threads">
          <IconThreads />
        </button>
        <button type="button" className="channel-toolbar__btn" disabled aria-label="Notifications">
          <IconBell />
        </button>
        <button
          type="button"
          className="channel-toolbar__btn"
          disabled
          aria-label="Pinned Messages"
        >
          <IconPin />
        </button>
        <button type="button" className="channel-toolbar__btn" disabled aria-label="Member List">
          <IconUsers />
        </button>
        <div className="channel-toolbar__search">
          <span className="channel-toolbar__search-text">Search {guildName}</span>
          <IconSearch className="channel-toolbar__search-icon" />
        </div>
      </div>
    </header>
  );
}
