import { useCallback, useEffect, useRef, useState } from 'react';
import { FolderOpen, Plus, X } from '@phosphor-icons/react';
import { PageFrame } from '../shell/PageFrame';
import { cx } from '../ui/cx';
import { projectsApi, type ProjectInfo } from '../lib/projectsApi';
import { TerminalView } from './terminal/TerminalView';

interface Term {
  id: string;
  title: string;
  cwd: string;
  exitCode: number | null;
}

const ACTIVE_KEY = 'zakos.terminal.active';

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: init?.body ? { 'content-type': 'application/json' } : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

const api = {
  list: () => call<{ sessions: Term[] }>('/api/terminal/sessions').then((r) => r.sessions),
  create: (cwd: string, title?: string) => call<{ session: Term }>('/api/terminal/sessions', { method: 'POST', body: JSON.stringify({ cwd, title }) }).then((r) => r.session),
  rename: (id: string, title: string) => call<{ session: Term }>(`/api/terminal/sessions/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) }).then((r) => r.session),
  close: (id: string) => call<unknown>(`/api/terminal/sessions/${id}`, { method: 'DELETE' }),
};

const select =
  'hidden h-7 max-w-[12rem] rounded-[var(--os-input-radius)] border border-os-line bg-os-bg px-3 text-xs text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] md:block';
const iconBtn =
  'inline-flex h-7 w-7 items-center justify-center rounded-full text-os-muted transition-colors hover:bg-os-surface-2 hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]';

export default function TerminalPage() {
  const [terms, setTerms] = useState<Term[] | null>(null);
  const [activeId, setActiveId] = useState<string>(() => {
    try {
      return localStorage.getItem(ACTIVE_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [startIn, setStartIn] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const pick = useCallback((id: string) => {
    setActiveId(id);
    try {
      localStorage.setItem(ACTIVE_KEY, id);
    } catch {
      /* private window: the tab just is not remembered */
    }
  }, []);

  const open = useCallback(
    async (cwd: string, title?: string) => {
      setError(null);
      try {
        const t = await api.create(cwd, title);
        setTerms((prev) => [...(prev ?? []), t]);
        pick(t.id);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [pick],
  );

  // Shells live on the server, so returning here finds the ones already running.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    projectsApi.list().then((l) => setProjects(l.filter((p) => p.exists))).catch(() => setProjects([]));
    api
      .list()
      .then((list) => {
        setTerms(list);
        if (list.length === 0) void open('');
        else if (!list.some((t) => t.id === activeId)) pick(list[list.length - 1].id);
      })
      .catch((e: Error) => {
        setTerms([]);
        setError(e.message);
      });
  }, [open, pick, activeId]);

  const close = async (id: string) => {
    setError(null);
    try {
      await api.close(id).catch(() => {}); // already gone on the server is fine
      const next = (terms ?? []).filter((t) => t.id !== id);
      setTerms(next);
      if (next.length === 0) void open('');
      else if (id === activeId) pick(next[next.length - 1].id);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const commitRename = async (id: string) => {
    const title = draft.trim();
    setRenaming(null);
    if (!title) return;
    try {
      const t = await api.rename(id, title);
      setTerms((prev) => (prev ?? []).map((x) => (x.id === id ? { ...x, title: t.title } : x)));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const chooseFolder = async () => {
    try {
      const folder = await projectsApi.pickFolder('Open a terminal in');
      if (folder) void open(folder);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const startPath = projects.find((p) => p.id === startIn)?.path ?? '';

  return (
    <PageFrame
      title="Terminal"
      leading={
        <div role="group" aria-label="Terminals" className="flex items-center gap-1">
          {(terms ?? []).map((t) => {
            const selected = t.id === activeId;
            return (
              <div key={t.id} className={cx('group flex items-center rounded-[var(--os-radius)] border', selected ? 'border-os-line bg-os-surface-2' : 'border-transparent hover:bg-os-surface-2')}>
                {renaming === t.id ? (
                  <input
                    autoFocus
                    aria-label="Terminal name"
                    value={draft}
                    maxLength={40}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => void commitRename(t.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') setRenaming(null);
                    }}
                    className="h-7 w-32 rounded-[var(--os-radius-sm)] bg-os-bg px-2 text-sm text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
                  />
                ) : (
                  <button
                    type="button"
                    aria-pressed={selected}
                    title={`${t.cwd}\nDouble-click or press F2 to rename`}
                    onClick={() => pick(t.id)}
                    onDoubleClick={() => {
                      setDraft(t.title);
                      setRenaming(t.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'F2') {
                        setDraft(t.title);
                        setRenaming(t.id);
                      }
                    }}
                    className={cx('h-7 max-w-[10rem] truncate rounded-[var(--os-radius)] pl-2.5 pr-1 text-sm focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]', selected ? 'text-os-text' : 'text-os-muted group-hover:text-os-text')}
                  >
                    {t.title}
                    {t.exitCode !== null && <span className="text-os-muted"> (ended)</span>}
                  </button>
                )}
                <button type="button" aria-label={`Close ${t.title}`} onClick={() => void close(t.id)} className={cx(iconBtn, 'h-6 w-6')}>
                  <X size={13} aria-hidden />
                </button>
              </div>
            );
          })}
        </div>
      }
      actions={
        <>
          <label htmlFor="term-start" className="sr-only">
            Start the next terminal in
          </label>
          <select id="term-start" value={startIn} onChange={(e) => setStartIn(e.target.value)} className={select}>
            <option value="">Zak OS folder</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button type="button" className={iconBtn} aria-label="New terminal" title="New terminal" onClick={() => void open(startPath)}>
            <Plus size={16} aria-hidden />
          </button>
          <button type="button" className={iconBtn} aria-label="New terminal in another folder" title="Choose a folder" onClick={() => void chooseFolder()}>
            <FolderOpen size={16} aria-hidden />
          </button>
        </>
      }
    >
      <div className="flex h-full flex-col">
        {error && (
          <p role="alert" className="border-b border-os-line px-4 py-1.5 text-xs text-os-danger">
            {error}
          </p>
        )}
        {terms && terms.length === 0 && !error && <p className="p-6 text-sm text-os-muted">Opening a terminal</p>}
        <div className="min-h-0 flex-1">
          {(terms ?? []).map((t) => (
            <div key={t.id} role="region" aria-label={t.title} className={t.id === activeId ? 'h-full' : 'hidden'}>
              <TerminalView
                sessionId={t.id}
                active={t.id === activeId}
                onEnded={(why) => why.exitCode !== undefined && setTerms((prev) => (prev ?? []).map((x) => (x.id === t.id ? { ...x, exitCode: why.exitCode ?? 0 } : x)))}
              />
            </div>
          ))}
        </div>
      </div>
    </PageFrame>
  );
}
