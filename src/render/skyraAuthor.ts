import type { Author } from '../lib/types.ts';
import { DEFAULT_BOT_NAME } from '../lib/types.ts';

export function defaultAvatar(name: string): string {
  const hue = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const label = name[0]?.toUpperCase() ?? '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect fill="hsl(${hue},50%,45%)" width="40" height="40"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="16" font-family="sans-serif">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function defaultBotProps() {
  return {
    author: DEFAULT_BOT_NAME,
    avatar: defaultAvatar(DEFAULT_BOT_NAME),
    bot: true as const,
  };
}

export function skyraAuthorProps(author: Author) {
  return {
    author: author.name,
    avatar: author.avatarUrl ?? defaultAvatar(author.name),
    ...(author.bot ? { bot: true as const } : {}),
    ...(author.color ? { roleColor: author.color } : {}),
  };
}

export function skyraCommand(command: string): string {
  return command.startsWith('/') ? command : `/${command}`;
}
