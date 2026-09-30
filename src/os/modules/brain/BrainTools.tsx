import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { IconButton, Markdown, Tabs } from '../../ui';
import { cx } from '../../ui/cx';
import { timeAgo } from '../../lib/projectsApi';
import { brainApi, type Answer, type GraphDiff, type SearchHit, type Snapshot } from './api';

type ToolTab = 'search' | 'ask' | 'changes' | 'memory';

const btn =
  'inline-flex h-8 items-center gap-2 rounded-[var(--os-radius)] border border-os-line bg-os-surface-2 px-3 text-sm text-os-text transition-colors ' +
  'hover:border-os-cyan focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50';
const field =
  'rounded-[var(--os-radius)] border border-os-line bg-os-bg px-2 text-sm text-os-text placeholder:text-os-muted focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]';

interface Props {
  projectId?: string;
  onOpenNote: (relativePath: string, id: string) => void;
  onClose: () => void;
}

function SearchTab({ onOpenNote }: Pick<Props, 'onOpenNote'>) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!q.trim()) return setHits(null);
    let stale = false;
    const t = setTimeout(() => {
      brainApi
        .search(q.trim())
        .then((h) => !stale && (setHits(h), setError(null)))
        .catch((e: Error) => !stale && setError(e.message));
    }, 200);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div className="grid gap-3">
      <label htmlFor="bt-search" className="sr-only">Search notes</label>
      <input id="bt-search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search every note" className={cx(field, 'h-9')} />
      {error && <p className="text-xs text-os-danger" role="alert">{error}</p>}
      {hits && hits.length === 0 && <p className="text-sm text-os-muted">No notes match those words. Search matches words in titles, tags, headings and text, not meaning.</p>}
      {!hits && !error && <p className="text-xs text-os-muted">Ranked by how well the words match. Titles, tags and headings count for more than body text.</p>}
      <ul className="grid gap-1">
        {hits?.map((h) => (
          <li key={h.id}>
            <button type="button" onClick={() => onOpenNote(h.relativePath, h.id)} className="w-full rounded-[var(--os-radius)] px-2.5 py-2 text-left hover:bg-os-surface-2 focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]">
              <span className="block truncate text-sm text-os-text">{h.title}</span>
              <span className="block truncate text-xs text-os-muted">{h.relativePath}</span>
              <span className="mt-0.5 line-clamp-2 block text-xs text-os-muted">{h.snippet}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AskTab({ onOpenNote }: Pick<Props, 'onOpenNote'>) {
  const [question, setQuestion] = useState('');
  const [agent, setAgent] = useState('claude');
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ask = async () => {
    if (!question.trim() || busy) return;
    setBusy(true);
    setError(null);
    setAnswer(null);
    try {
      setAnswer(await brainApi.ask(question.trim(), agent));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-3">
      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
      >
        <label htmlFor="bt-ask" className="sr-only">Question</label>
        <textarea
          id="bt-ask"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void ask();
          }}
          rows={3}
          placeholder="Ask your notes a question"
          className={cx(field, 'resize-y py-2 leading-relaxed')}
        />
        <div className="flex items-center gap-2">
          <label htmlFor="bt-agent" className="sr-only">Agent</label>
          <select id="bt-agent" value={agent} onChange={(e) => setAgent(e.target.value)} className={cx(field, 'h-8')}>
            <option value="claude">Claude</option>
            <option value="hermes">Hermes</option>
          </select>
          <button type="submit" className={cx(btn, 'ml-auto')} disabled={busy || !question.trim()}>
            {busy ? 'Reading notes' : 'Ask'}
          </button>
        </div>
        <p className="text-xs text-os-muted">The best matching notes go to a read-only agent run, which answers only from them. It cannot change anything.</p>
      </form>
      {busy && <p role="status" className="text-sm text-os-muted">Finding notes and writing an answer. This takes around ten seconds.</p>}
      {error && <p className="text-sm text-os-danger" role="alert">{error}</p>}
      {answer && (
        <div className="grid gap-3">
          <Markdown text={answer.answer} className="text-sm" />
          {answer.sources.length > 0 && (
            <div>
              <h3 className="mb-1 text-xs text-os-muted">Notes used</h3>
              <ul className="grid gap-0.5">
                {answer.sources.map((s) => (
                  <li key={s.id}>
                    <button type="button" onClick={() => onOpenNote(s.relativePath, s.id)} className="w-full truncate rounded-[var(--os-radius-sm)] px-2 py-1 text-left text-sm text-os-text hover:bg-os-surface-2 focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]">
                      {s.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChangesTab({ projectId }: { projectId?: string }) {
  const [snaps, setSnaps] = useState<Snapshot[] | null>(null);
  const [from, setFrom] = useState('');
  const [diff, setDiff] = useState<GraphDiff | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSnaps(null);
    setDiff(null);
    if (!projectId) return;
    brainApi
      .snapshots(projectId)
      .then((s) => {
        setSnaps(s);
        setFrom(s.find((x) => x.id !== 'current')?.id ?? '');
      })
      .catch((e: Error) => setError(e.message));
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !from) return setDiff(null);
    setError(null);
    brainApi.diff(projectId, from).then(setDiff).catch((e: Error) => setError(e.message));
  }, [projectId, from]);

  if (!projectId) return <p className="text-sm text-os-muted">Open one project's graph to see how its code changed over time. This view compares a project's graph now with an earlier version.</p>;
  const older = snaps?.filter((s) => s.id !== 'current') ?? [];
  return (
    <div className="grid gap-3">
      {error && <p className="text-xs text-os-danger" role="alert">{error}</p>}
      {snaps && older.length === 0 && <p className="text-sm text-os-muted">No earlier version yet. A copy is saved each time the graph is rebuilt from the Projects page, so come back after the next rebuild.</p>}
      {older.length > 0 && (
        <>
          <label htmlFor="bt-from" className="text-xs text-os-muted">Compare now with</label>
          <select id="bt-from" value={from} onChange={(e) => setFrom(e.target.value)} className={cx(field, 'h-8')}>
            {older.map((s) => (
              <option key={s.id} value={s.id}>{s.label} ({timeAgo(s.ts)}, {s.nodes} symbols)</option>
            ))}
          </select>
        </>
      )}
      {diff && (
        <div className="grid gap-3 text-sm">
          <p className="text-os-text">
            {diff.addedCount} symbols added, {diff.removedCount} removed. Links: {diff.edgesAdded} new, {diff.edgesRemoved} gone.
          </p>
          {diff.hotFiles.length > 0 && (
            <div>
              <h3 className="mb-1 text-xs text-os-muted">Most changed files</h3>
              <ul className="grid gap-0.5">
                {diff.hotFiles.map((f) => (
                  <li key={f.file} className="flex items-baseline gap-2 text-xs">
                    <span className="min-w-0 flex-1 truncate font-os-mono text-os-text" title={f.file}>{f.file}</span>
                    <span className="shrink-0 text-os-cyan">+{f.added}</span>
                    <span className="shrink-0 text-os-danger">-{f.removed}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {diff.added.length > 0 && (
            <details>
              <summary className="cursor-pointer text-xs text-os-muted">New symbols ({diff.addedCount})</summary>
              <ul className="mt-1 grid gap-0.5 text-xs">
                {diff.added.slice(0, 60).map((n, i) => (
                  <li key={i} className="truncate text-os-text" title={n.file}>{n.label}</li>
                ))}
              </ul>
            </details>
          )}
          {diff.removed.length > 0 && (
            <details>
              <summary className="cursor-pointer text-xs text-os-muted">Removed symbols ({diff.removedCount})</summary>
              <ul className="mt-1 grid gap-0.5 text-xs">
                {diff.removed.slice(0, 60).map((n, i) => (
                  <li key={i} className="truncate text-os-text" title={n.file}>{n.label}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function MemoryTab() {
  const [on, setOn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    brainApi.settings().then((s) => setOn(s.autoCapture)).catch((e: Error) => setError(e.message));
  }, []);
  return (
    <div className="grid gap-3 text-sm">
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(on)}
          aria-label="Capture agent sessions into the vault"
          disabled={on === null}
          onClick={() => void brainApi.setAutoCapture(!on).then((s) => setOn(s.autoCapture)).catch((e: Error) => setError(e.message))}
          className={cx('relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]', on ? 'border-os-cyan bg-os-cyan' : 'border-os-line bg-os-surface-2')}
        >
          <span className={cx('absolute top-0.5 h-3.5 w-3.5 rounded-full transition-[left]', on ? 'left-[18px] bg-os-bg' : 'left-0.5 bg-os-muted')} />
        </button>
        <div>
          <p className="text-os-text">Capture agent sessions</p>
          <p className="mt-1 text-xs leading-relaxed text-os-muted">
            After each finished agent run, add what was asked and the result to today's note in the vault folder <span className="font-os-mono">00 Zak OS Captures</span>. Passwords and keys are blanked out first.
            Workflow sub-agents are skipped so the notes stay readable. It is off until you turn it on.
          </p>
        </div>
      </div>
      <p className="text-xs text-os-muted">To save one session on demand instead, use Save to Brain on that session in Agents.</p>
      {error && <p className="text-xs text-os-danger" role="alert">{error}</p>}
    </div>
  );
}

/** The Brain's working tools: search, ask, graph history and memory capture. */
export function BrainTools({ projectId, onOpenNote, onClose }: Props) {
  const [tab, setTab] = useState<ToolTab>('search');
  const tabs = [
    { id: 'search', label: 'Search' },
    { id: 'ask', label: 'Ask' },
    { id: 'changes', label: 'Changes' },
    { id: 'memory', label: 'Memory' },
  ];
  return (
    <aside aria-label="Brain tools" className="absolute inset-y-0 left-0 z-10 flex w-full flex-col border-r border-os-line bg-os-surface md:w-[400px]">
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-os-line px-3">
        <Tabs aria-label="Brain tools" tabs={tabs} value={tab} onChange={(id) => setTab(id as ToolTab)} />
        <IconButton aria-label="Close tools" onClick={onClose}>
          <X size={16} strokeWidth={1.75} />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === 'search' && <SearchTab onOpenNote={onOpenNote} />}
        {tab === 'ask' && <AskTab onOpenNote={onOpenNote} />}
        {tab === 'changes' && <ChangesTab projectId={projectId} />}
        {tab === 'memory' && <MemoryTab />}
      </div>
    </aside>
  );
}

