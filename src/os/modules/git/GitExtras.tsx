import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowSquareOut, GitMerge, Sparkle } from '@phosphor-icons/react';
import { Button, EmptyState, ErrorNote, Field, Panel, SuccessNote, inputCls, textareaCls } from '../../ui';
import { api } from '../../lib/api';
import { timeAgo } from '../../lib/projectsApi';

const x = (p: string, path: string) => `/api/git-x/${p}${path}`;

// ---- stash ---------------------------------------------------------------------------------------

interface Stash {
  ref: string;
  when: string;
  message: string;
}

export function StashPanel({ projectId, onChanged }: { projectId: string; onChanged: () => void }) {
  const [items, setItems] = useState<Stash[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ stashes: Stash[] }>(x(projectId, '/stash')).then((d) => setItems(d.stashes)).catch((e: Error) => setError(e.message));
  }, [projectId]);
  useEffect(load, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      load();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="grid gap-3">
      <form
        className="grid gap-2"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void act(async () => {
            await api(x(projectId, '/stash'), { method: 'POST', body: { message } });
            setMessage('');
          });
        }}
      >
        <Field label="Put the current changes aside" htmlFor="stash-msg" hint="Includes new files. Nothing is lost: it stays here until you apply or drop it.">
          <input id="stash-msg" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What is this work in progress?" className={inputCls} />
        </Field>
        <Button type="submit" size="sm" className="justify-self-start">Stash changes</Button>
      </form>
      {error && <ErrorNote>{error}</ErrorNote>}
      {items.length === 0 ? (
        <p className="text-sm text-os-muted">Nothing is stashed.</p>
      ) : (
        <ul className="grid gap-2">
          {items.map((s) => (
            <li key={s.ref} className="rounded-[var(--os-radius)] border border-os-line p-3">
              <p className="text-sm text-os-text">{s.message.replace(/^On [^:]+: /, '')}</p>
              <p className="text-xs text-os-muted">{s.when}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => act(() => api(x(projectId, `/stash/${encodeURIComponent(s.ref)}/pop`), { method: 'POST' }))}>Apply and remove</Button>
                <Button size="sm" variant="ghost" onClick={() => act(() => api(x(projectId, `/stash/${encodeURIComponent(s.ref)}/apply`), { method: 'POST' }))}>Apply, keep</Button>
                <Button size="sm" variant="ghost" onClick={() => window.confirm('Drop this stash for good?') && act(() => api(x(projectId, `/stash/${encodeURIComponent(s.ref)}/drop`), { method: 'POST' }))}>Drop</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---- merge and conflicts -----------------------------------------------------------------------

interface Conflicts {
  merging: boolean;
  files: Array<{ path: string; content: string }>;
}

export function MergeBox({ projectId, branches, current, onChanged }: { projectId: string; branches: string[]; current: string; onChanged: () => void }) {
  const [target, setTarget] = useState('');
  const [conf, setConf] = useState<Conflicts | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const loadConf = useCallback(() => {
    api<Conflicts>(x(projectId, '/conflicts')).then(setConf).catch(() => setConf(null));
  }, [projectId]);
  useEffect(loadConf, [loadConf]);

  const others = branches.filter((b) => b !== current);

  const merge = async () => {
    setMsg(null);
    try {
      const d = await api<{ conflicts: string[] }>(x(projectId, '/merge'), { method: 'POST', body: { branch: target } });
      if (d.conflicts.length) setMsg({ ok: false, text: `${d.conflicts.length} file${d.conflicts.length === 1 ? ' needs' : 's need'} your decision.` });
      else setMsg({ ok: true, text: `Merged ${target} into ${current}.` });
      loadConf();
      onChanged();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  const resolve = async (file: string, side: 'ours' | 'theirs') => {
    setMsg(null);
    try {
      await api(x(projectId, '/resolve'), { method: 'POST', body: { file, side } });
      loadConf();
      onChanged();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  const finish = async () => {
    try {
      await api(x(projectId, '/merge-continue'), { method: 'POST' });
      setMsg({ ok: true, text: 'Merge finished.' });
      loadConf();
      onChanged();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  const abort = async () => {
    if (!window.confirm('Abort the merge and go back to how things were?')) return;
    await api(x(projectId, '/merge-abort'), { method: 'POST' }).catch((e: Error) => setMsg({ ok: false, text: e.message }));
    loadConf();
    onChanged();
  };

  return (
    <div className="grid gap-3">
      {msg && (msg.ok ? <SuccessNote>{msg.text}</SuccessNote> : <ErrorNote>{msg.text}</ErrorNote>)}
      {conf?.merging ? (
        <Panel title="A merge is waiting for you">
          <div className="grid gap-3">
            <p className="text-sm text-os-muted">For each file, keep your version ({current}) or the incoming one. Open a file to read both sides marked in the text.</p>
            {conf.files.length === 0 ? (
              <p className="text-sm text-os-text">Every conflict is resolved. Finish the merge to commit it.</p>
            ) : (
              <ul className="grid gap-2">
                {conf.files.map((f) => (
                  <li key={f.path} className="rounded-[var(--os-radius)] border border-os-line p-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1 truncate font-os-mono text-xs text-os-text">{f.path}</span>
                      <Button size="sm" variant="ghost" onClick={() => setOpen(open === f.path ? null : f.path)}>{open === f.path ? 'Hide' : 'Read'}</Button>
                      <Button size="sm" onClick={() => resolve(f.path, 'ours')}>Keep mine</Button>
                      <Button size="sm" onClick={() => resolve(f.path, 'theirs')}>Take theirs</Button>
                    </div>
                    {open === f.path && <pre className="mt-2 max-h-64 overflow-auto rounded-[var(--os-radius)] bg-os-bg p-2 font-os-mono text-xs leading-relaxed text-os-text">{f.content}</pre>}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Button variant="primary" size="sm" disabled={conf.files.length > 0} onClick={finish}>Finish the merge</Button>
              <Button size="sm" variant="ghost" onClick={abort}>Abort</Button>
            </div>
          </div>
        </Panel>
      ) : (
        <div className="grid gap-2">
          <Field label={`Merge into ${current}`} htmlFor="merge-from" hint="Needs a clean working tree. If both sides changed the same lines you will be asked to choose.">
            <select id="merge-from" value={target} onChange={(e) => setTarget(e.target.value)} className="w-full">
              <option value="">Choose a branch</option>
              {others.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </Field>
          <Button size="sm" className="justify-self-start" disabled={!target} onClick={merge}>
            <GitMerge size={15} aria-hidden /> Merge
          </Button>
        </div>
      )}
    </div>
  );
}

// ---- commit message ----------------------------------------------------------------------------

export function SuggestMessage({ projectId, disabled, onMessage }: { projectId: string; disabled: boolean; onMessage: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      const d = await api<{ message: string }>(x(projectId, '/suggest-message'), { method: 'POST' });
      onMessage(d.message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-1">
      <Button type="button" size="sm" className="justify-self-start" disabled={disabled || busy} onClick={go}>
        <Sparkle size={15} aria-hidden /> {busy ? 'Reading the diff' : 'Write the message with Claude'}
      </Button>
      {error && <p role="alert" className="text-xs text-os-danger">{error}</p>}
    </div>
  );
}

export function CherryPick({ projectId, hash, onDone }: { projectId: string; hash: string; onDone: (msg: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm('Apply this commit on top of the current branch?')) return;
        setBusy(true);
        try {
          await api(x(projectId, '/cherry-pick'), { method: 'POST', body: { hash } });
          onDone('Cherry-picked onto the current branch.');
        } catch (e) {
          onDone((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      Cherry-pick this commit
    </Button>
  );
}

// ---- pull requests -----------------------------------------------------------------------------

interface Pr {
  number: number;
  title: string;
  author: { login: string };
  headRefName: string;
  baseRefName: string;
  url: string;
  isDraft: boolean;
  reviewDecision: string;
  updatedAt: string;
}
interface PrDetail {
  number: number;
  title: string;
  body: string;
  url: string;
  additions: number;
  deletions: number;
  files: Array<{ path: string; additions: number; deletions: number }>;
  reviews: Array<{ author: { login: string }; state: string; body: string; submittedAt: string }>;
  comments: Array<{ author: { login: string }; body: string; createdAt: string }>;
  statusCheckRollup: Array<{ name?: string; context?: string; conclusion?: string; state?: string }>;
}

const DECISION: Record<string, string> = { APPROVED: 'Approved', CHANGES_REQUESTED: 'Changes requested', REVIEW_REQUIRED: 'Review required', '': 'No review yet' };

export function PullRequests({ projectId, branch, hasUpstream }: { projectId: string; branch: string; hasUpstream: boolean }) {
  const [prs, setPrs] = useState<Pr[] | null>(null);
  const [detail, setDetail] = useState<PrDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ title: string; body: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ prs: Pr[] }>(x(projectId, '/prs'))
      .then((d) => {
        setPrs(d.prs);
        setError(null);
      })
      .catch((e: Error) => {
        setPrs([]);
        setError(e.message);
      });
  }, [projectId]);
  useEffect(load, [load]);

  const open = async (n: number) => {
    setError(null);
    try {
      const d = await api<{ pr: PrDetail }>(x(projectId, `/prs/${n}`));
      setDetail(d.pr);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setError(null);
    try {
      const d = await api<{ url: string }>(x(projectId, '/prs'), { method: 'POST', body: form });
      setNotice(`Opened ${d.url}`);
      setForm(null);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-os-muted">Open pull requests on GitHub, through the GitHub CLI.</p>
        <Button size="sm" variant="primary" onClick={() => setForm({ title: '', body: '' })}>Open one for {branch}</Button>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      {notice && <SuccessNote>{notice}</SuccessNote>}
      {form && (
        <Panel title={`New pull request from ${branch}`}>
          <form onSubmit={create} className="grid gap-3">
            {!hasUpstream && <p className="text-sm text-os-amber">This branch is not pushed yet. Push it first, then open the pull request.</p>}
            <Field label="Title" htmlFor="pr-title">
              <input id="pr-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Description" htmlFor="pr-body">
              <textarea id="pr-body" rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className={textareaCls} />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" variant="primary" size="sm" disabled={!form.title.trim() || !hasUpstream}>Create pull request</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
            </div>
          </form>
        </Panel>
      )}
      {prs && prs.length === 0 && !error && <EmptyState title="No open pull requests">Push a branch and open one to see it here.</EmptyState>}
      <ul className="grid gap-2">
        {prs?.map((p) => (
          <li key={p.number}>
            <button type="button" onClick={() => open(p.number)} className="w-full rounded-[var(--os-radius)] border border-os-line p-3 text-left hover:border-os-muted focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]">
              <span className="block text-sm font-medium text-os-text">#{p.number} {p.title}{p.isDraft ? ' (draft)' : ''}</span>
              <span className="block text-xs text-os-muted">{p.author?.login}, {p.headRefName} into {p.baseRefName}, {DECISION[p.reviewDecision] ?? p.reviewDecision}, {timeAgo(Date.parse(p.updatedAt))}</span>
            </button>
          </li>
        ))}
      </ul>
      {detail && (
        <Panel title={`#${detail.number} ${detail.title}`} header={<a href={detail.url} target="_blank" rel="noreferrer" className="text-xs text-os-muted hover:text-os-text"><ArrowSquareOut size={14} aria-hidden className="inline" /> GitHub</a>}>
          <div className="grid gap-3 text-sm">
            <p className="text-os-muted">{detail.files.length} files, +{detail.additions} -{detail.deletions}</p>
            {detail.body && <p className="whitespace-pre-wrap text-os-text">{detail.body.slice(0, 1500)}</p>}
            {detail.statusCheckRollup.length > 0 && (
              <ul className="text-xs text-os-muted">
                {detail.statusCheckRollup.map((c, i) => (
                  <li key={i}>{c.name ?? c.context}: {c.conclusion ?? c.state ?? 'pending'}</li>
                ))}
              </ul>
            )}
            <h3 className="text-[13px] font-semibold text-os-text">Reviews</h3>
            {detail.reviews.length === 0 ? <p className="text-os-muted">No reviews yet.</p> : (
              <ul className="grid gap-2">
                {detail.reviews.map((r, i) => (
                  <li key={i} className="rounded-[var(--os-radius)] bg-os-surface-2 p-2.5">
                    <span className="text-xs font-medium text-os-text">{r.author?.login}, {r.state.toLowerCase().replace('_', ' ')}</span>
                    {r.body && <p className="mt-1 whitespace-pre-wrap text-os-text">{r.body.slice(0, 800)}</p>}
                  </li>
                ))}
              </ul>
            )}
            {detail.comments.length > 0 && (
              <>
                <h3 className="text-[13px] font-semibold text-os-text">Comments</h3>
                <ul className="grid gap-2">
                  {detail.comments.slice(-6).map((c, i) => (
                    <li key={i} className="rounded-[var(--os-radius)] bg-os-surface-2 p-2.5">
                      <span className="text-xs font-medium text-os-text">{c.author?.login}</span>
                      <p className="mt-1 whitespace-pre-wrap text-os-text">{c.body.slice(0, 600)}</p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}
