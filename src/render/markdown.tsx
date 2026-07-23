import { CUSTOM_EMOJI_MENTION_RE } from '../lib/emojiResolve.ts';
import type { CustomEmoji } from '../lib/types.ts';
import { useEmojiRegistry } from './EmojiRegistry.tsx';

/** Minimal Discord-flavoured markdown → HTML */
export function renderMarkdown(
  text: string,
  emojiById: Map<string, CustomEmoji> = new Map(),
): string {
  const lines = text.split('\n');
  const html: string[] = [];
  let inList = false;

  for (const line of lines) {
    if (line.match(/^-# /)) {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      html.push(`<span class="md-subtext">${inlineFormat(line.slice(3), emojiById)}</span>`);
    } else if (line.match(/^# /)) {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      html.push(`<h1 class="md-h1">${inlineFormat(line.slice(2), emojiById)}</h1>`);
    } else if (line.match(/^## /)) {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      html.push(`<h2 class="md-h2">${inlineFormat(line.slice(3), emojiById)}</h2>`);
    } else if (line.match(/^ {4}- /)) {
      if (!inList) {
        html.push('<ul class="md-list">');
        inList = true;
      }
      html.push(`<li>${inlineFormat(line.slice(6), emojiById)}</li>`);
    } else if (line.match(/^- /)) {
      if (!inList) {
        html.push('<ul class="md-list">');
        inList = true;
      }
      html.push(`<li>${inlineFormat(line.slice(2), emojiById)}</li>`);
    } else if (line.trim() === '') {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      html.push('<br />');
    } else {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      html.push(`<p>${inlineFormat(line, emojiById)}</p>`);
    }
  }

  if (inList) html.push('</ul>');
  return html.join('');
}

function inlineFormat(text: string, emojiById: Map<string, CustomEmoji>): string {
  let result = '';
  let lastIndex = 0;
  const re = new RegExp(CUSTOM_EMOJI_MENTION_RE.source, 'g');

  for (const match of text.matchAll(re)) {
    const index = match.index ?? 0;
    result += formatInlineText(text.slice(lastIndex, index));
    const name = match[2];
    const id = match[3];
    const emoji = emojiById.get(id);
    result += emoji ? customEmojiHtml(emoji) : escapeHtml(`:${name}:`);
    lastIndex = index + match[0].length;
  }

  result += formatInlineText(text.slice(lastIndex));
  return result;
}

function formatInlineText(text: string): string {
  let s = escapeHtml(text);
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/&lt;@&amp;\d+&gt;/g, '<span class="md-role-mention">@role</span>');
  s = s.replace(/&lt;@!?\d+&gt;/g, '<span class="md-user-mention">@user</span>');
  return s;
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

export function Markdown({ content }: { content: string }) {
  const emojiById = useEmojiRegistry();
  return (
    <div
      className="discord-markdown"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content, emojiById) }}
    />
  );
}
