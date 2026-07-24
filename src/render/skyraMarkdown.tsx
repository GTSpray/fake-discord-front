import {
  DiscordHeader,
  DiscordListItem,
  DiscordOrderedList,
  DiscordUnorderedList,
} from '@skyra/discord-components-react';
import { parseBlocks } from './parseSkyraBlocks.ts';

export function SkyraMarkdown({ content }: { content: string }) {
  const blocks = parseBlocks(content);

  return (
    <>
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'header':
            return (
              <DiscordHeader key={i} level={block.level}>
                {block.text}
              </DiscordHeader>
            );
          case 'paragraph':
            return <p key={i}>{block.text}</p>;
          case 'unordered':
            return (
              <DiscordUnorderedList key={i}>
                {block.items.map((item, j) => (
                  <DiscordListItem key={j}>{item}</DiscordListItem>
                ))}
              </DiscordUnorderedList>
            );
          case 'ordered':
            return (
              <DiscordOrderedList key={i} start={block.start}>
                {block.items.map((item, j) => (
                  <DiscordListItem key={j}>
                    {item.text}
                    {item.children && (
                      <DiscordUnorderedList>
                        {item.children.map((child, k) => (
                          <DiscordListItem key={k}>{child}</DiscordListItem>
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
