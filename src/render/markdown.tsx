import { useEmojiRegistry } from './useEmojiRegistry.ts';
import { useUserRegistry } from './useUserRegistry.ts';
import { renderMarkdown } from './renderMarkdown.ts';

export function Markdown({ content }: { content: string }) {
  const emojiById = useEmojiRegistry();
  const userById = useUserRegistry();
  return (
    <div
      className="discord-markdown"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content, emojiById, userById) }}
    />
  );
}
