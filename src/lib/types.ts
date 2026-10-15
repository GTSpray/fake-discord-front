/** Types aligned with schema/scenario.schema.json */

import defaultAvatarPng from '../styles/default-avatar.png';

export interface Chrome {
  guild: { name: string; iconUrl?: string };
  channel: { name: string; type?: 'text' };
  /**
   * When set, the thread is always listed under the parent channel.
   * `active` defaults to true (viewing the thread). Set `active: false` to keep
   * it in the sidebar while showing the parent channel view.
   */
  thread?: { name: string; active?: boolean; startedBy?: string };
  membersOnline?: number;
  /** Connected user shown in the bottom-left user panel */
  viewer?: { name: string; status?: string; avatarUrl?: string };
}

/** True when chrome.thread is present and not explicitly inactive. */
export function isThreadActive(chrome: Chrome): boolean {
  return chrome.thread != null && chrome.thread.active !== false;
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

/** Custom Discord emoji resolved by id for <:name:id> / <a:name:id> mentions */
export interface CustomEmoji {
  id: string;
  name: string;
  url: string;
  animated?: boolean;
}

export interface SlashInvocation {
  user: Author;
  command: string;
}

/** Reaction shown under a channel message (unicode or custom mention) */
export interface MessageReaction {
  /** Unicode (👍) or custom Discord mention <:name:id> / <a:name:id> */
  emoji: string;
  /** Number of reactors (default 1) */
  count?: number;
  /** Highlighted as reacted by the viewer */
  reacted?: boolean;
}

/** Discord system message overlay on a channel message (member join, …) */
export interface SystemMessage {
  type: 'join';
  /** Show the wave CTA under the join message (default true) */
  wave?: boolean;
  /** Wave button label (default: « Fais coucou ! ») */
  waveLabel?: string;
  /**
   * Sticker on the wave button.
   * Bundled ids: `wumpus_hello`, `nelly_greetings`, `clyde_greetings`, `sup_dogo`
   * (default: `wumpus_hello`).
   */
  waveSticker?: string;
}

export const DEFAULT_MEMBER_JOIN_WAVE_LABEL = 'Fais coucou !';

export function defaultMemberJoinContent(memberName: string): string {
  return `Bienvenue, ${memberName}. Dis bonjour !`;
}

/** Referenced message shown above a channel message (Discord reply bar) */
export interface MessageReply {
  /** Author of the referenced message (omitted / ignored when `system` is true) */
  author?: Author;
  content: string;
  /**
   * Reply to a Discord system message (member join, …).
   * Renders the reply badge arrow + content only — no avatar or username.
   */
  system?: boolean;
}

/** Sticker shown in a channel message (Lottie JSON, HTTP URL, or bundled id) */
export interface MessageSticker {
  /**
   * Bundled sticker id (`wumpus_hello`, `nelly_greetings`, `clyde_greetings`,
   * `sup_dogo`), HTTP(S) Lottie JSON URL, or image URL.
   */
  url: string;
  /** Accessible name / alt text (defaults to bundled sticker name when known) */
  name?: string;
  /** Loop the Lottie animation (default true) */
  loop?: boolean;
}

export interface ChannelMessage {
  author: Author;
  content?: string;
  timestamp?: string;
  deletedReply?: boolean;
  /** Reply bar referencing another message (ignored when deletedReply is true) */
  reply?: MessageReply;
  /** Stickers shown as large media in the message body */
  stickers?: MessageSticker[];
  /** Render with Discord ephemeral styling (Only you can see this) */
  ephemeral?: boolean;
  slashInvocation?: SlashInvocation;
  interaction?: BotInteractionResponse;
  reactions?: MessageReaction[];
  /** Discord system message (e.g. member join welcome) */
  system?: SystemMessage;
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

export interface ModalSelectOption {
  label: string;
  /** Compteur membres (RoleSelect). Défaut : 1 */
  memberCount?: number;
  /** Description sous le label (StringSelect) */
  description?: string;
  /** Icône canal (ChannelSelect). Défaut : text (#) */
  channelType?: 'text' | 'voice' | 'announcement' | 'forum' | 'category';
}

export type ModalSelectKind = 'role' | 'channel' | 'string';

export interface ModalLayer {
  type: 9;
  data: InteractionData;
  author?: Author;
  values?: Record<string, string | string[] | null>;
  roleDisplay?: Record<string, string>;
  /** Runtime — champ actuellement focusé pendant fillModal */
  focusedField?: string | null;
  /** Runtime — custom_id du select ouvert (liste d’options visible) */
  openSelectField?: string | null;
  /** Runtime — options affichées dans le select ouvert */
  selectOptions?: ModalSelectOption[];
}

export interface SlashSuggestion {
  name: string;
  description?: string;
  botName?: string;
  botAvatarUrl?: string;
}

export interface SlashCommandParam {
  name: string;
  description?: string;
  value?: string;
}

export interface SlashTypingAnimation {
  id: number;
  from: string;
  to: string;
  msPerChar: number;
  revealAfter?: string;
}

export interface SlashParamTypingAnimation {
  id: number;
  paramIndex: number;
  from: string;
  to: string;
  msPerChar: number;
}

export interface SlashLayer {
  input: string;
  focused?: boolean;
  suggestions?: SlashSuggestion[];
  /** subcommand = suite de commande (/poll create) ; commandMatch = liste filtrée (/ali → /alias set) */
  suggestionMode?: 'subcommand' | 'commandMatch';
  activeSuggestionIndex?: number;
  params?: SlashCommandParam[];
  /** Index du paramètre actif (focus + tooltip). */
  activeParamIndex?: number;
  /** Runtime only — scenario player typing via react-type-animation */
  typingAnimation?: SlashTypingAnimation;
  /** Runtime only — frappe dans la valeur d'un paramètre */
  paramTypingAnimation?: SlashParamTypingAnimation;
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
  UserSelect: 5,
  RoleSelect: 6,
  MentionableSelect: 7,
  ChannelSelect: 8,
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
