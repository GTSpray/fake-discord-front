import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { highlightMemberName } from './highlightMemberName.tsx';

describe('highlightMemberName', () => {
  it('wraps the member name in <i> for Skyra join styling', () => {
    const nodes = highlightMemberName('Welcome, GTSpray. Say hi!', 'GTSpray');
    expect(nodes).toHaveLength(3);
    expect(nodes[0]).toBe('Welcome, ');
    expect(nodes[1]).toEqual(createElement('i', { key: 'member-0' }, 'GTSpray'));
    expect(nodes[2]).toBe('. Say hi!');
  });

  it('returns the content unchanged when the name is absent', () => {
    expect(highlightMemberName('Welcome!', 'GTSpray')).toEqual(['Welcome!']);
  });
});
