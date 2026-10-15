import type { ReactNode } from 'react';

/** Highlight every occurrence of the member name the way Discord styles join mentions. */
export function highlightMemberName(content: string, memberName: string): ReactNode[] {
  if (!memberName) return [content];
  const parts = content.split(memberName);
  if (parts.length === 1) return [content];
  const nodes: ReactNode[] = [];
  parts.forEach((part, index) => {
    if (part) nodes.push(part);
    if (index < parts.length - 1) {
      nodes.push(<i key={`member-${index}`}>{memberName}</i>);
    }
  });
  return nodes;
}
