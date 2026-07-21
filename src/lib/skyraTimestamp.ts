/** Props for Skyra `<discord-message timestamp="…">` — always strings, never Date objects. */
export function formatSkyraClockTime(date: Date = new Date()): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function skyraTimestampProps(timestamp?: string): {
  timestamp: string;
  twentyFour: boolean;
} {
  const ts = timestamp ?? formatSkyraClockTime();
  return {
    timestamp: ts,
    twentyFour: /^\d{1,2}:\d{2}$/.test(ts),
  };
}
