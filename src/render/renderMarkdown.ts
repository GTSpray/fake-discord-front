import { SimpleMarkdown, rules } from 'discord-markdown-parser';
import type { CustomEmoji } from '../lib/types.ts';

type AstNode = {
  type: string;
  content?: string | AstNode | AstNode[];
  level?: number;
  id?: string;
  name?: string;
  animated?: boolean;
  target?: string;
  lang?: string;
  ordered?: boolean;
  start?: number;
  items?: AstNode[][];
  nested?: boolean;
  [key: string]: unknown;
};

type MatchState = {
  prevCapture: RegExpExecArray | null;
  inline?: boolean;
  _list?: boolean;
  _noList?: boolean;
};

type NestedParse = (source: string, state: MatchState) => AstNode[];

/** Doc scenarios often use short fake snowflakes; Discord's regex is 17–21 digits. */
const LENIENT_EMOJI_RE = /^<(a?):([a-zA-Z0-9_]{2,32}):(\d+)>/;
const LENIENT_USER_RE = /^<@!?(\d+)>/;
const LENIENT_ROLE_RE = /^<@&(\d+)>/;
const LENIENT_CHANNEL_RE = /^<#(\d+)>/;

/** Discord lists: `-`/`*`/`1.` markers, optional 2-space nest (one level). */
const LIST_BLOCK_RE = /^(?:(?: {0,2}(?:[*+-]|\d+\.) +[^\n]*(?:\n|$))+)/;

function startsAfterNewline(state: MatchState): boolean {
  if (state.prevCapture === null) return true;
  const full = state.prevCapture[0];
  return typeof full === 'string' && full.endsWith('\n');
}

const discordList = {
  order: SimpleMarkdown.defaultRules.list.order,
  match(source: string, state: MatchState) {
    if (state._noList) return null;
    if (!startsAfterNewline(state) && !state._list) return null;
    // `-#` is subtext, not a list marker
    if (/^-# /.test(source)) return null;
    if (!state._list && !/^(?:[*+-]|\d+\.) /.test(source)) return null;
    return LIST_BLOCK_RE.exec(source);
  },
  parse(capture: string[], parse: NestedParse, state: MatchState) {
    const block = capture[0].replace(/\n$/, '');
    const lines = block.split('\n');
    const firstBullet = lines[0]?.match(/^(?:[*+-]|\d+\.)/)?.[0] ?? '-';
    const ordered = /\d+\./.test(firstBullet);
    const start = ordered ? Number.parseInt(firstBullet, 10) : undefined;

    const items: { text: string; nested: string[] }[] = [];
    let current: { text: string; nested: string[] } | null = null;

    for (const line of lines) {
      const nested = line.match(/^ {2}(?:[*+-]|\d+\.) +(.+)$/);
      const top = line.match(/^(?:[*+-]|\d+\.) +(.+)$/);
      if (nested && current) {
        current.nested.push(nested[1]);
      } else if (top) {
        current = { text: top[1], nested: [] };
        items.push(current);
      }
    }

    const nestedState: MatchState = { ...state, inline: true, _list: true, _noList: false };
    return {
      ordered,
      start,
      items: items.map((item) => {
        const content = parse(item.text, nestedState);
        if (item.nested.length) {
          content.push({
            type: 'list',
            ordered: false,
            nested: true,
            items: item.nested.map((text) => parse(text, nestedState)),
          });
        }
        return content;
      }),
    };
  },
};

const parserRules = {
  ...rules,
  list: discordList,
  emoji: {
    order: rules.emoji.order,
    match: (source: string) => LENIENT_EMOJI_RE.exec(source),
    parse: (capture: string[]) => ({
      animated: capture[1] === 'a',
      name: capture[2],
      id: capture[3],
    }),
  },
  user: {
    order: rules.user.order,
    match: (source: string) => LENIENT_USER_RE.exec(source),
    parse: (capture: string[]) => ({ id: capture[1] }),
  },
  role: {
    order: rules.role.order,
    match: (source: string) => LENIENT_ROLE_RE.exec(source),
    parse: (capture: string[]) => ({ id: capture[1] }),
  },
  channel: {
    order: rules.channel.order,
    match: (source: string) => LENIENT_CHANNEL_RE.exec(source),
    parse: (capture: string[]) => ({ id: capture[1] }),
  },
  // Upstream checks prevCapture.slice(-1)[0] (last group), which breaks after
  // block quotes. Check the full match string instead.
  heading: {
    ...rules.heading,
    match(source: string, state: MatchState) {
      if (!startsAfterNewline(state)) return null;
      return /^(#{1,3}) +([^\n]+?)(\n|$)/.exec(source);
    },
    parse(capture: string[], parse: NestedParse, state: MatchState) {
      return {
        level: capture[1].length,
        content: SimpleMarkdown.parseInline(
          parse as Parameters<typeof SimpleMarkdown.parseInline>[0],
          capture[2].trim(),
          { ...state, _noList: true },
        ),
      };
    },
  },
  subtext: {
    ...rules.subtext,
    match(source: string, state: MatchState) {
      if (!startsAfterNewline(state)) return null;
      return /^-# +([^\n]+?)(\n|$)/.exec(source);
    },
    parse(capture: string[], parse: NestedParse, state: MatchState) {
      return {
        content: SimpleMarkdown.parseInline(
          parse as Parameters<typeof SimpleMarkdown.parseInline>[0],
          capture[1],
          { ...state, _noList: true },
        ),
      };
    },
  },
};

const parseDiscordMarkdown = SimpleMarkdown.parserFor(
  parserRules as unknown as Parameters<typeof SimpleMarkdown.parserFor>[0],
);

/** Discord-flavoured markdown → HTML (via discord-markdown-parser AST). */
export function renderMarkdown(
  text: string,
  emojiById: Map<string, CustomEmoji> = new Map(),
): string {
  const nodes = parseDiscordMarkdown(text, { inline: true }) as AstNode[];
  return nodes.map((node) => renderNode(node, emojiById)).join('');
}

function renderNodes(
  content: string | AstNode | AstNode[] | undefined,
  emojiById: Map<string, CustomEmoji>,
): string {
  if (content == null) return '';
  if (typeof content === 'string') return escapeHtml(content);
  if (Array.isArray(content)) {
    return content.map((node) => renderNode(node, emojiById)).join('');
  }
  return renderNode(content, emojiById);
}

function renderNode(node: AstNode, emojiById: Map<string, CustomEmoji>): string {
  switch (node.type) {
    case 'text':
      return escapeHtml(String(node.content ?? ''));
    case 'br':
    case 'newline':
      return '<br />';
    case 'heading': {
      const level = Math.min(Math.max(Number(node.level) || 1, 1), 3);
      return `<h${level} class="md-h${level}">${renderNodes(node.content, emojiById)}</h${level}>`;
    }
    case 'subtext':
      return `<span class="md-subtext">${renderNodes(node.content, emojiById)}</span>`;
    case 'list': {
      const tag = node.ordered ? 'ol' : 'ul';
      const nestedClass = node.nested ? ' md-list--nested' : '';
      const startAttr =
        node.ordered && node.start != null && node.start !== 1 ? ` start="${node.start}"` : '';
      const items = (node.items ?? [])
        .map((item) => `<li>${renderNodes(item, emojiById)}</li>`)
        .join('');
      return `<${tag} class="md-list${nestedClass}"${startAttr}>${items}</${tag}>`;
    }
    case 'strong':
      return `<strong>${renderNodes(node.content, emojiById)}</strong>`;
    case 'em':
      return `<em>${renderNodes(node.content, emojiById)}</em>`;
    case 'underline':
      return `<u>${renderNodes(node.content, emojiById)}</u>`;
    case 'strikethrough':
      return `<s>${renderNodes(node.content, emojiById)}</s>`;
    case 'inlineCode':
      return `<code class="md-inline-code">${escapeHtml(String(node.content ?? ''))}</code>`;
    case 'codeBlock':
      return `<pre class="md-code-block"><code>${escapeHtml(String(node.content ?? ''))}</code></pre>`;
    case 'spoiler':
      return `<span class="md-spoiler">${renderNodes(node.content, emojiById)}</span>`;
    case 'blockQuote':
      return `<blockquote class="md-quote">${renderNodes(node.content, emojiById)}</blockquote>`;
    case 'emoji': {
      const id = String(node.id ?? '');
      const name = String(node.name ?? 'emoji');
      const emoji = emojiById.get(id);
      return emoji ? customEmojiHtml(emoji) : escapeHtml(`:${name}:`);
    }
    case 'twemoji':
    case 'emoticon':
      return escapeHtml(String(node.content ?? node.name ?? ''));
    case 'user':
      return '<span class="md-user-mention">@user</span>';
    case 'role':
      return '<span class="md-role-mention">@role</span>';
    case 'channel':
      return '<span class="md-channel-mention">#channel</span>';
    case 'everyone':
      return '<span class="md-role-mention">@everyone</span>';
    case 'here':
      return '<span class="md-role-mention">@here</span>';
    case 'timestamp':
      return `<span class="md-timestamp">${escapeHtml(String(node.timestamp ?? node.content ?? ''))}</span>`;
    case 'url':
    case 'link':
    case 'autolink': {
      const href = escapeAttr(String(node.target ?? node.content ?? ''));
      const label = renderNodes(node.content ?? node.target, emojiById);
      return `<a class="md-link" href="${href}" target="_blank" rel="noreferrer">${label}</a>`;
    }
    default:
      return renderNodes(node.content, emojiById);
  }
}

function customEmojiHtml(emoji: CustomEmoji): string {
  const name = escapeAttr(emoji.name);
  const url = escapeAttr(emoji.url);
  return `<img class="md-custom-emoji" src="${url}" alt=":${name}:" title=":${name}:" draggable="false" />`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
