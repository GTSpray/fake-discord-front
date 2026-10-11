import {
  DiscordActionRow,
  DiscordAttachments,
  DiscordButton,
} from '@skyra/discord-components-react';
import { useState } from 'react';
import { resolveSelectOptionEmoji, type SelectOptionEmoji } from '../lib/emojiResolve.ts';
import type { DiscordComponent } from '../lib/types.ts';
import { ButtonStyle, ComponentType, MessageFlags } from '../lib/types.ts';
import { Markdown } from './markdown.tsx';
import { InteractionDots } from './InteractionDots.tsx';
import { SkyraMarkdown } from './skyraMarkdown.tsx';
import { useEmojiRegistry } from './useEmojiRegistry.ts';

function skyraButtonType(style: number): 'primary' | 'secondary' {
  return style === ButtonStyle.Primary ? 'primary' : 'secondary';
}

function Unsupported({ type }: { type: number }) {
  if (!import.meta.env.DEV) return null;
  return <div className="component-fallback">Unsupported component type {type}</div>;
}

interface StringSelectOption {
  label?: string;
  value?: string;
  description?: string;
  emoji?: SelectOptionEmoji;
}

function SkyraButton({
  comp,
  highlightedLabel,
  loadingLabel,
}: {
  comp: DiscordComponent;
  highlightedLabel?: string | null;
  loadingLabel?: string | null;
}) {
  const style = (comp.style as number) ?? ButtonStyle.Secondary;
  const label = (comp.label as string) ?? 'Button';
  const isHighlighted = highlightedLabel != null && label === highlightedLabel;
  const isLoading = loadingLabel != null && label === loadingLabel;
  const className = [
    isHighlighted ? 'skyra-button--highlighted' : undefined,
    isLoading ? 'skyra-button--loading' : undefined,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <DiscordButton
      type={skyraButtonType(style)}
      // Skyra n’a pas de prop `loading` — on simule via le slot + disabled hors chargement
      disabled={!isLoading}
      className={className || undefined}
      data-scenario-button-label={label}
    >
      {isLoading ? <InteractionDots variant="button" /> : label}
    </DiscordButton>
  );
}

function SelectOptionEmojiVisual({ emoji, emojiName }: { emoji?: string; emojiName?: string }) {
  if (!emoji) return null;
  const isUrl = emoji.startsWith('http') || emoji.startsWith('/') || emoji.startsWith('./');
  if (isUrl) {
    return (
      <img className="message-string-select-option__emoji" src={emoji} alt={emojiName ?? ''} />
    );
  }
  return (
    <span className="message-string-select-option__emoji" aria-hidden>
      {emoji}
    </span>
  );
}

function MessageStringSelect({
  comp,
  open: openProp,
  selectedLabel,
  loading = false,
}: {
  comp: DiscordComponent;
  open?: boolean;
  selectedLabel?: string | null;
  loading?: boolean;
}) {
  const emojiById = useEmojiRegistry();
  const [localOpen, setLocalOpen] = useState(false);
  const placeholder = (comp.placeholder as string) || 'Make a selection';
  const customId = (comp.custom_id as string) || undefined;
  const disabled = Boolean(comp.disabled);
  const options = (comp.options as StringSelectOption[] | undefined) ?? [];
  const open = loading ? false : (openProp ?? localOpen);
  const display = selectedLabel || placeholder;
  const filled = Boolean(selectedLabel);

  return (
    <div className="message-string-select-wrap">
      <button
        type="button"
        className={`message-string-select${open ? ' message-string-select--open' : ''}${
          filled ? ' message-string-select--filled' : ''
        }${loading ? ' message-string-select--loading' : ''}${
          disabled && !loading ? ' message-string-select--disabled' : ''
        }`}
        disabled={disabled || loading}
        data-scenario-select={customId ?? placeholder}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-busy={loading || undefined}
        onClick={() => {
          if (disabled || loading || openProp != null) return;
          setLocalOpen((value) => !value);
        }}
      >
        <span className="message-string-select__placeholder">{display}</span>
        {loading ? (
          <InteractionDots variant="select" />
        ) : (
          <svg
            className="message-string-select__chevron"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path fill="currentColor" d="M7.41 8.58 12 13.17l4.59-4.59L18 10l-6 6-6-6z" />
          </svg>
        )}
      </button>
      {open && options.length > 0 ? (
        <div className="message-string-select-dropdown" role="listbox">
          {options.map((option, i) => {
            const label = option.label ?? option.value ?? `Option ${i + 1}`;
            const { emoji, emojiName } = resolveSelectOptionEmoji(option.emoji, emojiById);
            return (
              <div
                key={`${label}-${i}`}
                className="message-string-select-option"
                role="option"
                data-scenario-select-option={label}
              >
                <SelectOptionEmojiVisual emoji={emoji} emojiName={emojiName} />
                <span className="message-string-select-option__text">
                  <span className="message-string-select-option__label">{label}</span>
                  {option.description ? (
                    <span className="message-string-select-option__description">
                      {option.description}
                    </span>
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function TextDisplay({ comp }: { comp: DiscordComponent }) {
  const content = (comp.content as string) ?? '';
  return (
    <div className="cv2-text-display">
      <Markdown content={content} />
    </div>
  );
}

function Thumbnail({ comp }: { comp: DiscordComponent }) {
  const media = comp.media as { url?: string } | undefined;
  const url = media?.url ?? '';
  return <img className="cv2-thumbnail" src={url} alt="" />;
}

function Separator({ comp }: { comp: DiscordComponent }) {
  const divider = comp.divider !== false;
  return <div className={`cv2-separator${divider ? ' cv2-separator--divider' : ''}`} />;
}

function Section({
  comp,
  highlightedButton,
  loadingButton,
  openMessageSelect,
  loadingMessageSelect,
  messageSelectValues,
}: {
  comp: DiscordComponent;
  highlightedButton?: string | null;
  loadingButton?: string | null;
  openMessageSelect?: string | null;
  loadingMessageSelect?: string | null;
  messageSelectValues?: Record<string, string>;
}) {
  const children = (comp.components as DiscordComponent[]) ?? [];
  const accessory = comp.accessory as DiscordComponent | undefined;

  return (
    <div className="cv2-section">
      <div className="cv2-section-body">
        {children.map((c, i) => (
          <Component
            key={i}
            comp={c}
            highlightedButton={highlightedButton}
            loadingButton={loadingButton}
            openMessageSelect={openMessageSelect}
            loadingMessageSelect={loadingMessageSelect}
            messageSelectValues={messageSelectValues}
          />
        ))}
      </div>
      {accessory && (
        <div className="cv2-section-accessory">
          <Component
            comp={accessory}
            highlightedButton={highlightedButton}
            loadingButton={loadingButton}
            openMessageSelect={openMessageSelect}
            loadingMessageSelect={loadingMessageSelect}
            messageSelectValues={messageSelectValues}
          />
        </div>
      )}
    </div>
  );
}

function MediaGallery({ comp }: { comp: DiscordComponent }) {
  const items = (comp.items as { media?: { url?: string }; description?: string }[]) ?? [];
  const single = items.length === 1;

  return (
    <div className={`cv2-media-gallery${single ? ' cv2-media-gallery--single' : ''}`}>
      {items.map((item, i) => (
        <img key={i} src={item.media?.url ?? ''} alt={item.description ?? ''} />
      ))}
    </div>
  );
}

function Component({
  comp,
  highlightedButton,
  loadingButton,
  openMessageSelect,
  loadingMessageSelect,
  messageSelectValues,
}: {
  comp: DiscordComponent;
  highlightedButton?: string | null;
  loadingButton?: string | null;
  openMessageSelect?: string | null;
  loadingMessageSelect?: string | null;
  messageSelectValues?: Record<string, string>;
}) {
  switch (comp.type) {
    case ComponentType.ActionRow:
      return null;
    case ComponentType.Button:
      return (
        <SkyraButton
          comp={comp}
          highlightedLabel={highlightedButton}
          loadingLabel={loadingButton}
        />
      );
    case ComponentType.StringSelect: {
      const field = (comp.custom_id as string) || (comp.placeholder as string) || '';
      return (
        <MessageStringSelect
          comp={comp}
          open={openMessageSelect != null ? openMessageSelect === field : undefined}
          selectedLabel={messageSelectValues?.[field] ?? null}
          loading={loadingMessageSelect === field}
        />
      );
    }
    case ComponentType.Section:
      return (
        <Section
          comp={comp}
          highlightedButton={highlightedButton}
          loadingButton={loadingButton}
          openMessageSelect={openMessageSelect}
          loadingMessageSelect={loadingMessageSelect}
          messageSelectValues={messageSelectValues}
        />
      );
    case ComponentType.TextDisplay:
      return <TextDisplay comp={comp} />;
    case ComponentType.Thumbnail:
      return <Thumbnail comp={comp} />;
    case ComponentType.Separator:
      return <Separator comp={comp} />;
    case ComponentType.MediaGallery:
      return <MediaGallery comp={comp} />;
    default:
      return <Unsupported type={comp.type} />;
  }
}

function SkyraActionRows({
  components,
  highlightedButton,
  loadingButton,
  openMessageSelect,
  loadingMessageSelect,
  messageSelectValues,
}: {
  components: DiscordComponent[];
  highlightedButton?: string | null;
  loadingButton?: string | null;
  openMessageSelect?: string | null;
  loadingMessageSelect?: string | null;
  messageSelectValues?: Record<string, string>;
}) {
  const rows = components.filter((c) => c.type === ComponentType.ActionRow);
  if (!rows.length) return null;

  return (
    <DiscordAttachments slot="components">
      {rows.map((row, i) => {
        const children = (row.components as DiscordComponent[]) ?? [];
        return (
          <DiscordActionRow key={i}>
            {children.map((child, j) => (
              <Component
                key={j}
                comp={child}
                highlightedButton={highlightedButton}
                loadingButton={loadingButton}
                openMessageSelect={openMessageSelect}
                loadingMessageSelect={loadingMessageSelect}
                messageSelectValues={messageSelectValues}
              />
            ))}
          </DiscordActionRow>
        );
      })}
    </DiscordAttachments>
  );
}

function NonRowComponentList({
  components,
  highlightedButton,
  loadingButton,
  openMessageSelect,
  loadingMessageSelect,
  messageSelectValues,
  isV2,
}: {
  components: DiscordComponent[];
  highlightedButton?: string | null;
  loadingButton?: string | null;
  openMessageSelect?: string | null;
  loadingMessageSelect?: string | null;
  messageSelectValues?: Record<string, string>;
  isV2: boolean;
}) {
  const nonRows = components.filter((c) => c.type !== ComponentType.ActionRow);
  if (!nonRows.length) return null;

  return (
    <div className={isV2 ? 'components-v2 components-v2--flat' : 'components-v1'}>
      {nonRows.map((c, i) => (
        <Component
          key={i}
          comp={c}
          highlightedButton={highlightedButton}
          loadingButton={loadingButton}
          openMessageSelect={openMessageSelect}
          loadingMessageSelect={loadingMessageSelect}
          messageSelectValues={messageSelectValues}
        />
      ))}
    </div>
  );
}

export function InteractionBody({
  data,
  highlightedButton,
  loadingButton,
  openMessageSelect,
  loadingMessageSelect,
  messageSelectValues,
  useSkyraMarkdown = false,
}: {
  data: { content?: string; flags?: number; components?: DiscordComponent[] };
  highlightedButton?: string | null;
  loadingButton?: string | null;
  openMessageSelect?: string | null;
  loadingMessageSelect?: string | null;
  messageSelectValues?: Record<string, string>;
  useSkyraMarkdown?: boolean;
}) {
  const components = data.components ?? [];
  const isV2 = Boolean((data.flags ?? 0) & MessageFlags.IsComponentsV2);
  const Content = useSkyraMarkdown && !isV2 ? SkyraMarkdown : Markdown;

  return (
    <>
      {data.content && (
        <div className={`interaction-body${isV2 ? ' interaction-body--v2' : ''}`}>
          <Content content={data.content} />
        </div>
      )}
      <NonRowComponentList
        components={components}
        highlightedButton={highlightedButton}
        loadingButton={loadingButton}
        openMessageSelect={openMessageSelect}
        loadingMessageSelect={loadingMessageSelect}
        messageSelectValues={messageSelectValues}
        isV2={isV2}
      />
      <SkyraActionRows
        components={components}
        highlightedButton={highlightedButton}
        loadingButton={loadingButton}
        openMessageSelect={openMessageSelect}
        loadingMessageSelect={loadingMessageSelect}
        messageSelectValues={messageSelectValues}
      />
    </>
  );
}
