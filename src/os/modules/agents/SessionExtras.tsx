import { useEffect, useState } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { api } from '../../lib/api';
import { Panel } from '../../ui';
import { cx } from '../../ui/cx';
import { ago } from './format';
import { summarizeInput, type Item } from './items';

interface Hit {
  id: string;
  title: string;
  agent: string;
  cwd: string;
  updated: number;
  snippet: string;
}

/** Search across every conversation, in every agent. Replaces the session list while it has text. */
export function GlobalSearch({ onActive, linkSuffix }: { onActive: (active: boolean) => void; linkSuffix: string }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const term = q.trim();
    onActive(term.length >= 2);
    if (term.length < 2) return setHits([]);
    setBusy(true);
    const t = setTimeout(() => {
      api<{ hits: Hit[] }>(`/api/agents-x/search?q=${encodeURIComponent(term)}`)
        .then((d) => setHits(d.hits))
        .catch(() => setHits([]))
        .finally(() => setBusy(false));
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const open = q.trim().length >= 2;
  return (
    <>
      <div className="relative px-2 pb-2">
        <label htmlFor="session-search" className="sr-only">Search every conversation</label>
        <MagnifyingGlass size={14} className="pointer-events-none absolute left-5 top-[0.55rem] text-os-muted" aria-hidden />
        <input
          id="session-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search all conversations"
          className="h-8 w-full rounded-[var(--os-input-radius)] border border-os-line bg-os-bg pl-8 pr-3 text-[13px] text-os-text placeholder:text-os-muted focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
        />
      </div>
      {open && (
        <div className="absolute inset-x-0 bottom-0 top-[5.5rem] z-10 overflow-y-auto bg-os-surface p-1.5" role="region" aria-label="Search results">
          {busy && hits.length === 0 && <p className="px-2.5 py-3 text-sm text-os-muted">Searching</p>}
          {!busy && hits.length === 0 && <p className="px-2.5 py-3 text-sm text-os-muted">No conversation mentions that.</p>}
          <ul className="grid gap-0.5">
            {hits.map((h) => (
              <li key={h.id}>
                <a href={`#/agents/${h.agent}/${h.id}${linkSuffix}`} onClick={() => setQ('')} className="block rounded-[var(--os-radius)] px-2.5 py-2 hover:bg-os-surface-2 focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]">
                  <span className="block truncate text-sm text-os-text">{h.title}</span>
                  <span className="block truncate text-xs text-os-muted">{h.snippet}</span>
                  <span className="text-[11px] text-os-muted">{h.agent}, {ago(h.updated)}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

const TRUSTS = [
  { id: '', label: 'Follow the project' },
  { id: 'read-only', label: 'Read only' },
  { id: 'default', label: 'Ask each time' },
  { id: 'acceptEdits', label: 'Edit files freely' },
  { id: 'full', label: 'Do anything (no prompts)' },
];

/** Model and permission level for just this session. */
export function SessionSettings({ sessionId, agent, onChanged, firstPrompt }: { sessionId: string; agent: string; onChanged: () => void; firstPrompt?: string }) {
  const [note, setNote] = useState<string | null>(null);
  const [trust, setTrust] = useState('');
  const [model, setModel] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ trust: string | null; model: string }>(`/api/agents-x/sessions/${sessionId}/settings`)
      .then((d) => {
        setTrust(d.trust ?? '');
        setModel(d.model);
      })
      .catch(() => undefined);
  }, [sessionId]);

  const saveTrust = async (v: string) => {
    setError(null);
    if (v === 'full' && !window.confirm('Full permissions let this session run commands and change files without asking. Only do this in a project you can restore. Continue?')) return;
    try {
      await api(`/api/agents-x/sessions/${sessionId}/trust`, { method: 'PUT', body: { trust: v || null, confirmFull: v === 'full' } });
      setTrust(v);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const saveModel = async (v: string) => {
    setError(null);
    try {
      await api(`/api/agents-x/sessions/${sessionId}/model`, { method: 'PUT', body: { model: v } });
      setModel(v);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <label htmlFor="ss-trust" className="text-xs text-os-muted">Permissions for this session</label>
        <select id="ss-trust" value={trust} onChange={(e) => void saveTrust(e.target.value)} className="h-9 w-full text-[13px]">
          {TRUSTS.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>
      {agent === 'claude' && (
        <div className="grid gap-1">
          <label htmlFor="ss-model" className="text-xs text-os-muted">Model</label>
          <select id="ss-model" value={model} onChange={(e) => void saveModel(e.target.value)} className="h-9 w-full text-[13px]">
            <option value="">Claude Code's default</option>
            <option value="opus">Opus</option>
            <option value="sonnet">Sonnet</option>
            <option value="haiku">Haiku</option>
          </select>
          <p className="text-xs text-os-muted">Used from the next message on.</p>
        </div>
      )}
      {firstPrompt && (
        <button
          type="button"
          onClick={async () => {
            const name = window.prompt('Name this session template');
            if (!name?.trim()) return;
            try {
              await api('/api/agents-x/templates', { method: 'POST', body: { name, agent, prompt: firstPrompt, trust: trust && trust !== 'full' ? trust : null, model } });
              setNote('Saved. Pick it when you create a new session.');
            } catch (e) {
              setError((e as Error).message);
            }
          }}
          className="h-9 rounded-full border border-os-line px-4 text-[13px] text-os-text hover:border-os-muted focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
        >
          Save as a session template
        </button>
      )}
      {note && <p role="status" className="text-xs text-os-ok">{note}</p>}
      {error && <p role="alert" className="text-xs text-os-danger">{error}</p>}
    </div>
  );
}

/** Every tool call in the session in order, with how it ended, for a quick read of what the agent actually did. */
export function ToolTimeline({ items }: { items: Item[] }) {
  const tools = items.filter((i): i is Extract<Item, { kind: 'tool' }> => i.kind === 'tool');
  if (tools.length === 0) return null;
  return (
    <Panel title={`Tool calls (${tools.length})`} padded={false}>
      <ol className="max-h-64 overflow-y-auto">
        {tools.map((t, n) => (
          <li key={t.key} className="flex items-baseline gap-2 border-t border-os-line px-3 py-1.5 first:border-t-0">
            <span className="w-5 shrink-0 text-right text-[11px] tabular-nums text-os-muted">{n + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-os-mono text-xs text-os-text">{t.name}</span>
              <span className="block truncate font-os-mono text-[11px] text-os-muted">{summarizeInput(t.name, t.input)}</span>
            </span>
            <span className={cx('shrink-0 text-[11px]', t.open ? 'text-os-cyan' : t.isError ? 'text-os-danger' : 'text-os-ok')}>{t.open ? 'running' : t.isError ? 'failed' : 'done'}</span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
