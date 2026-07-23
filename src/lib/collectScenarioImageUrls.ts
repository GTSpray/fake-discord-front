import {
  resolveApplyState,
  resolveEphemeral,
  resolveModal,
  resolveScenarioChrome,
  resolveUserMessage,
} from './scenarioResolve.ts';
import type { Scenario } from './scenarioTypes.ts';
import type {
  Author,
  ChannelMessage,
  DiscordComponent,
  EphemeralLayer,
  InteractionData,
  ModalLayer,
} from './types.ts';
import { ComponentType, VIEWER_DEFAULT_AVATAR } from './types.ts';

const HTTP_URL = /^https?:\/\//;

function add(urls: Set<string>, url: string | undefined | null) {
  if (url && HTTP_URL.test(url)) urls.add(url);
}

function collectAuthor(urls: Set<string>, author?: Author) {
  if (!author) return;
  add(urls, author.avatarUrl);
}

function collectChrome(urls: Set<string>, chrome: import('./types.ts').Chrome) {
  add(urls, chrome.guild.iconUrl);
  add(urls, chrome.viewer?.avatarUrl);
  if (!chrome.viewer?.avatarUrl) add(urls, VIEWER_DEFAULT_AVATAR);
}

function collectComponents(urls: Set<string>, components?: DiscordComponent[]) {
  if (!components) return;
  for (const comp of components) {
    switch (comp.type) {
      case ComponentType.Thumbnail: {
        const media = comp.media as { url?: string } | undefined;
        add(urls, media?.url);
        break;
      }
      case ComponentType.MediaGallery: {
        const items = comp.items as { media?: { url?: string } }[] | undefined;
        for (const item of items ?? []) add(urls, item.media?.url);
        break;
      }
      case ComponentType.Section: {
        collectComponents(urls, comp.components as DiscordComponent[] | undefined);
        const accessory = comp.accessory as DiscordComponent | undefined;
        if (accessory) collectComponents(urls, [accessory]);
        break;
      }
      case ComponentType.ActionRow: {
        collectComponents(urls, comp.components as DiscordComponent[] | undefined);
        break;
      }
      default:
        break;
    }
  }
}

function collectInteractionData(urls: Set<string>, data?: InteractionData) {
  if (!data) return;
  collectComponents(urls, data.components);
}

function collectMessage(urls: Set<string>, message?: ChannelMessage) {
  if (!message) return;
  collectAuthor(urls, message.author);
  collectAuthor(urls, message.slashInvocation?.user);
  collectInteractionData(urls, message.interaction?.data);
}

function collectEphemeral(urls: Set<string>, ephemeral?: EphemeralLayer | null) {
  if (!ephemeral) return;
  collectAuthor(urls, ephemeral.slashInvocation?.user);
  collectInteractionData(urls, ephemeral.data);
}

function collectModal(urls: Set<string>, modal?: ModalLayer | null) {
  if (!modal) return;
  collectAuthor(urls, modal.author);
  collectInteractionData(urls, modal.data);
}

/** Collecte toutes les URLs d’images HTTP(S) utilisées pendant un scénario. */
export function collectScenarioImageUrls(scenario: Scenario): string[] {
  const urls = new Set<string>();

  collectChrome(urls, resolveScenarioChrome(scenario));
  for (const emoji of scenario.emojis ?? []) add(urls, emoji.url);

  for (const action of scenario.actions) {
    switch (action.type) {
      case 'pressEnter': {
        if (action.userMessage) {
          collectMessage(urls, resolveUserMessage(action.userMessage));
        }
        break;
      }
      case 'openModal':
        collectModal(urls, resolveModal(action));
        break;
      case 'showEphemeral':
        collectEphemeral(urls, resolveEphemeral(action));
        break;
      case 'applyState': {
        const applied = resolveApplyState(action);
        if (applied.chrome) collectChrome(urls, applied.chrome);
        for (const msg of applied.messages) collectMessage(urls, msg);
        collectEphemeral(urls, applied.ephemeral);
        collectModal(urls, applied.modal);
        break;
      }
      default:
        break;
    }
  }

  return [...urls];
}
