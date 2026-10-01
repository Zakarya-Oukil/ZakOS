import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { CaretDown, CaretRight, File, Folder, FolderOpen, MagnifyingGlass } from '@phosphor-icons/react';
import type { ModuleProps } from '../registry';
import { PageFrame } from '../../shell/PageFrame';
import { Button, EmptyState, ErrorNote, Markdown, Segmented, inputCls } from '../../ui';
import { cx } from '../../ui/cx';
import { api } from '../../lib/api';
import { projectsApi, type ProjectInfo } from '../../lib/projectsApi';

const Monaco = lazy(() => import('@monaco-editor/react'));

interface Entry {
  name: string;
  dir: boolean;
  path: string;
}
type Loaded = { kind: 'text'; content: string; readOnly?: boolean } | { kind: 'image' | 'pdf'; dataUrl: string } | { kind: 'binary'; size: number };

const LANG: Record<string, string> = { ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', json: 'json', md: 'markdown', css: 'css', html: 'html', py: 'python', yml: 'yaml', yaml: 'yaml', sh: 'shell', rs: 'rust', go: 'go' };
const langOf = (p: string) => LANG[p.split('.').pop()?.toLowerCase() ?? ''] ?? 'plaintext';

export default function FilesPage() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [projectId, setProjectId] = useState('');
  const [tree, setTree] = useState<Record<string, Entry[]>>({});
  const [openDirs, setOpenDirs] = useState<Set<string>>(new Set(['']));
  const [file, setFile] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Array<{ path: string; line: number; text: string }> | null>(null);
  const [follow, setFollow] = useState(false);
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [monacoSlow, setMonacoSlow] = useState(false);
  const lastSeen = useRef(Date.now());
  const monacoMounted = useRef(false);

  useEffect(() => {
    projectsApi
      .list()
      .then((p) => {
        setProjects(p);
        if (p[0]) setProjectId((cur) => cur || p[0].id);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const loadDir = useCallback(
    async (dir: string) => {
      if (!projectId) return;
      try {
        const d = await api<{ entries: Entry[] }>(`/api/files/tree?project=${projectId}&dir=${encodeURIComponent(dir)}`);
        setTree((t) => ({ ...t, [dir]: d.entries }));
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [projectId],
  );

  useEffect(() => {
    setTree({});
    setOpenDirs(new Set(['']));
    setFile(null);
    setLoaded(null);
    setHits(null);
    if (projectId) void loadDir('');
  }, [projectId, loadDir]);

  const openFile = useCallback(
    async (p: string) => {
      if (!projectId) return;
      setError(null);
      setNotice(null);
      try {
        const d = await api<Loaded>(`/api/files/read?project=${projectId}&path=${encodeURIComponent(p)}`);
        setFile(p);
        setLoaded(d);
        setView(p.endsWith('.md') ? 'preview' : 'edit');
        if (d.kind === 'text') {
          setDraft(d.content);
          setSaved(d.content);
        }
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [projectId],
  );

  const save = useCallback(async () => {
    if (!file || !projectId || loaded?.kind !== 'text' || loaded.readOnly) return;
    try {
      await api('/api/files/write', { method: 'PUT', body: { project: projectId, path: file, content: draft } });
      setSaved(draft);
      setNotice('Saved');
      setTimeout(() => setNotice(null), 1800);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [file, projectId, draft, loaded]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  // Follow the agent: poll for files changed since the last look and open the newest.
  useEffect(() => {
    if (!follow || !projectId) return;
    lastSeen.current = Date.now();
    const timer = setInterval(async () => {
      try {
        const d = await api<{ files: Array<{ path: string; mtime: number }>; now: number }>(`/api/files/recent?project=${projectId}&since=${Math.floor(lastSeen.current)}`);
        if (d.files[0]) {
          lastSeen.current = d.files[0].mtime;
          if (draft === saved) void openFile(d.files[0].path);
        }
      } catch {
        /* a failed poll is just skipped */
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [follow, projectId, draft, saved, openFile]);

  useEffect(() => {
    if (loaded?.kind !== 'text') return;
    const t = setTimeout(() => !monacoMounted.current && setMonacoSlow(true), 8000);
    return () => clearTimeout(t);
  }, [loaded?.kind, file]);

  const search = async () => {
    if (query.trim().length < 2) return setHits(null);
    try {
      const d = await api<{ hits: Array<{ path: string; line: number; text: string }> }>(`/api/files/search?project=${projectId}&q=${encodeURIComponent(query)}`);
      setHits(d.hits);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const toggleDir = (p: string) => {
    setOpenDirs((s) => {
      const n = new Set(s);
      if (n.has(p)) n.delete(p);
      else {
        n.add(p);
        if (!tree[p]) void loadDir(p);
      }
      return n;
    });
  };

  const renderDir = (dir: string, depth: number) =>
    (tree[dir] ?? []).map((e) => (
      <li key={e.path}>
        {e.dir ? (
          <>
            <button
              type="button"
              aria-expanded={openDirs.has(e.path)}
              onClick={() => toggleDir(e.path)}
              style={{ paddingLeft: 8 + depth * 14 }}
              className="flex h-8 w-full items-center gap-1.5 rounded-full pr-2 text-left text-[13px] text-os-muted transition-colors hover:bg-os-surface-2 hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
            >
              {openDirs.has(e.path) ? <CaretDown size={12} aria-hidden /> : <CaretRight size={12} aria-hidden />}
              {openDirs.has(e.path) ? <FolderOpen size={16} aria-hidden /> : <Folder size={16} aria-hidden />}
              <span className="truncate">{e.name}</span>
            </button>
            {openDirs.has(e.path) && <ul>{renderDir(e.path, depth + 1)}</ul>}
          </>
        ) : (
          <button
            type="button"
            onClick={() => openFile(e.path)}
            aria-current={file === e.path ? 'true' : undefined}
            style={{ paddingLeft: 26 + depth * 14 }}
            className={cx(
              'flex h-8 w-full items-center gap-1.5 rounded-full pr-2 text-left text-[13px] transition-colors hover:bg-os-surface-2 focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]',
              file === e.path ? 'bg-os-surface-2 text-os-text' : 'text-os-muted hover:text-os-text',
            )}
          >
            <File size={15} aria-hidden />
            <span className="truncate">{e.name}</span>
          </button>
        )}
      </li>
    ));

  const dirty = loaded?.kind === 'text' && draft !== saved;

  return (
    <PageFrame
      title="Files"
      leading={
        <select aria-label="Project" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="h-8 max-w-[14rem] text-[13px]">
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      }
      actions={
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-os-muted">
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
          Follow the agent
        </label>
      }
    >
      {projects.length === 0 ? (
        <EmptyState title="No projects yet" action={<a href="#/projects"><Button variant="primary">Add a project</Button></a>}>
          Files shows the contents of folders you have registered as projects. Nothing outside them is reachable here.
        </EmptyState>
      ) : (
        <div className="grid h-full min-h-0 grid-cols-[300px_minmax(0,1fr)]">
          <nav aria-label="Project files" className="flex min-h-0 flex-col border-r border-os-line bg-os-surface">
            <form
              className="relative p-3"
              onSubmit={(e) => {
                e.preventDefault();
                void search();
              }}
            >
              <label htmlFor="file-search" className="sr-only">
                Search in files
              </label>
              <MagnifyingGlass size={15} className="pointer-events-none absolute left-6 top-[1.35rem] text-os-muted" aria-hidden />
              <input id="file-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search in files" className={cx(inputCls, 'h-9 pl-9')} />
            </form>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
              {hits ? (
                <div>
                  <button type="button" onClick={() => setHits(null)} className="mb-2 px-2 text-xs text-os-muted hover:text-os-text">
                    Back to the tree
                  </button>
                  {hits.length === 0 && <p className="px-2 text-sm text-os-muted">No matches.</p>}
                  <ul className="grid gap-1">
                    {hits.map((h, i) => (
                      <li key={`${h.path}:${h.line}:${i}`}>
                        <button type="button" onClick={() => openFile(h.path)} className="w-full rounded-[var(--os-radius)] px-2 py-1.5 text-left hover:bg-os-surface-2 focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]">
                          <span className="block truncate text-[13px] text-os-text">{h.path}:{h.line}</span>
                          <span className="block truncate font-os-mono text-xs text-os-muted">{h.text}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <ul>{renderDir('', 0)}</ul>
              )}
            </div>
          </nav>

          <section className="flex min-h-0 min-w-0 flex-col">
            {error && (
              <div className="p-4 pb-0">
                <ErrorNote>{error}</ErrorNote>
              </div>
            )}
            {!file || !loaded ? (
              <EmptyState title="Pick a file">Open one from the tree, or turn on Follow the agent to watch files open as they are edited.</EmptyState>
            ) : (
              <>
                <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-os-line px-4">
                  <p className="min-w-0 truncate font-os-mono text-[13px] text-os-text">
                    {file}
                    {dirty && <span className="ml-2 text-os-cyan">unsaved</span>}
                  </p>
                  <div className="flex shrink-0 items-center gap-2">
                    {notice && <span role="status" className="text-xs text-os-ok">{notice}</span>}
                    {file.endsWith('.md') && loaded.kind === 'text' && (
                      <Segmented<'edit' | 'preview'> label="View" value={view} onChange={setView} options={[{ id: 'edit', label: 'Edit' }, { id: 'preview', label: 'Preview' }]} />
                    )}
                    {loaded.kind === 'text' && !loaded.readOnly && (
                      <Button size="sm" variant="primary" disabled={!dirty} onClick={() => void save()}>
                        Save
                      </Button>
                    )}
                    {loaded.kind === 'text' && loaded.readOnly && <span className="text-xs text-os-muted">Read-only, secrets hidden</span>}
                  </div>
                </header>
                <div className="min-h-0 flex-1">
                  {loaded.kind === 'image' && (
                    <div className="grid h-full place-items-center overflow-auto p-6">
                      <img src={loaded.dataUrl} alt={file} className="max-h-full max-w-full object-contain" />
                    </div>
                  )}
                  {loaded.kind === 'pdf' && <iframe title={file} src={loaded.dataUrl} className="h-full w-full border-0" />}
                  {loaded.kind === 'binary' && <EmptyState title="Binary file">{Math.round(loaded.size / 1024)} kB. There is nothing to show as text.</EmptyState>}
                  {loaded.kind === 'text' && view === 'preview' && (
                    <div className="h-full overflow-y-auto p-6">
                      <Markdown text={draft} />
                    </div>
                  )}
                  {loaded.kind === 'text' && view === 'edit' &&
                    (monacoSlow ? (
                      <textarea aria-label="File contents" value={draft} readOnly={loaded.readOnly} onChange={(e) => setDraft(e.target.value)} spellCheck={false} className="h-full w-full resize-none bg-os-bg p-4 font-os-mono text-[13px] leading-relaxed text-os-text focus-visible:outline-none" />
                    ) : (
                      <Suspense fallback={<p className="p-4 text-sm text-os-muted">Loading the editor</p>}>
                        <Monaco
                          height="100%"
                          path={file}
                          language={langOf(file)}
                          value={draft}
                          theme={document.documentElement.dataset.theme === 'light' ? 'vs' : 'vs-dark'}
                          onChange={(v) => setDraft(v ?? '')}
                          onMount={() => {
                            monacoMounted.current = true;
                            setMonacoSlow(false);
                          }}
                          options={{ readOnly: loaded.readOnly, minimap: { enabled: false }, fontSize: 13, fontFamily: 'Geist Mono, Consolas, monospace', scrollBeyondLastLine: false, padding: { top: 12 } }}
                        />
                      </Suspense>
                    ))}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </PageFrame>
  );
}
