import type { SlashLayer } from '../lib/types.ts';
import { AnimatedSlashInput } from './AnimatedSlashInput.tsx';
import { DiscordMessageInput } from './DiscordMessageInput.tsx';

function slashCommandPrefix(input: string): string {
  const match = input.match(/^(\/\S+)\s/);
  return match ? `${match[1]} ` : '';
}

export function SlashBar({ slash, channelName }: { slash: SlashLayer; channelName: string }) {
  const { input, focused, suggestions } = slash;
  const commandPrefix = slashCommandPrefix(input);

  return (
    <div className="slash-bar">
      {suggestions && suggestions.length > 0 && focused && (
        <div className="slash-suggestions">
          {suggestions.map((s, i) => (
            <div
              key={i}
              className={`slash-suggestion${i === 0 ? ' slash-suggestion--active' : ''}`}
            >
              {commandPrefix && <span className="slash-suggestion-prefix">{commandPrefix}</span>}
              <span className="slash-suggestion-name">{s.name}</span>
              {s.description && <span className="slash-suggestion-desc">{s.description}</span>}
            </div>
          ))}
        </div>
      )}
      <DiscordMessageInput channelName={channelName} variant="focused">
        {slash.typingAnimation ? (
          <AnimatedSlashInput animation={slash.typingAnimation} />
        ) : (
          <span className="slash-input-display">{input}</span>
        )}
        {focused && <span className="slash-caret" />}
      </DiscordMessageInput>
    </div>
  );
}
