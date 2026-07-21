import { describe, expect, it } from 'vitest';
import { formatSkyraClockTime, skyraTimestampProps } from './skyraTimestamp.ts';

describe('skyraTimestampProps', () => {
  it('defaults to a HH:MM string with twentyFour', () => {
    expect(skyraTimestampProps()).toEqual({
      timestamp: formatSkyraClockTime(new Date()),
      twentyFour: true,
    });
  });

  it('passes through full date strings', () => {
    expect(skyraTimestampProps('16/06/2026 12:17')).toEqual({
      timestamp: '16/06/2026 12:17',
      twentyFour: false,
    });
  });

  it('detects short clock strings', () => {
    expect(skyraTimestampProps('12:17')).toEqual({
      timestamp: '12:17',
      twentyFour: true,
    });
  });
});
