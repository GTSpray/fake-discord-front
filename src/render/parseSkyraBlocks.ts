type Block =
  | { kind: 'header'; level: 1 | 2 | 3; text: string }
  | { kind: 'ordered'; start: number; items: ListItem[] }
  | { kind: 'unordered'; items: string[] }
  | { kind: 'paragraph'; text: string };

interface ListItem {
  text: string;
  children?: string[];
}

export function parseBlocks(content: string): Block[] {
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
      const start = Number(ordered[1]);
      const items: ListItem[] = [];
      while (i < lines.length) {
        const itemMatch = lines[i].match(/^(\d+)\. (.+)$/);
        if (!itemMatch) break;
        const item: ListItem = { text: itemMatch[2] };
        i++;
        while (i < lines.length) {
          const nested = lines[i].match(/^ {4}- (.+)$/);
          if (!nested) break;
          item.children ??= [];
          item.children.push(nested[1]);
          i++;
        }
        items.push(item);
      }
      blocks.push({ kind: 'ordered', start, items });
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
