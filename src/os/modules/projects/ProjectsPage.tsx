import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { FolderOpen, FolderPlus, GitBranch, Network, Trash2, Waypoints } from 'lucide-react';
import type { ModuleProps } from '../registry';
import { PageFrame } from '../../shell/PageFrame';
import { agentsApi } from '../agents/api';
import { projectsApi, timeAgo, type Job, type ProjectInfo } from '../../lib/projectsApi';
import { Panel } from '../../ui';
import { cx } from '../../ui/cx';

const btn =
  'inline-flex h-8 items-center gap-2 rounded-[var(--os-radius)] border border-os-line bg-os-surface-2 px-3 text-sm text-os-text transition-colors ' +
  'hover:border-os-cyan focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-os-line';

const field =
  'h-8 rounded-[var(--os-radius)] border border-os-line bg-os-bg px-2 text-sm text-os-text placeholder:text-os-muted ' +
  'focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]';

function useProjects() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    projectsApi
      .list()
      .then((p) => {
        setProjects(p);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(refresh, [refresh]);
  return { projects, loading, error, refresh };
}

/** Polls a set of running jobs until each finishes. */
function useJobPolling(jobs: Job[], onUpdate: (job: Job) => void) {
  const cb = useRef(onUpdate);
  cb.current = onUpdate;
  const running = jobs.filter((j) => j.state === 'running').map((j) => j.id).join(',');
  useEffect(() => {
    if (!running) return;
    const ids = running.split(',');
    const t = window.setInterval(() => {
      ids.forEach((id) => projectsApi.job(id).then((j) => cb.current(j)).catch(() => {}));
    }, 1500);
    return () => window.clearInterval(t);
  }, [running]);
}

export default function ProjectsPage({ navigate }: ModuleProps) {
  const { projects, loading, error, refresh } = useProjects();
  const [notice, setNotice] = useState<string | null>(null);
  const [addPath, setAddPath] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showClone, setShowClone] = useState(false);
  const [cloneUrl, setCloneUrl] = useState('');
  const [cloneDest, setCloneDest] = useState('');
  const [cloneJob, setCloneJob] = useState<Job | null>(null);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [graphJobs, setGraphJobs] = useState<Record<string, Job>>({});
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const allJobs = useMemo(() => [...(cloneJob ? [cloneJob] : []), ...Object.values(graphJobs)], [cloneJob, graphJobs]);
  useJobPolling(allJobs, (job) => {
    if (job.kind === 'clone') {
      setCloneJob(job);
      if (job.state === 'done') {
        setShowClone(false);
        setCloneUrl('');
        setNotice('Repository cloned and added.');
        refresh();
      }
    } else if (job.projectId) {
      setGraphJobs((prev) => ({ ...prev, [job.projectId!]: job }));
      if (job.state === 'done') refresh();
    }
  });

  const pick = async (title: string): Promise<string | null> => {
    try {
      return await projectsApi.pickFolder(title);
    } catch (e) {
      setNotice((e as Error).message);
      return null;
    }
  };

  const addFolder = async (folder: string) => {
    setNotice(null);
    try {
      await projectsApi.add(folder);
      setAddPath('');
      setShowAdd(false);
      refresh();
    } catch (e) {
      setNotice((e as Error).message);
    }
  };

  const browseAndAdd = async () => {
    const chosen = await pick('Select a project folder');
    if (chosen) await addFolder(chosen);
  };

  const startClone = async (e: FormEvent) => {
    e.preventDefault();
    setCloneError(null);
    try {
      setCloneJob(await projectsApi.clone(cloneUrl.trim(), cloneDest.trim()));
    } catch (err) {
      setCloneError((err as Error).message);
    }
  };

  const graphify = async (p: ProjectInfo) => {
    setNotice(null);
    try {
      const job = await projectsApi.graphify(p.id);
      setGraphJobs((prev) => ({ ...prev, [p.id]: job }));
    } catch (e) {
      setNotice((e as Error).message);
    }
  };

  const openSession = async (p: ProjectInfo) => {
    try {
      const s = await agentsApi.create('claude', p.path, p.name);
      navigate('agents', 'claude', s.id);
    } catch (e) {
      setNotice((e as Error).message);
    }
  };

  const remove = async (p: ProjectInfo) => {
    setConfirmId(null);
    try {
      await projectsApi.remove(p.id);
      refresh();
    } catch (e) {
      setNotice((e as Error).message);
    }
  };

  const cloning = cloneJob?.state === 'running';

  return (
    <PageFrame
      title="Projects"
      actions={
        <>
          <button type="button" className={btn} onClick={() => { setShowAdd((v) => !v); setShowClone(false); }} aria-expanded={showAdd}>
            <FolderPlus size={15} strokeWidth={1.75} aria-hidden />
            Add folder
          </button>
          <button type="button" className={btn} onClick={() => { setShowClone((v) => !v); setShowAdd(false); }} aria-expanded={showClone}>
            <GitBranch size={15} strokeWidth={1.75} aria-hidden />
            Clone from GitHub
          </button>
        </>
      }
    >
      <div className="h-full overflow-y-auto p-4 md:p-6">
        <div className="mx-auto grid max-w-4xl gap-4">
          {notice && (
            <p role="status" className="rounded-[var(--os-radius)] border border-os-line bg-os-surface px-3 py-2 text-sm text-os-text">
              {notice}
            </p>
          )}

          {showAdd && (
            <Panel title="Add a folder">
              <form
                className="grid gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (addPath.trim()) void addFolder(addPath.trim());
                }}
              >
                <div className="grid gap-1">
                  <label htmlFor="add-path" className="text-xs text-os-muted">
                    Project folder
                  </label>
                  <div className="flex gap-2">
                    <input id="add-path" value={addPath} onChange={(e) => setAddPath(e.target.value)} placeholder="C:\\Users\\you\\projects\\my-app" spellCheck={false} className={cx(field, 'min-w-0 flex-1 font-os-mono text-xs')} />
                    <button type="button" className={btn} onClick={() => void browseAndAdd()}>
                      <FolderOpen size={15} strokeWidth={1.75} aria-hidden />
                      Browse
                    </button>
                  </div>
                </div>
                <div>
                  <button type="submit" className={btn} disabled={!addPath.trim()}>
                    Add project
                  </button>
                </div>
              </form>
            </Panel>
          )}

          {showClone && (
            <Panel title="Clone from GitHub">
              <form className="grid gap-3" onSubmit={startClone}>
                <div className="grid gap-1">
                  <label htmlFor="clone-url" className="text-xs text-os-muted">
                    Repository URL
                  </label>
                  <input id="clone-url" value={cloneUrl} onChange={(e) => setCloneUrl(e.target.value)} placeholder="https://github.com/owner/repo" spellCheck={false} className={cx(field, 'font-os-mono text-xs')} />
                </div>
                <div className="grid gap-1">
                  <label htmlFor="clone-dest" className="text-xs text-os-muted">
                    Clone into this folder
                  </label>
                  <div className="flex gap-2">
                    <input id="clone-dest" value={cloneDest} onChange={(e) => setCloneDest(e.target.value)} placeholder="C:\\Users\\you\\projects" spellCheck={false} className={cx(field, 'min-w-0 flex-1 font-os-mono text-xs')} />
                    <button
                      type="button"
                      className={btn}
                      onClick={async () => {
                        const chosen = await pick('Choose where to clone the repository');
                        if (chosen) setCloneDest(chosen);
                      }}
                    >
                      <FolderOpen size={15} strokeWidth={1.75} aria-hidden />
                      Browse
                    </button>
                  </div>
                  <p className="text-xs text-os-muted">The repository is cloned into a new folder inside this one.</p>
                </div>
                {cloneError && (
                  <p role="alert" className="text-sm text-os-danger">
                    {cloneError}
                  </p>
                )}
                {cloneJob?.state === 'error' && (
                  <p role="alert" className="whitespace-pre-wrap break-words text-sm text-os-danger">
                    {cloneJob.error}
                  </p>
                )}
                {cloning && (
                  <pre role="status" className="max-h-32 overflow-auto whitespace-pre-wrap break-words font-os-mono text-xs text-os-muted">
                    {cloneJob?.log.trim() || 'Cloning'}
                  </pre>
                )}
                <div>
                  <button type="submit" className={btn} disabled={cloning || !cloneUrl.trim() || !cloneDest.trim()}>
                    {cloning ? 'Cloning' : 'Clone and add'}
                  </button>
                </div>
              </form>
            </Panel>
          )}

          {loading && <p className="text-sm text-os-muted">Loading projects</p>}
          {error && (
            <p role="alert" className="text-sm text-os-danger">
              {error}
            </p>
          )}
          {!loading && !error && projects.length === 0 && (
            <Panel title="No projects yet">
              <p className="max-w-[60ch] text-sm leading-relaxed text-os-muted">
                Add a folder or clone a GitHub repository. Each project gets its own colour in the Brain, can be graphified into its own graph,
                and can be picked when you start an agent session.
              </p>
            </Panel>
          )}

          {projects.length > 0 && (
            <ul className="grid gap-2">
              {projects.map((p) => {
                const job = graphJobs[p.id];
                const building = job?.state === 'running';
                return (
                  <li key={p.id} className="rounded-[var(--os-radius)] border border-os-line bg-os-surface">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
                      <div className="min-w-0 flex-1 basis-56">
                        <p className="truncate text-[15px] font-medium text-os-text">{p.name}</p>
                        <p className="truncate font-os-mono text-xs text-os-muted" title={p.path}>
                          {p.path}
                        </p>
                        <p className="mt-0.5 text-xs text-os-muted">
                          {p.source === 'github' ? 'Cloned from GitHub' : 'Local folder'}
                          {' \u00b7 '}
                          {!p.exists ? <span className="text-os-danger">Folder missing</span> : p.hasGraph && p.graphUpdated ? `Graph built ${timeAgo(p.graphUpdated)}` : 'No graph yet'}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" className={btn} disabled={building || !p.exists} onClick={() => void graphify(p)}>
                          <Waypoints size={15} strokeWidth={1.75} aria-hidden />
                          {building ? 'Building graph' : p.hasGraph ? 'Rebuild graph' : 'Build graph'}
                        </button>
                        <button type="button" className={btn} disabled={!p.hasGraph} onClick={() => navigate('brain', p.id)}>
                          <Network size={15} strokeWidth={1.75} aria-hidden />
                          View graph
                        </button>
                        <button type="button" className={btn} disabled={!p.exists} onClick={() => void openSession(p)}>
                          New session
                        </button>
                        {confirmId === p.id ? (
                          <span className="flex items-center gap-1 text-xs">
                            <button type="button" onClick={() => void remove(p)} className="rounded-[var(--os-radius-sm)] px-2 py-1 text-os-danger hover:bg-os-surface-2 focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]">
                              Remove from list
                            </button>
                            <button type="button" onClick={() => setConfirmId(null)} className="rounded-[var(--os-radius-sm)] px-2 py-1 text-os-muted hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]">
                              Keep
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            aria-label={`Remove ${p.name} from the list`}
                            onClick={() => setConfirmId(p.id)}
                            className="rounded-[var(--os-radius)] p-2 text-os-muted hover:text-os-danger focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
                          >
                            <Trash2 size={15} strokeWidth={1.75} />
                          </button>
                        )}
                      </div>
                    </div>
                    {job?.state === 'error' && (
                      <p role="alert" className="whitespace-pre-wrap break-words border-t border-os-line px-3 py-2 text-xs text-os-danger">
                        {job.error}
                      </p>
                    )}
                    {building && (
                      <p role="status" className="border-t border-os-line px-3 py-2 text-xs text-os-muted">
                        Reading the project and building its graph. This takes a few seconds and uses no AI credits.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </PageFrame>
  );
}
