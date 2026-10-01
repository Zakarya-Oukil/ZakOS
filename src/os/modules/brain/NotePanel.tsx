import { useEffect, useState } from 'react';
import { PencilSimple, X } from '@phosphor-icons/react';
import { IconButton, Markdown } from '../../ui';
import { cx } from '../../ui/cx';
import { brainApi } from './api';

interface NoteData {
  title: string;
  path: string;
  relativePath: string;
  content: string;
  tags?: string[];
  branchLabel?: string;
  backlinks?: unknown[];
}

interface NoteProps {
  path: string;
  onClose: () => void;
}

/** Reads a vault note through the existing /api/vault/note endpoint. */
export function NoteReader({ path, onClose }: NoteProps) {
  const [note, setNote] = useState<NoteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    setNote(null);
    setError(null);
    setEditing(false);
    let live = true;
    fetch(`/api/vault/note?path=${encodeURIComponent(path)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!live) return;
        if (d.success) setNote(d.note);
        else setError(d.error || 'Could not load this note');
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [path, reload]);

  const save = async () => {
    if (!note) return;
    setSaving(true);
    setError(null);
    try {
      await brainApi.saveNote(note.relativePath, draft);
      setEditing(false);
      setReload((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PanelShell
      title={note?.title ?? 'Note'}
      subtitle={note?.branchLabel}
      onClose={onClose}
      action={
        note && !editing ? (
          <IconButton aria-label="Edit this note" onClick={() => { setDraft(note.content); setEditing(true); }}>
            <PencilSimple size={15} />
          </IconButton>
        ) : undefined
      }
    >
      {error && (
        <p role="alert" className="text-sm text-os-danger">
          {error}
        </p>
      )}
      {!note && !error && <p className="text-sm text-os-muted">Loading note</p>}
      {note && editing && (
        <div className="grid gap-2">
          <label htmlFor="note-edit" className="sr-only">Note text</label>
          <textarea
            id="note-edit"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                void save();
              }
            }}
            spellCheck
            className="min-h-[22rem] w-full resize-y rounded-[var(--os-input-radius)] border border-os-line bg-os-bg p-3 font-os-mono text-[13px] leading-relaxed text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
          />
          <div className="flex items-center gap-2">
            <button type="button" disabled={saving || draft === note.content} onClick={() => void save()} className="h-8 rounded-[var(--os-radius)] border border-os-cyan bg-os-surface-2 px-3 text-sm text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] disabled:opacity-50">
              {saving ? 'Saving' : 'Save'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="h-8 rounded-[var(--os-radius)] border border-os-line px-3 text-sm text-os-muted hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]">Cancel</button>
            <span className="text-xs text-os-muted">Ctrl+S saves. The front matter at the top of the file is kept.</span>
          </div>
        </div>
      )}
      {note && !editing && (
        <>
          {note.tags && note.tags.length > 0 && (
            <p className="mb-3 flex flex-wrap gap-1.5 text-xs text-os-muted">
              {note.tags.slice(0, 8).map((t) => (
                <span key={t} className="rounded-[var(--os-radius-sm)] border border-os-line px-1.5 py-0.5">
                  {t}
                </span>
              ))}
            </p>
          )}
          <Markdown text={note.content} className="text-sm" />
          <p className="mt-4 break-all font-os-mono text-xs text-os-muted">{note.path}</p>
        </>
      )}
    </PanelShell>
  );
}

interface ShellProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  /** Extra control next to the close button, such as Edit. */
  action?: React.ReactNode;
}

export function PanelShell({ title, subtitle, onClose, children, className, action }: ShellProps) {
  return (
    <aside
      aria-label="Details"
      className={cx(
        'absolute inset-y-0 right-0 z-10 flex w-full flex-col border-l border-os-line bg-os-surface md:w-[380px]',
        className,
      )}
    >
      <div className="flex min-h-12 items-start justify-between gap-3 border-b border-os-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="break-words text-[15px] font-semibold leading-snug text-os-text">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-os-muted">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {action}
          <IconButton aria-label="Close details" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
    </aside>
  );
}
