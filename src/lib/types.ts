/** Types aligned with schema/scenario.schema.json */

import defaultAvatarPng from '../styles/default-avatar.png';

export interface Chrome {
  guild: { name: string; iconUrl?: string };
  channel: { name: string; type?: 'text' };
  membersOnline?: number;
  /** Connected user shown in the bottom-left user panel */
  viewer?: { name: string; status?: string; avatarUrl?: string };
}

export const DEFAULT_VIEWER = {
  name: 'You',
  status: 'Online',
} as const;

export function resolveViewer(chrome: Chrome) {
  return {
    name: chrome.viewer?.name ?? DEFAULT_VIEWER.name,
    status: chrome.viewer?.status ?? DEFAULT_VIEWER.status,
    avatarUrl: chrome.viewer?.avatarUrl,
  };
}

export interface Author {
  name: string;
  color?: string;
  avatarUrl?: string;
  bot?: boolean;
}

export interface SlashInvocation {
  user: Author;
  command: string;
}

export interface ChannelMessage {
  author: Author;
  content?: string;
  timestamp?: string;
  deletedReply?: boolean;
  slashInvocation?: SlashInvocation;
  interaction?: BotInteractionResponse;
}

export interface BotInteractionResponse {
  type: 4 | 9;
  data: InteractionData;
}

export interface InteractionData {
  flags?: number;
  content?: string;
  title?: string;
  components?: DiscordComponent[];
}

export interface ModalLayer {
  type: 9;
  data: InteractionData;
  author?: Author;
  values?: Record<string, string | string[] | null>;
  roleDisplay?: Record<string, string>;
}

export interface SlashTypingAnimation {
  id: number;
  from: string;
  to: string;
  msPerChar: number;
  revealAfter?: string;
}

export interface SlashLayer {
  input: string;
  focused?: boolean;
  suggestions?: { name: string; description?: string }[];
  /** Runtime only — scenario player typing via react-type-animation */
  typingAnimation?: SlashTypingAnimation;
}

export interface EphemeralLayer extends BotInteractionResponse {
  slashInvocation?: SlashInvocation;
  author?: Author;
}

export interface Layers {
  messages?: ChannelMessage[];
  ephemeral?: EphemeralLayer;
  modal?: ModalLayer;
  slash?: SlashLayer;
}

export interface DiscordComponent {
  type: number;
  [key: string]: unknown;
}

export const ComponentType = {
  ActionRow: 1,
  Button: 2,
  StringSelect: 3,
  TextInput: 4,
  RoleSelect: 6,
  Section: 9,
  TextDisplay: 10,
  Thumbnail: 11,
  MediaGallery: 12,
  Separator: 14,
  Label: 18,
} as const;

export const ButtonStyle = {
  Primary: 1,
  Secondary: 2,
} as const;

export const TextInputStyle = {
  Short: 1,
  Paragraph: 2,
} as const;

export const MessageFlags = {
  Ephemeral: 64,
  IsComponentsV2: 32768,
} as const;

export const DEFAULT_BOT_NAME = 'Bot';

export const VIEWER_DEFAULT_AVATAR = defaultAvatarPng;
