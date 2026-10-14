import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { highlightMemberName } from './MemberJoinMessage.tsx';

describe('highlightMemberName', () => {
  it('wraps the member name in <i> for Skyra join styling', () => {
    const nodes = highlightMemberName('Bienvenue, GTSpray. Dis bonjour !', 'GTSpray');
    expect(nodes).toHaveLength(3);
    expect(nodes[0]).toBe('Bienvenue, ');
    expect(nodes[1]).toEqual(createElement('i', { key: 'member-0' }, 'GTSpray'));
    expect(nodes[2]).toBe('. Dis bonjour !');
  });

  it('returns the content unchanged when the name is absent', () => {
    expect(highlightMemberName('Bienvenue !', 'GTSpray')).toEqual(['Bienvenue !']);
  });
});
