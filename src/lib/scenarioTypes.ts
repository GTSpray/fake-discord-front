import type {
  Author,
  ChannelMessage,
  Chrome,
  EphemeralLayer,
  ModalLayer,
  SlashCommandParam,
  SlashInvocation,
} from './types.ts';

export const UPLOAD_SCENARIO_STORAGE_KEY = 'doc-studio-scenario-upload';

export type { SlashSuggestion } from './types.ts';

export type SlashSuggestionMode = 'subcommand' | 'commandMatch';

export type ScenarioAction =
  | { type: 'wait'; ms: number }
  | { type: 'focusInput' }
  | {
      type: 'type';
      text: string;
      msPerChar?: number;
      /** Pause avant de commencer à taper (défaut : 1250 ms si le champ n'est pas vide) */
      delayBeforeMs?: number;
      revealSuggestions?: {
        /** Optionnel en commandMatch (auto dès /) ; requis en subcommand */
        after?: string;
        suggestions: import('./types.ts').SlashSuggestion[];
        /** subcommand (défaut) ou commandMatch (liste « COMMANDS MATCHING … ») */
        mode?: SlashSuggestionMode;
        /** Suggestion surlignée (défaut : 0) */
        activeIndex?: number;
      };
    }
  | {
      type: 'setSlashParams';
      params: SlashCommandParam[];
      /** Index du paramètre actif (défaut : 0) */
      activeParamIndex?: number;
    }
  | {
      type: 'typeSlashParam';
      /** Nom du paramètre à remplir */
      param: string;
      text: string;
      msPerChar?: number;
      /** Pause avant de taper (défaut : 1250 ms si une valeur existe déjà) */
      delayBeforeMs?: number;
    }
  | {
      type: 'pressEnter';
      userMessage?: ChannelMessage;
    }
  | {
      type: 'openModal';
      modal: ModalLayer;
      /** Délai avant l’ouverture de la modale (défaut scénario / 1200 ms). 0 = aucun. */
      responseDelayMs?: number;
    }
  | {
      type: 'fillModal';
      values: Record<string, string | string[] | null>;
      roleDisplay?: Record<string, string>;
      msPerField?: number;
      /** Pause avant chaque champ de la modale (défaut : 900 ms) */
      delayBeforeFieldMs?: number;
    }
  | { type: 'submitModal' }
  | {
      type: 'showEphemeral';
      ephemeral: EphemeralLayer;
      responseDelayMs?: number;
    }
  | { type: 'clickButton'; label: string }
  | {
      type: 'applyState';
      chrome?: Chrome;
      layers?: {
        messages?: ChannelMessage[];
        ephemeral?: EphemeralLayer;
        modal?: ModalLayer;
        slash?: import('./types.ts').SlashLayer;
      };
      holdMs?: number;
      responseDelayMs?: number;
    };

export interface ScenarioDefaults {
  /** Pause avant modale / éphémère / message bot (défaut 1200 ms) */
  botResponseMs?: number;
  /** Texte affiché pendant l’attente (défaut : « Envoi de la commande... ») */
  botPendingText?: string;
  /** Délai entre chaque caractère pour type et typeSlashParam (défaut 185 ms) */
  msPerChar?: number;
}

/** Message bot « en cours » affiché pendant le délai de réponse (interaction différée). */
export interface PendingBotReply {
  slashInvocation?: SlashInvocation;
  text: string;
  timestamp: string;
  ephemeral?: boolean;
  author?: Author;
}

export interface Scenario {
  id: string;
  title: string;
  doc?: string;
  chrome: Chrome;
  defaults?: ScenarioDefaults;
  actions: ScenarioAction[];
  output?: {
    directory?: string;
    prefix?: string;
    video?: boolean;
  };
}

export type ScenarioStatus = 'idle' | 'playing' | 'paused' | 'done';

export interface PlaybackState {
  chrome: Chrome;
  messages: ChannelMessage[];
  slash: import('./types.ts').SlashLayer | null;
  modal: ModalLayer | null;
  modalClosing: boolean;
  ephemeral: EphemeralLayer | null;
  highlightedButton: string | null;
  /** Bouton en attente de réponse bot (spinner) */
  loadingButton: string | null;
  /** Runtime — bouton ciblé par le curseur animé */
  cursorTarget: string | null;
  /** Message bot différé pendant l’attente de réponse */
  pendingBotReply: PendingBotReply | null;
}

export interface ScenarioPlayerSnapshot {
  status: ScenarioStatus;
  actionIndex: number;
  totalActions: number;
  state: PlaybackState;
}
