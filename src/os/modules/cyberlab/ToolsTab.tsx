import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Copy, LockKey } from '@phosphor-icons/react';
import { Button, ErrorNote, Field, Panel, inputCls } from '../../ui';
import { useResource } from '../../lib/api';
import { cx } from '../../ui/cx';
import { cyberApi, type CaseRow, type RunOut, type Tool } from './api';
import { ResultView } from './ResultView';

const EXAMPLE = `{
  "id": "my-tool",
  "name": "My tool",
  "blurb": "What it does, in one sentence.",
  "mode": "passive",
  "input": { "kind": "domain", "label": "Domain", "placeholder": "example.com" },
  "command": "python",
  "args": ["tool.py", "{input}"],
  "timeoutSec": 60,
  "sendsTo": "the service it calls"
}`;

const EXAMPLE_OUT = `{ "summary": "3 hosts found",
  "data": { "anything": "you want shown" },
  "entities": [{ "type": "host", "value": "a.example.com" }],
  "edges": [{ "a": "domain:example.com", "b": "host:a.example.com", "rel": "subdomain" }] }`;

interface Props {
  cases: CaseRow[];
  caseId: string;
  onCase: (id: string) => void;
  toolId?: string;
  onTool: (id: string) => void;
  onRan: () => void;
}

export function ToolsTab({ cases, caseId, onCase, toolId, onTool, onRan }: Props) {
  const { data, error, reload } = useResource<{ tools: Tool[]; vaultUnlocked: boolean; pluginDir: string }>('/api/cyberlab/tools');
  const tools = data?.tools ?? [];
  const tool = tools.find((t) => t.id === toolId) ?? tools[0];
  const [filter, setFilter] = useState('');
  const [input, setInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<RunOut | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const groups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const m = new Map<string, Tool[]>();
    for (const t of tools) if (!q || `${t.name} ${t.blurb} ${t.group}`.toLowerCase().includes(q)) (m.get(t.group) ?? m.set(t.group, []).get(t.group)!).push(t);
    return [...m.entries()];
  }, [tools, filter]);

  const pick = (id: string) => {
    onTool(id);
    setResult(null);
    setErr(null);
    setConfirm(false);
    setInput('');
    setFile(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!tool || busy) return;
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const r = tool.input.kind === 'file' ? await cyberApi.runFile(file!, caseId || undefined) : await cyberApi.run(tool.id, input, caseId || undefined, confirm);
      setResult(r.run);
      onRan();
    } catch (x) {
      setErr((x as Error).message);
      onRan();
    } finally {
      setBusy(false);
      reload();
    }
  };

  if (error) return <div className="p-5"><ErrorNote>{error}</ErrorNote></div>;
  if (!tool) return <p className="p-5 text-sm text-os-muted">Loading tools</p>;

  const blockedByKey = !!tool.needsKey && !tool.keyReady;
  const ready = tool.input.kind === 'file' ? !!file : input.trim().length > 0;

  return (
    <div className="grid h-full min-h-0 gap-0 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="min-h-0 overflow-y-auto overflow-x-hidden border-b border-os-line p-4 lg:border-b-0 lg:border-r">
        <label htmlFor="cl-filter" className="sr-only">Filter tools</label>
        <input id="cl-filter" className={inputCls} placeholder="Filter tools" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <div className="mt-4 grid gap-4">
          {groups.map(([g, list]) => (
            <section key={g}>
              <h2 className="mb-1 text-[13px] font-semibold text-os-muted">{g}</h2>
              <ul className="grid gap-0.5">
                {list.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => pick(t.id)}
                      aria-current={t.id === tool.id ? 'true' : undefined}
                      className={cx('flex w-full items-center gap-2 border-l-2 px-2.5 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]', t.id === tool.id ? 'border-os-cyan bg-os-surface-2 text-os-text' : 'border-transparent text-os-muted hover:bg-os-surface-2 hover:text-os-text')}
                    >
                      <span className="min-w-0 flex-1 truncate">{t.name}</span>
                      {t.mode === 'active' && <span className="shrink-0 border border-os-amber px-1 text-xs text-os-amber">active</span>}
                      {t.needsKey && <LockKey size={14} aria-label="Needs an API key" className="shrink-0" />}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <details className="mt-6 border-t border-os-line pt-4 text-sm">
          <summary className="cursor-pointer font-medium text-os-text">Add your own tool</summary>
          <div className="mt-3 grid gap-3 text-[13px] leading-relaxed text-os-muted">
            <p>
              Create a folder in <code className="break-all font-os-mono text-xs text-os-text">{data?.pluginDir}</code> named after the tool, with a <code className="font-os-mono text-xs text-os-text">manifest.json</code> and your script. Reload this page and it appears under “Your tools”.
            </p>
            <pre className="overflow-x-auto border border-os-line bg-os-bg p-2 font-os-mono text-xs text-os-text">{EXAMPLE}</pre>
            <p>Your script prints JSON to standard output. Plain text works too and is shown as is.</p>
            <pre className="overflow-x-auto border border-os-line bg-os-bg p-2 font-os-mono text-xs text-os-text">{EXAMPLE_OUT}</pre>
            <p>It runs as you, without a shell, with a timeout, inside its own folder, and without your API keys in its environment. There is no operating system sandbox, so read a script before you run it.</p>
            <Button size="sm" onClick={() => void navigator.clipboard?.writeText(EXAMPLE)}>
              <Copy size={14} aria-hidden /> Copy the manifest
            </Button>
          </div>
        </details>
      </aside>

      <div className="min-h-0 overflow-y-auto p-5">
        <div className="mx-auto grid max-w-4xl gap-5">
          <div>
            <h2 className="os-display text-[30px] text-os-text">{tool.name}</h2>
            <p className="mt-1.5 max-w-[68ch] text-[15px] leading-relaxed text-os-muted">{tool.blurb}</p>
            <p className="mt-2 text-[13px] text-os-muted">
              {tool.mode === 'passive' ? 'Passive: reads public records.' : 'Active: sends requests to the target.'} Your input goes to {tool.sendsTo}.
            </p>
          </div>

          <Panel>
            <form onSubmit={submit} className="grid gap-4">
              {tool.input.kind === 'file' ? (
                <Field label={tool.input.label} htmlFor="cl-file" hint="Read in memory on this machine. The file is not saved or uploaded.">
                  <input ref={fileRef} id="cl-file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className={cx(inputCls, 'h-auto py-2')} />
                </Field>
              ) : (
                <Field label={tool.input.label} htmlFor="cl-input">
                  <input id="cl-input" className={cx(inputCls, 'font-os-mono')} value={input} onChange={(e) => setInput(e.target.value)} placeholder={tool.input.placeholder} autoComplete="off" spellCheck={false} />
                </Field>
              )}
              <Field label="Save results to a case" htmlFor="cl-case" hint="Entities and the evidence record are added to the case. Choose none to just look.">
                <select id="cl-case" className={inputCls} value={caseId} onChange={(e) => onCase(e.target.value)}>
                  <option value="">No case (not saved)</option>
                  {cases.filter((c) => c.status === 'open').map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
              {tool.mode === 'active' && (
                <label className="flex items-start gap-2.5 border border-os-amber p-3 text-sm text-os-text">
                  <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-1" />
                  <span>I am authorised to test this target. This tool sends requests to it directly.</span>
                </label>
              )}
              {blockedByKey && (
                <p className="text-sm text-os-amber" role="status">
                  This tool needs your API key stored as “{tool.needsKey}”. {data?.vaultUnlocked ? 'Add it' : 'Unlock the secrets store and add it'} in <a href="#/settings" className="underline underline-offset-4">Settings</a>.
                </p>
              )}
              <div className="flex items-center gap-3">
                <Button type="submit" variant="primary" disabled={busy || !ready || blockedByKey || (tool.mode === 'active' && !confirm)}>
                  {busy ? 'Running' : 'Run'}
                </Button>
                {busy && <span className="text-sm text-os-muted" role="status">Waiting for the source to answer</span>}
              </div>
            </form>
          </Panel>

          {err && <ErrorNote>{err}</ErrorNote>}
          {result && (
            <Panel title="Result">
              <ResultView run={result} />
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
