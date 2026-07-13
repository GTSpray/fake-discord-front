import { DiscordModal } from '@skyra/discord-components-react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ModalLayer } from '../lib/types.ts';
import { ComponentType, TextInputStyle } from '../lib/types.ts';
import { defaultBotProps, skyraAuthorProps } from './skyraAuthor.ts';
import skyraModalOverrides from '../styles/skyraModalOverrides.css?inline';

function ModalRoleSelect({
  label,
  required,
  display,
}: {
  label: string;
  required?: boolean;
  display: string;
}) {
  return (
    <div className="modal-field">
      <label className="modal-label">
        {label}
        {required ? <span className="modal-required"> *</span> : null}
      </label>
      <div className="modal-role-select">
        <span className="modal-role-placeholder">{display}</span>
        <span className="modal-role-chevron">▾</span>
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
}: {
  customId: string;
  value: string;
  label: string;
  type: 'short' | 'paragraph';
  required: boolean;
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

  const fieldClass = type === 'paragraph' ? 'modal-textarea' : 'modal-input';

  return (
    <div ref={hostRef} className="modal-field" data-modal-field={customId}>
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

function ModalField({
  comp,
  values,
  roleDisplay,
}: {
  comp: Record<string, unknown>;
  values?: Record<string, string | string[] | null>;
  roleDisplay?: Record<string, string>;
}) {
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
        />
      );
    }

    if (inner.type === ComponentType.RoleSelect) {
      const customId = (inner.custom_id as string) ?? '';
      return (
        <ModalRoleSelect
          key={customId}
          label={label}
          required={Boolean(inner.required)}
          display={roleDisplay?.[customId] ?? 'Select roles'}
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
  /** false en scénario : dialog.show() pour laisser le curseur au-dessus (z-index) */
  useTopLayer = true,
}: {
  modal: ModalLayer;
  closing?: boolean;
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
    closeSkyraModal(hostRef.current);
  }, [closing]);

  return createPortal(
    <div
      ref={hostRef}
      className={`skyra-modal-host${closing ? ' skyra-modal-host--closing' : ''}${useTopLayer ? '' : ' skyra-modal-host--stacked'}`}
    >
      <DiscordModal modalId="scenario-modal" modalTitle={title} {...authorProps}>
        {components.map((comp, i) => (
          <ModalField key={i} comp={comp} values={modal.values} roleDisplay={modal.roleDisplay} />
        ))}
      </DiscordModal>
    </div>,
    document.body,
  );
}
