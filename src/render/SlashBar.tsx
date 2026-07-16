import { PTITPOTE_AVATAR_URL, PTITPOTE_BOT_NAME } from '../lib/ptitpoteAssets.ts';
import {
  resolveExactSlashCommandMatch,
  splitMatchedCommandName,
  splitSlashInputCommand,
  isFullSlashCommandMatch,
} from '../lib/slashCommandMatch.ts';
import type { SlashLayer, SlashSuggestion } from '../lib/types.ts';
import { AnimatedSlashInput } from './AnimatedSlashInput.tsx';
import { AnimatedSlashParamValue } from './AnimatedSlashParamValue.tsx';
import { DiscordMessageInput } from './DiscordMessageInput.tsx';

function slashCommandPrefix(input: string): string {
  const match = input.match(/^(\/\S+)\s/);
  return match ? `${match[1]} ` : '';
}

function SlashSubcommandSuggestions({
  input,
  suggestions,
  activeIndex,
}: {
  input: string;
  suggestions: SlashSuggestion[];
  activeIndex: number;
}) {
  const commandPrefix = slashCommandPrefix(input);

  return (
    <div className="slash-suggestions">
      {suggestions.map((suggestion, index) => (
        <div
          key={index}
          className={`slash-suggestion${index === activeIndex ? ' slash-suggestion--active' : ''}`}
        >
          {commandPrefix && (
            <span className="slash-suggestion-prefix">{commandPrefix}</span>
          )}
          <span className="slash-suggestion-name">{suggestion.name}</span>
          {suggestion.description && (
            <span className="slash-suggestion-desc">{suggestion.description}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function SlashCommandMatchSuggestions({
  input,
  suggestions,
  activeIndex,
}: {
  input: string;
  suggestions: SlashSuggestion[];
  activeIndex: number;
}) {
  const header = `COMMANDS MATCHING ${input.toUpperCase()}`;

  return (
    <div className="slash-suggestions slash-suggestions--command-match">
      <div className="slash-suggestions-header">{header}</div>
      {suggestions.map((suggestion, index) => (
        <div
          key={index}
          className={`slash-suggestion slash-suggestion--command${
            index === activeIndex ? ' slash-suggestion--active' : ''
          }`}
        >
          <img
            className="slash-suggestion-avatar"
            src={suggestion.botAvatarUrl ?? PTITPOTE_AVATAR_URL}
            alt=""
            width={32}
            height={32}
          />
          <div className="slash-suggestion-body">
            <span className="slash-suggestion-name">
              {(() => {
                const { matched, rest } = splitMatchedCommandName(suggestion.name, input);
                return (
                  <>
                    {matched && (
                      <span className="slash-suggestion-name-match">{matched}</span>
                    )}
                    {rest && <span className="slash-suggestion-name-rest">{rest}</span>}
                    {!matched && !rest && suggestion.name}
                  </>
                );
              })()}
            </span>
            {suggestion.description && (
              <span className="slash-suggestion-desc">{suggestion.description}</span>
            )}
          </div>
          <span className="slash-suggestion-bot">
            {suggestion.botName ?? PTITPOTE_BOT_NAME}
          </span>
        </div>
      ))}
    </div>
  );
}

function SlashInputDisplay({
  input,
  suggestions,
  isFullMatch,
}: {
  input: string;
  suggestions?: SlashSuggestion[];
  isFullMatch: boolean;
}) {
  const { matched, rest } = splitSlashInputCommand(input, suggestions);

  if (!isFullMatch) {
    return <span className="slash-input-display">{matched}</span>;
  }

  return (
    <span className="slash-input-display">
      {matched && <span className="slash-input-command-match">{matched}</span>}
      {rest && <span className="slash-input-command-rest">{rest}</span>}
    </span>
  );
}

function SlashParamField({
  param,
  active,
  typingAnimation,
}: {
  param: { name: string; value?: string };
  active: boolean;
  typingAnimation?: SlashLayer['paramTypingAnimation'];
}) {
  const showTyping = active && typingAnimation;

  return (
    <span className={`slash-param${active ? ' slash-param--active' : ''}`}>
      <span className="slash-param-name">{param.name}</span>
      <span className="slash-param-value">
        {showTyping ? (
          <AnimatedSlashParamValue animation={typingAnimation} />
        ) : (
          param.value ?? ''
        )}
        {active && !showTyping && <span className="slash-caret slash-caret--param" />}
      </span>
    </span>
  );
}

export function SlashBar({ slash, channelName }: { slash: SlashLayer; channelName: string }) {
  const {
    input,
    focused,
    suggestions,
    suggestionMode,
    activeSuggestionIndex,
    params,
    activeParamIndex,
    typingAnimation,
    paramTypingAnimation,
  } = slash;
  const hasParams = Boolean(params?.length);
  const activeParam =
    hasParams && activeParamIndex !== undefined ? params![activeParamIndex] : undefined;
  const showSuggestions = Boolean(suggestions?.length) && focused && !hasParams;
  const resolvedActiveSuggestion = activeSuggestionIndex ?? 0;

  const showParamHelp = Boolean(activeParam?.description) && focused && hasParams;
  const isTyping = Boolean(typingAnimation);
  const isFullMatch =
    hasParams || (!isTyping && isFullSlashCommandMatch(input, suggestions));
  const exactMatch = isFullMatch ? resolveExactSlashCommandMatch(input, suggestions) : undefined;
  const botAvatarUrl = isFullMatch
    ? (exactMatch?.botAvatarUrl ?? PTITPOTE_AVATAR_URL)
    : undefined;

  return (
    <div className="slash-bar">
      {showSuggestions &&
        (suggestionMode === 'commandMatch' ? (
          <SlashCommandMatchSuggestions
            input={input}
            suggestions={suggestions!}
            activeIndex={resolvedActiveSuggestion}
          />
        ) : (
          <SlashSubcommandSuggestions
            input={input}
            suggestions={suggestions!}
            activeIndex={resolvedActiveSuggestion}
          />
        ))}
      <div
        className={`slash-composer-column${showParamHelp ? ' slash-composer-column--param-help' : ''}`}
      >
        {showParamHelp && (
          <div className="slash-param-help">
            <strong className="slash-param-help-name">{activeParam!.name}</strong>
            <span className="slash-param-help-desc">{activeParam!.description}</span>
          </div>
        )}
        <DiscordMessageInput channelName={channelName} variant="focused" flush botAvatarUrl={botAvatarUrl}>
        <div className="slash-input-row">
          {hasParams ? (
            <>
              <span
                className={`slash-command-prefix${isFullMatch ? ' slash-command-prefix--matched' : ''}`}
              >
                {input}
              </span>
              {params!.map((param, index) => (
                <SlashParamField
                  key={param.name}
                  param={param}
                  active={index === activeParamIndex}
                  typingAnimation={
                    paramTypingAnimation?.paramIndex === index ? paramTypingAnimation : undefined
                  }
                />
              ))}
            </>
          ) : typingAnimation ? (
            <AnimatedSlashInput animation={typingAnimation} />
          ) : (
            <>
              <SlashInputDisplay
                input={input}
                suggestions={suggestions}
                isFullMatch={isFullMatch}
              />
              {focused && <span className="slash-caret" />}
            </>
          )}
        </div>
        </DiscordMessageInput>
      </div>
    </div>
  );
}
