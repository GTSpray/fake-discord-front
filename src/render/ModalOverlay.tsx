import { DiscordModal } from '@skyra/discord-components-react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ModalLayer } from '../lib/types.ts';
import { ComponentType, TextInputStyle } from '../lib/types.ts';
import { Markdown } from './markdown.tsx';
import { defaultBotProps, skyraAuthorProps } from './skyraAuthor.ts';
import skyraModalOverrides from '../styles/skyraModalOverrides.css?inline';

function ModalRoleSelect({
  customId,
  label,
  required,
  display,
  focused,
  open,
  options,
}: {
  customId: string;
  label: string;
  required?: boolean;
  display: string;
  focused?: boolean;
  open?: boolean;
  options?: string[];
}) {
  const hasValue = Boolean(display) && display !== 'Select roles';
  const isFocused = Boolean(focused || open);
  return (
    <div className={`modal-field${isFocused ? ' modal-field--focused' : ''}`}>
      <label className="modal-label">
        {label}
        {required ? <span className="modal-required"> *</span> : null}
      </label>
      <div className="modal-role-select-wrap">
        <div
          className={`modal-role-select${isFocused ? ' modal-field-control--focused' : ''}${
            open ? ' modal-role-select--open' : ''
          }${hasValue ? ' modal-role-select--filled' : ''}`}
          data-modal-select={customId}
        >
          <span className="modal-role-placeholder">{display}</span>
          <span className="modal-role-chevron" aria-hidden>
            ▾
          </span>
        </div>
        {open && options && options.length > 0 ? (
          <div className="modal-select-dropdown" role="listbox">
            {options.map((option) => (
              <div
                key={option}
                className="modal-select-option"
                role="option"
                data-modal-select-option={option}
              >
                {option}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
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
  selectOptions?: string[];
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

    if (inner.type === ComponentType.RoleSelect) {
      const customId = (inner.custom_id as string) ?? '';
      const focused = focusedField === customId;
      const open = openSelectField === customId;
      return (
        <ModalRoleSelect
          key={customId}
          customId={customId}
          label={label}
          required={Boolean(inner.required)}
          display={roleDisplay?.[customId] ?? 'Select roles'}
          focused={focused}
          open={open}
          options={open ? selectOptions : undefined}
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
