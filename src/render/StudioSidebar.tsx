import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ScenarioParseError } from '../lib/uploadScenario.ts';

interface StudioSidebarProps {
  scenarioTitle?: string;
  onUpload: (file: File) => Promise<void>;
  onHide: () => void;
}

export function StudioSidebar({ scenarioTitle, onUpload, onHide }: StudioSidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    try {
      await onUpload(file);
    } catch (err) {
      setUploadError(
        err instanceof ScenarioParseError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Fichier invalide',
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    await handleFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    void handleFile(file);
  }

  return createPortal(
    <aside className="studio-sidebar">
      <header className="studio-sidebar-header">
        <div className="studio-sidebar-header-row">
          <h1>Doc Studio</h1>
          <button type="button" className="studio-sidebar-hide" onClick={onHide}>
            Masquer
          </button>
        </div>
        <p className="studio-hint">S masquer · Espace lecture</p>
      </header>

      <section
        className={`studio-nav-section studio-upload-section${dragOver ? ' studio-upload-section--drag' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <h2 className="studio-nav-heading">Importer</h2>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="studio-upload-input"
          onChange={(e) => void handleFileChange(e)}
        />
        <button
          type="button"
          className="studio-upload-btn"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? 'Chargement…' : 'Charger un JSON'}
        </button>
        <p className="studio-upload-hint">ou glissez un fichier ici</p>
        {uploadError && <p className="studio-upload-error">{uploadError}</p>}
        {scenarioTitle && (
          <p className="studio-upload-active">
            En lecture : <strong>{scenarioTitle}</strong>
          </p>
        )}
      </section>
    </aside>,
    document.body,
  );
}

interface EmptyStateProps {
  onUpload: (file: File) => Promise<void>;
  error?: string | null;
}

export function EmptyState({ onUpload, error }: EmptyStateProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    try {
      await onUpload(file);
    } catch (err) {
      setUploadError(
        err instanceof ScenarioParseError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Fichier invalide',
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      className={`studio-empty${dragOver ? ' studio-empty--drag' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        void handleFile(e.dataTransfer.files[0]);
      }}
    >
      <h1>Doc Studio</h1>
      <p>Importez un fichier JSON pour lancer une démo Discord animée.</p>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="studio-upload-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          void handleFile(file);
        }}
      />
      <button
        type="button"
        className="studio-upload-btn studio-upload-btn--large"
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
      >
        {uploading ? 'Validation…' : 'Charger un JSON'}
      </button>
      <p className="studio-upload-hint">
        Format décrit dans <code>schema/scenario.schema.json</code>
      </p>
      {(uploadError || error) && (
        <pre className="studio-upload-error studio-upload-error--block">{uploadError ?? error}</pre>
      )}
    </div>
  );
}
