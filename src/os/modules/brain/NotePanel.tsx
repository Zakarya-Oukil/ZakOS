import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { IconButton, Markdown } from '../../ui';
import { cx } from '../../ui/cx';

interface NoteData {
  title: string;
  path: string;
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

  useEffect(() => {
    setNote(null);
    setError(null);
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
  }, [path]);

  return (
    <PanelShell title={note?.title ?? 'Note'} subtitle={note?.branchLabel} onClose={onClose}>
      {error && (
        <p role="alert" className="text-sm text-os-danger">
          {error}
        </p>
      )}
      {!note && !error && <p className="text-sm text-os-muted">Loading note</p>}
      {note && (
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
}

export function PanelShell({ title, subtitle, onClose, children, className }: ShellProps) {
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
        <IconButton aria-label="Close details" onClick={onClose}>
          <X size={16} strokeWidth={1.75} />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
    </aside>
  );
}
