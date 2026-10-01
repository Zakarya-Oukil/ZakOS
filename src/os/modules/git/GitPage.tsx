import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLineDown, ArrowLineUp, ArrowUUpLeft, ArrowsClockwise, Check, GitBranch, Minus, Plus } from '@phosphor-icons/react';
import type { ModuleProps } from '../registry';
import { PageFrame } from '../../shell/PageFrame';
import { Panel, Tabs } from '../../ui';
import { cx } from '../../ui/cx';
import { projectsApi, timeAgo, type ProjectInfo } from '../../lib/projectsApi';
import { DiffView } from '../agents/Changes';
import { CherryPick, MergeBox, PullRequests, StashPanel, SuggestMessage } from './GitExtras';
import { gitApi, STATE_TONE, STATE_WORD, type Branch, type Commit, type DiffResult, type GitFile, type GitStatus } from './api';

const btn =
  'inline-flex h-9 items-center gap-2 rounded-full border border-os-line bg-os-surface-2 px-4 text-sm text-os-text transition-colors ' +
  'hover:border-os-cyan focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50';
const tiny =
  'rounded-[var(--os-radius-sm)] p-1 text-os-muted hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] disabled:opacity-40';
const field =
  'rounded-[var(--os-input-radius)] border border-os-line bg-os-bg px-3 text-sm text-os-text placeholder:text-os-muted focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]';

type Tab = 'changes' | 'history' | 'branches' | 'stash' | 'prs';
const TABS = [
  { id: 'changes', label: 'Changes' },
  { id: 'history', label: 'History' },
  { id: 'branches', label: 'Branches' },
  { id: 'stash', label: 'Stash' },
  { id: 'prs', label: 'Pull requests' },
];

const stagedOf = (f: GitFile) => f.index !== ' ' && f.index !== '?';
const unstagedOf = (f: GitFile) => f.worktree !== ' ' || f.index === '?';

function FileRow({ f, staged, selected, busy, onSelect, onToggle, onDiscard }: { f: GitFile; staged: boolean; selected: boolean; busy: boolean; onSelect: () => void; onToggle: () => void; onDiscard?: () => void }) {
  const state = staged ? f.index : f.index === '?' ? '?' : f.worktree;
  const [confirm, setConfirm] = useState(false);
  return (
    <li className={cx('group flex items-center gap-1.5 px-2 py-1', selected && 'bg-os-surface-2')}>
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]">
        <span className={cx('w-3 shrink-0 text-center font-os-mono text-xs', STATE_TONE[state])} title={STATE_WORD[state]} aria-label={STATE_WORD[state]}>
          {state === '?' ? 'N' : state}
        </span>
        <span className="truncate font-os-mono text-xs text-os-text" title={f.path}>{f.path}</span>
      </button>
      {confirm ? (
        <span className="flex shrink-0 items-center gap-1 text-xs">
          <button type="button" className={cx(tiny, 'text-os-danger')} onClick={() => { setConfirm(false); onDiscard?.(); }}>
            {f.index === '?' ? 'Delete file' : 'Discard'}
          </button>
          <button type="button" className={tiny} onClick={() => setConfirm(false)}>Keep</button>
        </span>
      ) : (
        <>
          {!staged && onDiscard && (
            <button type="button" className={cx(tiny, 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100')} disabled={busy} aria-label={`Discard changes to ${f.path}`} title="Discard changes" onClick={() => setConfirm(true)}>
              <ArrowUUpLeft size={13} aria-hidden />
            </button>
          )}
          <button type="button" className={tiny} disabled={busy} aria-label={`${staged ? 'Unstage' : 'Stage'} ${f.path}`} title={staged ? 'Unstage' : 'Stage'} onClick={onToggle}>
            {staged ? <Minus size={13} aria-hidden /> : <Plus size={13} aria-hidden />}
          </button>
        </>
      )}
      {confirm && f.index === '?' && <span className="sr-only">This permanently deletes the file.</span>}
    </li>
  );
}

function BranchChip({ s }: { s: GitStatus }) {
  return (
    <span className="flex items-center gap-2 text-sm text-os-text">
      <GitBranch size={14} aria-hidden className="text-os-cyan" />
      <span className="font-os-mono">{s.detached ? 'detached HEAD' : s.branch}</span>
      {(s.ahead > 0 || s.behind > 0) && (
        <span className="text-xs text-os-muted">
          {s.ahead > 0 && `${s.ahead} ahead`}
          {s.ahead > 0 && s.behind > 0 && ', '}
          {s.behind > 0 && `${s.behind} behind`}
        </span>
      )}
      {!s.upstream && !s.detached && <span className="text-xs text-os-muted">not pushed yet</span>}
    </span>
  );
}

export default function GitPage({ route, navigate }: ModuleProps) {
  const [projects, setProjects] = useState<ProjectInfo[] | null>(null);
  const projectId = route[0] ?? projects?.[0]?.id;
  const [tab, setTab] = useState<Tab>('changes');
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<{ path: string; staged: boolean } | null>(null);
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [message, setMessage] = useState('');
  const [commits, setCommits] = useState<Commit[]>([]);
  const [commitDiff, setCommitDiff] = useState<{ hash: string; diff: string; truncated: boolean } | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [newBranch, setNewBranch] = useState('');
  const [confirmPush, setConfirmPush] = useState(false);

  useEffect(() => {
    projectsApi.list().then((l) => setProjects(l.filter((p) => p.exists))).catch(() => setProjects([]));
  }, []);

  const refresh = useCallback(() => {
    if (!projectId) return;
    gitApi
      .status(projectId)
      .then((s) => {
        setStatus(s);
        setError(null);
      })
      .catch((e: Error) => {
        setStatus(null);
        setError(e.message);
      });
  }, [projectId]);

  // A different project starts clean; the same one refreshes on an interval and when the window regains focus.
  useEffect(() => {
    setStatus(null);
    setSelected(null);
    setDiff(null);
    setCommitDiff(null);
    setNotice(null);
    setConfirmPush(false);
    refresh();
    const t = setInterval(refresh, 10_000);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);

  useEffect(() => {
    if (!projectId || error) return;
    if (tab === 'history') gitApi.log(projectId).then(setCommits).catch((e: Error) => setNotice(e.message));
    if (tab === 'branches') gitApi.branches(projectId).then(setBranches).catch((e: Error) => setNotice(e.message));
  }, [tab, projectId, error, status?.branch]);

  useEffect(() => {
    if (!projectId || !selected) return setDiff(null);
    setDiff(null);
    gitApi.diff(projectId, selected.path, selected.staged).then(setDiff).catch(() => setSelected(null));
  }, [projectId, selected, status]);

  /** Runs a mutating call, refreshes, and reports failures where the owner is looking. */
  const act = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await fn();
      if (done) setNotice(done);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const staged = useMemo(() => status?.files.filter(stagedOf) ?? [], [status]);
  const unstaged = useMemo(() => status?.files.filter(unstagedOf) ?? [], [status]);
  const project = projects?.find((p) => p.id === projectId);

  const commit = () =>
    act(async () => {
      await gitApi.commit(projectId!, message);
      setMessage('');
      setSelected(null);
    }, 'Committed.');

  return (
    <PageFrame
      title="Git"
      leading={<Tabs aria-label="Git view" tabs={TABS} value={tab} onChange={(id) => setTab(id as Tab)} />}
      actions={
        projects && projects.length > 0 ? (
          <>
            <label htmlFor="git-project" className="sr-only">Project</label>
            <select id="git-project" value={projectId} onChange={(e) => navigate('git', e.target.value)} className={cx(field, 'h-8 max-w-[14rem]')}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button type="button" className={cx(btn, 'w-8 justify-center px-0')} aria-label="Refresh" onClick={refresh}>
              <ArrowsClockwise size={14} aria-hidden />
            </button>
          </>
        ) : undefined
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        {projects && projects.length === 0 && (
          <p className="p-6 text-sm text-os-muted">No projects yet. Add a folder on the Projects page and its git status shows up here.</p>
        )}
        {!projects && <p className="p-6 text-sm text-os-muted">Loading</p>}
        {error && (
          <p className="p-6 text-sm text-os-muted" role="status">
            {error}
          </p>
        )}

        {status && projectId && (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b border-os-line px-4 py-2">
              <BranchChip s={status} />
              <span className="ml-auto flex items-center gap-2">
                <button type="button" className={btn} disabled={busy || !status.upstream} title={status.upstream ? 'Fast-forward only' : 'No upstream to pull from'} onClick={() => void act(() => gitApi.pull(projectId), 'Pulled.')}>
                  <ArrowLineDown size={14} aria-hidden /> Pull
                </button>
                {confirmPush ? (
                  <span className="flex items-center gap-2 text-sm">
                    <span className="text-os-amber">Push {status.branch} to {status.upstream ?? 'origin'}?</span>
                    <button type="button" className={btn} disabled={busy} onClick={() => { setConfirmPush(false); void act(() => gitApi.push(projectId), 'Pushed.'); }}>Push</button>
                    <button type="button" className={btn} onClick={() => setConfirmPush(false)}>Cancel</button>
                  </span>
                ) : (
                  <button type="button" className={btn} disabled={busy || status.detached} onClick={() => setConfirmPush(true)}>
                    <ArrowLineUp size={14} aria-hidden /> Push
                  </button>
                )}
              </span>
            </div>
            {notice && <p role="status" className="border-b border-os-line px-4 py-1.5 text-xs text-os-amber">{notice}</p>}

            <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]">
              {/* left column */}
              <div className="min-h-0 overflow-y-auto border-r border-os-line p-3">
                {tab === 'changes' && (
                  <div className="grid gap-3">
                    <Panel
                      title={`Staged (${staged.length})`}
                      padded={false}
                      header={staged.length > 0 ? <button type="button" className={tiny} disabled={busy} onClick={() => void act(() => gitApi.unstageAll(projectId))}>Unstage all</button> : undefined}
                    >
                      {staged.length === 0 ? (
                        <p className="p-3 text-xs text-os-muted">Nothing staged. Stage files to include them in the next commit.</p>
                      ) : (
                        <ul>
                          {staged.map((f) => (
                            <FileRow key={f.path} f={f} staged selected={selected?.path === f.path && selected.staged} busy={busy} onSelect={() => setSelected({ path: f.path, staged: true })} onToggle={() => void act(() => gitApi.unstage(projectId, [f.path]))} />
                          ))}
                        </ul>
                      )}
                    </Panel>
                    <Panel
                      title={`Changes (${unstaged.length})`}
                      padded={false}
                      header={unstaged.length > 0 ? <button type="button" className={tiny} disabled={busy} onClick={() => void act(() => gitApi.stageAll(projectId))}>Stage all</button> : undefined}
                    >
                      {unstaged.length === 0 ? (
                        <p className="p-3 text-xs text-os-muted">{staged.length === 0 ? 'The working tree is clean.' : 'Everything is staged.'}</p>
                      ) : (
                        <ul>
                          {unstaged.map((f) => (
                            <FileRow key={f.path} f={f} staged={false} selected={selected?.path === f.path && !selected.staged} busy={busy} onSelect={() => setSelected({ path: f.path, staged: false })} onToggle={() => void act(() => gitApi.stage(projectId, [f.path]))} onDiscard={() => void act(() => gitApi.discard(projectId, f.path))} />
                          ))}
                        </ul>
                      )}
                    </Panel>
                    <form
                      className="grid gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (message.trim() && staged.length > 0) void commit();
                      }}
                    >
                      <label htmlFor="commit-msg" className="text-xs text-os-muted">Commit message</label>
                      <SuggestMessage projectId={projectId} disabled={staged.length === 0} onMessage={setMessage} />
                      <textarea
                        id="commit-msg"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && message.trim() && staged.length > 0) {
                            e.preventDefault();
                            void commit();
                          }
                        }}
                        rows={3}
                        placeholder="Describe the change"
                        className={cx(field, 'w-full resize-y py-1.5')}
                      />
                      <button type="submit" className={btn} disabled={busy || !message.trim() || staged.length === 0}>
                        <Check size={14} aria-hidden /> Commit {staged.length > 0 ? `${staged.length} file${staged.length > 1 ? 's' : ''}` : ''}
                      </button>
                      <p className="text-xs text-os-muted">Ctrl+Enter also commits. Nothing is pushed until you press Push.</p>
                    </form>
                  </div>
                )}

                {tab === 'history' && (
                  <ul className="grid gap-0.5">
                    {commits.length === 0 && <li className="text-sm text-os-muted">No commits yet.</li>}
                    {commits.map((c) => (
                      <li key={c.hash}>
                        <button
                          type="button"
                          aria-current={commitDiff?.hash === c.hash ? 'true' : undefined}
                          onClick={() => void gitApi.commitDiff(projectId, c.hash).then((d) => setCommitDiff({ hash: c.hash, ...d })).catch((e: Error) => setNotice(e.message))}
                          className={cx('w-full rounded-[var(--os-radius)] px-2 py-1.5 text-left hover:bg-os-surface-2 focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]', commitDiff?.hash === c.hash && 'bg-os-surface-2')}
                        >
                          <span className="block truncate text-sm text-os-text">{c.subject}</span>
                          <span className="block text-xs text-os-muted">
                            <span className="font-os-mono">{c.short}</span> · {c.author} · {timeAgo(c.ts)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {tab === 'stash' && <StashPanel projectId={projectId} onChanged={refresh} />}
                {tab === 'prs' && <PullRequests projectId={projectId} branch={status.branch} hasUpstream={!!status.upstream} />}

                {tab === 'branches' && (
                  <div className="grid gap-3">
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!newBranch.trim()) return;
                        void act(async () => {
                          await gitApi.createBranch(projectId, newBranch.trim());
                          setNewBranch('');
                        }, `Created and switched to ${newBranch.trim()}.`);
                      }}
                    >
                      <label htmlFor="new-branch" className="sr-only">New branch name</label>
                      <input id="new-branch" value={newBranch} onChange={(e) => setNewBranch(e.target.value)} placeholder="feature/new-idea" className={cx(field, 'h-8 min-w-0 flex-1 font-os-mono')} />
                      <button type="submit" className={btn} disabled={busy || !newBranch.trim()}>New branch</button>
                    </form>
                    <ul className="grid gap-0.5">
                      {branches.map((b) => (
                        <li key={b.name} className="flex items-center gap-2 rounded-[var(--os-radius)] px-2 py-1.5">
                          <GitBranch size={13} aria-hidden className={b.current ? 'text-os-cyan' : 'text-os-muted'} />
                          <span className="min-w-0 flex-1 truncate font-os-mono text-xs text-os-text">{b.name}</span>
                          {b.upstream && <span className="truncate text-xs text-os-muted">{b.upstream}</span>}
                          {b.current ? (
                            <span className="text-xs text-os-cyan">current</span>
                          ) : (
                            <button type="button" className={cx(tiny, 'text-xs')} disabled={busy} onClick={() => void act(() => gitApi.checkout(projectId, b.name), `Switched to ${b.name}.`)}>
                              Switch
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-os-muted">Switching is refused by git when it would overwrite uncommitted work.</p>
                    <MergeBox projectId={projectId} branches={branches.map((b) => b.name)} current={status.branch} onChanged={refresh} />
                  </div>
                )}
              </div>

              {/* right column */}
              <div className="hidden min-h-0 min-w-0 overflow-y-auto lg:block">
                {tab === 'changes' && !selected && <p className="p-6 text-sm text-os-muted">Select a file to see what changed in {project?.name ?? 'it'}.</p>}
                {tab === 'changes' && selected && (
                  <div>
                    <p className="border-b border-os-line px-4 py-2 font-os-mono text-xs text-os-text">{selected.path} <span className="text-os-muted">({selected.staged ? 'staged' : 'unstaged'})</span></p>
                    {!diff ? (
                      <p className="p-4 text-xs text-os-muted">Loading</p>
                    ) : diff.binary ? (
                      <p className="p-4 text-xs text-os-muted">Binary file, no text diff.</p>
                    ) : diff.truncated && !diff.diff ? (
                      <p className="p-4 text-xs text-os-muted">File is too large to preview.</p>
                    ) : (
                      <DiffView text={diff.diff} />
                    )}
                  </div>
                )}
                {tab === 'history' && !commitDiff && <p className="p-6 text-sm text-os-muted">Select a commit to read it.</p>}
                {tab === 'history' && commitDiff && (
                  <div>
                    <div className="flex items-center justify-between gap-2 border-b border-os-line px-4 py-2">
                      <span className="font-os-mono text-xs text-os-muted">{commitDiff.hash.slice(0, 7)}</span>
                      <CherryPick projectId={projectId} hash={commitDiff.hash} onDone={(m) => { setNotice(m); refresh(); }} />
                    </div>
                    <DiffView text={commitDiff.diff} maxHeight="max-h-[70vh]" />
                  </div>
                )}
                {(tab === 'branches' || tab === 'stash' || tab === 'prs') && <p className="p-6 text-sm text-os-muted">{tab === 'branches' ? 'Pick a branch to work on. Commits made here stay on the branch until you merge them.' : tab === 'stash' ? 'A stash holds work in progress so you can switch tasks without committing.' : 'Pull requests are read and opened through the GitHub CLI you are signed in with.'}</p>}
              </div>
            </div>
          </>
        )}
      </div>
    </PageFrame>
  );
}
