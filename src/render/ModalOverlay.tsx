import { DiscordModal } from '@skyra/discord-components-react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ModalLayer, ModalSelectKind, ModalSelectOption } from '../lib/types.ts';
import { ComponentType, TextInputStyle } from '../lib/types.ts';
import { Markdown } from './markdown.tsx';
import { defaultBotProps, skyraAuthorProps } from './skyraAuthor.ts';
import skyraModalOverrides from '../styles/skyraModalOverrides.css?inline';

const SELECT_PLACEHOLDERS: Record<ModalSelectKind, string> = {
  role: 'Make a selection',
  channel: 'Make a selection',
  string: 'Make a selection',
};

function RoleShieldIcon() {
  return (
    <svg
      className="modal-select-option__leading-icon"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4.5c1.66 0 3 1.12 3 2.5s-1.34 2.5-3 2.5S9 9.88 9 8.5 10.34 5.5 12 5.5zm0 12.13c-2.33 0-4.38-1.19-5.93-3.05C7.41 13.21 9.55 12.5 12 12.5s4.59.71 5.93 2.08c-1.55 1.86-3.6 3.05-5.93 3.05z"
      />
    </svg>
  );
}

function RoleMemberCountIcon() {
  return (
    <svg
      className="modal-select-option__member-icon"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
      />
    </svg>
  );
}

function ChannelLeadingIcon({
  channelType = 'text',
}: {
  channelType?: ModalSelectOption['channelType'];
}) {
  if (channelType === 'voice') {
    return (
      <svg
        className="modal-select-option__leading-icon"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path
          fill="currentColor"
          d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zm5 9a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2z"
        />
      </svg>
    );
  }
  return (
    <span className="modal-select-option__channel-hash" aria-hidden>
      #
    </span>
  );
}

function ModalSelectOptionRow({
  kind,
  option,
}: {
  kind: ModalSelectKind;
  option: ModalSelectOption;
}) {
  if (kind === 'role') {
    const memberCount = option.memberCount ?? 1;
    return (
      <div
        className="modal-select-option modal-select-option--role"
        role="option"
        data-modal-select-option={option.label}
      >
        <span className="modal-select-option__main">
          <RoleShieldIcon />
          <span className="modal-select-option__label">{option.label}</span>
        </span>
        <span className="modal-select-option__count" aria-label={`${memberCount} membres`}>
          <RoleMemberCountIcon />
          <span>{memberCount}</span>
        </span>
      </div>
    );
  }

  if (kind === 'channel') {
    return (
      <div
        className="modal-select-option modal-select-option--channel"
        role="option"
        data-modal-select-option={option.label}
      >
        <span className="modal-select-option__main">
          <ChannelLeadingIcon channelType={option.channelType} />
          <span className="modal-select-option__label">{option.label}</span>
        </span>
      </div>
    );
  }

  return (
    <div
      className="modal-select-option modal-select-option--string"
      role="option"
      data-modal-select-option={option.label}
    >
      <span className="modal-select-option__text">
        <span className="modal-select-option__label">{option.label}</span>
        {option.description ? (
          <span className="modal-select-option__description">{option.description}</span>
        ) : null}
      </span>
    </div>
  );
}

function ModalSelect({
  customId,
  label,
  required,
  display,
  placeholder,
  focused,
  open,
  options,
  kind,
}: {
  customId: string;
  label: string;
  required?: boolean;
  display: string;
  placeholder: string;
  focused?: boolean;
  open?: boolean;
  options?: ModalSelectOption[];
  kind: ModalSelectKind;
}) {
  const hasValue = Boolean(display) && display !== placeholder;
  const isFocused = Boolean(focused || open);
  return (
    <div className={`modal-field${isFocused ? ' modal-field--focused' : ''}`}>
      <label className="modal-label">
        {label}
        {required ? <span className="modal-required"> *</span> : null}
      </label>
      <div className="modal-select-wrap">
        <div
          className={`modal-select${isFocused ? ' modal-field-control--focused' : ''}${
            open ? ' modal-select--open' : ''
          }${hasValue ? ' modal-select--filled' : ''}`}
          data-modal-select={customId}
        >
          <span className="modal-select-placeholder">{display || placeholder}</span>
          <span className="modal-select-chevron" aria-hidden>
            ▾
          </span>
        </div>
        {open && options && options.length > 0 ? (
          <div className="modal-select-dropdown" role="listbox">
            {options.map((option) => (
              <ModalSelectOptionRow key={option.label} kind={kind} option={option} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function modalSelectKind(type: number): ModalSelectKind | null {
  if (type === ComponentType.RoleSelect) return 'role';
  if (type === ComponentType.ChannelSelect) return 'channel';
  if (type === ComponentType.StringSelect) return 'string';
  return null;
}

function setModalInputValue(host: HTMLElement | null, value: string) {
  const field = host?.querySelector('input, textarea') as
    HTMLInputElement | HTMLTextAreaElement | null;
  if (field) field.value = value;
}

function AnimatedModalInput({
  customId,
  value,
  label,
  type,
  required,
  focused,
}: {
  customId: string;
  value: string;
  label: string;
  type: 'short' | 'paragraph';
  required: boolean;
  focused?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setModalInputValue(hostRef.current, value);
    const id = window.requestAnimationFrame(() => {
      setModalInputValue(hostRef.current, value);
    });
    const id2 = window.setTimeout(() => {
      setModalInputValue(hostRef.current, value);
    }, 0);
    return () => {
      window.cancelAnimationFrame(id);
      window.clearTimeout(id2);
    };
  }, [value]);

  useEffect(() => {
    if (!focused) return;
    const field = hostRef.current?.querySelector('input, textarea') as
      HTMLInputElement | HTMLTextAreaElement | null;
    field?.focus({ preventScroll: true });
  }, [focused, value]);

  const fieldClass = `${type === 'paragraph' ? 'modal-textarea' : 'modal-input'}${
    focused ? ' modal-field-control--focused' : ''
  }`;

  return (
    <div
      ref={hostRef}
      className={`modal-field${focused ? ' modal-field--focused' : ''}`}
      data-modal-field={customId}
    >
      <label className="modal-label">
        {label}
        {required ? <span className="modal-required"> *</span> : null}
      </label>
      {type === 'paragraph' ? (
        <textarea className={fieldClass} readOnly defaultValue={value} rows={4} />
      ) : (
        <input className={fieldClass} type="text" readOnly defaultValue={value} />
      )}
    </div>
  );
}

function ModalTextDisplay({ content }: { content: string }) {
  return (
    <div className="modal-field modal-text-display">
      <Markdown content={content} />
    </div>
  );
}

function ModalField({
  comp,
  values,
  roleDisplay,
  focusedField,
  openSelectField,
  selectOptions,
}: {
  comp: Record<string, unknown>;
  values?: Record<string, string | string[] | null>;
  roleDisplay?: Record<string, string>;
  focusedField?: string | null;
  openSelectField?: string | null;
  selectOptions?: ModalSelectOption[];
}) {
  if (comp.type === ComponentType.TextDisplay) {
    return <ModalTextDisplay content={(comp.content as string) ?? ''} />;
  }

  if (comp.type === ComponentType.Label) {
    const label = (comp.label as string) ?? '';
    const inner = comp.component as Record<string, unknown> | undefined;
    if (!inner) return null;

    if (inner.type === ComponentType.TextInput) {
      const customId = (inner.custom_id as string) ?? '';
      const style = (inner.style as number) ?? TextInputStyle.Short;
      const value = (values?.[customId] as string) ?? '';
      return (
        <AnimatedModalInput
          customId={customId}
          value={value}
          label={label}
          type={style === TextInputStyle.Paragraph ? 'paragraph' : 'short'}
          required={Boolean(inner.required)}
          focused={focusedField === customId}
        />
      );
    }

    const selectKind = modalSelectKind(inner.type as number);
    if (selectKind) {
      const customId = (inner.custom_id as string) ?? '';
      const focused = focusedField === customId;
      const open = openSelectField === customId;
      const placeholder =
        (inner.placeholder as string | undefined) ?? SELECT_PLACEHOLDERS[selectKind];
      return (
        <ModalSelect
          key={customId}
          customId={customId}
          label={label}
          required={Boolean(inner.required)}
          display={roleDisplay?.[customId] ?? placeholder}
          placeholder={placeholder}
          focused={focused}
          open={open}
          options={open ? selectOptions : undefined}
          kind={selectKind}
        />
      );
    }
  }

  if (import.meta.env.DEV) {
    return (
      <div className="component-fallback">Unsupported modal field type {comp.type as number}</div>
    );
  }
  return null;
}

function getModalElements(host: HTMLDivElement | null) {
  const modalHost = host?.querySelector('discord-modal');
  const shadow = modalHost?.shadowRoot;
  return {
    dialog: shadow?.querySelector('dialog') as HTMLDialogElement | null,
    box: shadow?.querySelector('.discord-modal-box') as HTMLElement | null,
    submitButton: shadow?.querySelector('.discord-modal-button-submit') as HTMLButtonElement | null,
    submitContent: shadow?.querySelector(
      '.discord-modal-button-submit .discord-modal-button-content',
    ) as HTMLElement | null,
  };
}

function applySkyraModalStyleOverrides(host: HTMLDivElement | null) {
  const shadow = host?.querySelector('discord-modal')?.shadowRoot;
  if (!shadow || shadow.querySelector('[data-scenario-modal-overrides]')) return;

  const style = document.createElement('style');
  style.setAttribute('data-scenario-modal-overrides', '');
  style.textContent = skyraModalOverrides;
  shadow.appendChild(style);
}

function setModalSubmitLoading(host: HTMLDivElement | null, loading: boolean) {
  const { submitButton, submitContent } = getModalElements(host);
  if (!submitButton || !submitContent) return;

  if (loading) {
    if (!submitContent.dataset.originalText) {
      submitContent.dataset.originalText = submitContent.textContent ?? 'Submit';
    }
    submitContent.innerHTML =
      '<span class="interaction-dots" aria-hidden="true"><span></span><span></span><span></span></span>';
    submitButton.disabled = true;
    submitButton.classList.add('discord-modal-button-submit--loading');
    submitButton.setAttribute('aria-busy', 'true');
    return;
  }

  if (submitContent.dataset.originalText) {
    submitContent.textContent = submitContent.dataset.originalText;
    delete submitContent.dataset.originalText;
  }
  submitButton.disabled = false;
  submitButton.classList.remove('discord-modal-button-submit--loading');
  submitButton.removeAttribute('aria-busy');
}

function openSkyraModal(host: HTMLDivElement | null, useTopLayer: boolean) {
  const { dialog, box } = getModalElements(host);
  if (!dialog || dialog.open) return;

  applySkyraModalStyleOverrides(host);

  if (useTopLayer) {
    dialog.showModal();
  } else {
    dialog.show();
  }
  dialog.classList.add('discord-modal-open');
  if (box) box.style.display = 'flex';
}

function closeSkyraModal(host: HTMLDivElement | null) {
  const { dialog } = getModalElements(host);
  dialog?.close();
}

export function ModalOverlay({
  modal,
  closing,
  submitting = false,
  /** false en scénario : dialog.show() pour laisser le curseur au-dessus (z-index) */
  useTopLayer = true,
}: {
  modal: ModalLayer;
  closing?: boolean;
  submitting?: boolean;
  useTopLayer?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const title = (modal.data.title as string) ?? 'Modal';
  const components = (modal.data.components as Record<string, unknown>[]) ?? [];
  const authorProps = modal.author ? skyraAuthorProps(modal.author) : defaultBotProps();

  useEffect(() => {
    if (closing) return;

    openSkyraModal(hostRef.current, useTopLayer);
    const id = window.setTimeout(() => openSkyraModal(hostRef.current, useTopLayer), 0);
    const id2 = window.setTimeout(() => openSkyraModal(hostRef.current, useTopLayer), 50);

    return () => {
      window.clearTimeout(id);
      window.clearTimeout(id2);
    };
  }, [modal, closing, useTopLayer]);

  useEffect(() => {
    if (!closing) return;
    setModalSubmitLoading(hostRef.current, false);
    closeSkyraModal(hostRef.current);
  }, [closing]);

  useEffect(() => {
    if (closing) return;
    applySkyraModalStyleOverrides(hostRef.current);
    setModalSubmitLoading(hostRef.current, submitting);
    const id = window.setTimeout(() => {
      applySkyraModalStyleOverrides(hostRef.current);
      setModalSubmitLoading(hostRef.current, submitting);
    }, 0);
    return () => window.clearTimeout(id);
  }, [submitting, closing, modal]);

  return createPortal(
    <div
      ref={hostRef}
      className={`skyra-modal-host${closing ? ' skyra-modal-host--closing' : ''}${useTopLayer ? '' : ' skyra-modal-host--stacked'}`}
    >
      <DiscordModal modalId="scenario-modal" modalTitle={title} {...authorProps}>
        {components.map((comp, i) => (
          <ModalField
            key={i}
            comp={comp}
            values={modal.values}
            roleDisplay={modal.roleDisplay}
            focusedField={modal.focusedField}
            openSelectField={modal.openSelectField}
            selectOptions={modal.selectOptions}
          />
        ))}
      </DiscordModal>
    </div>,
    document.body,
  );
}
