import {
  DiscordHeader,
  DiscordListItem,
  DiscordOrderedList,
  DiscordUnorderedList,
} from '@skyra/discord-components-react';
import type { CustomEmoji, MentionableUser } from '../lib/types.ts';
import { parseBlocks } from './parseSkyraBlocks.ts';
import { renderMarkdown } from './renderMarkdown.ts';
import { useEmojiRegistry } from './useEmojiRegistry.ts';
import { useUserRegistry } from './useUserRegistry.ts';

function InlineMarkdown({
  content,
  emojiById,
  userById,
}: {
  content: string;
  emojiById: Map<string, CustomEmoji>;
  userById: Map<string, MentionableUser>;
}) {
  return (
    <span
      className="discord-markdown"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content, emojiById, userById) }}
    />
  );
}

export function SkyraMarkdown({ content }: { content: string }) {
  const blocks = parseBlocks(content);
  const emojiById = useEmojiRegistry();
  const userById = useUserRegistry();

  return (
    <>
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'header':
            return (
              <DiscordHeader key={i} level={block.level}>
                <InlineMarkdown content={block.text} emojiById={emojiById} userById={userById} />
              </DiscordHeader>
            );
          case 'paragraph':
            return (
              <p key={i}>
                <InlineMarkdown content={block.text} emojiById={emojiById} userById={userById} />
              </p>
            );
          case 'unordered':
            return (
              <DiscordUnorderedList key={i}>
                {block.items.map((item, j) => (
                  <DiscordListItem key={j}>
                    <InlineMarkdown content={item} emojiById={emojiById} userById={userById} />
                  </DiscordListItem>
                ))}
              </DiscordUnorderedList>
            );
          case 'ordered':
            return (
              <DiscordOrderedList key={i} start={block.start}>
                {block.items.map((item, j) => (
                  <DiscordListItem key={j}>
                    <InlineMarkdown content={item.text} emojiById={emojiById} userById={userById} />
                    {item.children && (
                      <DiscordUnorderedList>
                        {item.children.map((child, k) => (
                          <DiscordListItem key={k}>
                            <InlineMarkdown
                              content={child}
                              emojiById={emojiById}
                              userById={userById}
                            />
                          </DiscordListItem>
                        ))}
                      </DiscordUnorderedList>
                    )}
                  </DiscordListItem>
                ))}
              </DiscordOrderedList>
            );
        }
      })}
    </>
  );
}
