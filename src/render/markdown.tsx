import { useEmojiRegistry } from './useEmojiRegistry.ts';
import { renderMarkdown } from './renderMarkdown.ts';

export function Markdown({ content }: { content: string }) {
  const emojiById = useEmojiRegistry();
  return (
    <div
      className="discord-markdown"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content, emojiById) }}
    />
  );
}
