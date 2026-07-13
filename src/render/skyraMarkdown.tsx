import {
  DiscordHeader,
  DiscordListItem,
  DiscordOrderedList,
  DiscordUnorderedList,
} from '@skyra/discord-components-react';

type Block =
  | { kind: 'header'; level: 1 | 2 | 3; text: string }
  | { kind: 'ordered'; items: ListItem[] }
  | { kind: 'unordered'; items: string[] }
  | { kind: 'paragraph'; text: string };

interface ListItem {
  text: string;
  children?: string[];
}

function parseBlocks(content: string): Block[] {
  const lines = content.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    const h3 = line.match(/^### (.+)$/);
    if (h3) {
      blocks.push({ kind: 'header', level: 3, text: h3[1] });
      i++;
      continue;
    }

    const h2 = line.match(/^## (.+)$/);
    if (h2) {
      blocks.push({ kind: 'header', level: 2, text: h2[1] });
      i++;
      continue;
    }

    const h1 = line.match(/^# (.+)$/);
    if (h1) {
      blocks.push({ kind: 'header', level: 1, text: h1[1] });
      i++;
      continue;
    }

    const ordered = line.match(/^(\d+)\. (.+)$/);
    if (ordered) {
      const items: ListItem[] = [{ text: ordered[2] }];
      i++;
      while (i < lines.length) {
        const nested = lines[i].match(/^ {4}- (.+)$/);
        if (!nested) break;
        items[items.length - 1].children ??= [];
        items[items.length - 1].children!.push(nested[1]);
        i++;
      }
      blocks.push({ kind: 'ordered', items });
      continue;
    }

    const bullet = line.match(/^- (.+)$/);
    if (bullet) {
      const items = [bullet[1]];
      i++;
      while (i < lines.length) {
        const next = lines[i].match(/^- (.+)$/);
        if (!next) break;
        items.push(next[1]);
        i++;
      }
      blocks.push({ kind: 'unordered', items });
      continue;
    }

    if (line.trim() === '') {
      i++;
      continue;
    }

    blocks.push({ kind: 'paragraph', text: line });
    i++;
  }

  return blocks;
}

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
              <DiscordOrderedList key={i}>
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
