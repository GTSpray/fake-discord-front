import {
  DiscordActionRow,
  DiscordAttachments,
  DiscordButton,
} from '@skyra/discord-components-react';
import type { DiscordComponent } from '../lib/types.ts';
import { ButtonStyle, ComponentType, MessageFlags } from '../lib/types.ts';
import { Markdown } from './markdown.tsx';
import { InteractionDots } from './InteractionDots.tsx';
import { SkyraMarkdown } from './skyraMarkdown.tsx';

function skyraButtonType(style: number): 'primary' | 'secondary' {
  return style === ButtonStyle.Primary ? 'primary' : 'secondary';
}

function Unsupported({ type }: { type: number }) {
  if (!import.meta.env.DEV) return null;
  return <div className="component-fallback">Unsupported component type {type}</div>;
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
}: {
  comp: DiscordComponent;
  highlightedButton?: string | null;
  loadingButton?: string | null;
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
          />
        ))}
      </div>
      {accessory && (
        <div className="cv2-section-accessory">
          <Component
            comp={accessory}
            highlightedButton={highlightedButton}
            loadingButton={loadingButton}
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
}: {
  comp: DiscordComponent;
  highlightedButton?: string | null;
  loadingButton?: string | null;
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
    case ComponentType.Section:
      return (
        <Section comp={comp} highlightedButton={highlightedButton} loadingButton={loadingButton} />
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
}: {
  components: DiscordComponent[];
  highlightedButton?: string | null;
  loadingButton?: string | null;
}) {
  const rows = components.filter((c) => c.type === ComponentType.ActionRow);
  if (!rows.length) return null;

  return (
    <DiscordAttachments slot="components">
      {rows.map((row, i) => {
        const buttons = (row.components as DiscordComponent[]) ?? [];
        return (
          <DiscordActionRow key={i}>
            {buttons.map((btn, j) => (
              <Component
                key={j}
                comp={btn}
                highlightedButton={highlightedButton}
                loadingButton={loadingButton}
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
  isV2,
}: {
  components: DiscordComponent[];
  highlightedButton?: string | null;
  loadingButton?: string | null;
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
        />
      ))}
    </div>
  );
}

export function InteractionBody({
  data,
  highlightedButton,
  loadingButton,
  useSkyraMarkdown = false,
}: {
  data: { content?: string; flags?: number; components?: DiscordComponent[] };
  highlightedButton?: string | null;
  loadingButton?: string | null;
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
        isV2={isV2}
      />
      <SkyraActionRows
        components={components}
        highlightedButton={highlightedButton}
        loadingButton={loadingButton}
      />
    </>
  );
}

export { defaultAvatar } from './skyraAuthor.ts';
