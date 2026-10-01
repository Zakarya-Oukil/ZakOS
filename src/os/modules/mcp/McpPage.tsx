import { useState, type FormEvent } from 'react';
import { Plus, Trash } from '@phosphor-icons/react';
import type { ModuleProps } from '../registry';
import { PageFrame } from '../../shell/PageFrame';
import { Button, EmptyState, ErrorNote, Field, Panel, Segmented, SuccessNote, inputCls } from '../../ui';
import { api, useResource } from '../../lib/api';

interface Server {
  name: string;
  scope: 'user' | 'project';
  project?: string;
  type: string;
  command?: string;
  url?: string;
  args: string[];
}
interface Entry {
  id: string;
  label: string;
  blurb: string;
  command: string;
  args: string[];
  needs?: string;
}
interface Data {
  servers: Server[];
  catalogue: Entry[];
  projects: Array<{ id: string; name: string }>;
}

export default function McpPage(_props: ModuleProps) {
  const { data, error, reload } = useResource<Data>('/api/mcp');
  const [draft, setDraft] = useState<{ name: string; command: string; args: string; scope: 'user' | 'project'; project: string } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const startFrom = (e?: Entry) =>
    setDraft({ name: e?.id ?? '', command: e?.command ?? '', args: e?.args.join(' ') ?? '', scope: 'user', project: data?.projects[0]?.id ?? '' });

  const add = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!draft) return;
    setBusy('add');
    setMsg(null);
    try {
      await api('/api/mcp', { method: 'POST', body: { name: draft.name, command: draft.command, args: draft.args.split(' ').filter(Boolean), scope: draft.scope, project: draft.project } });
      setMsg({ ok: true, text: `Added ${draft.name}. Restart open Claude sessions to pick it up.` });
      setDraft(null);
      reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const remove = async (s: Server) => {
    if (!window.confirm(`Remove the MCP server "${s.name}" (${s.scope})?`)) return;
    setBusy(s.name);
    setMsg(null);
    try {
      await api(`/api/mcp/${encodeURIComponent(s.name)}?scope=${s.scope}${s.project ? `&project=${s.project}` : ''}`, { method: 'DELETE' });
      reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const test = async (s: Server) => {
    setBusy(s.name);
    setMsg(null);
    try {
      const d = await api<{ connected: boolean; output: string }>(`/api/mcp/${encodeURIComponent(s.name)}/test`, { method: 'POST', body: { project: s.project } });
      setMsg({ ok: d.connected, text: d.connected ? `${s.name} connected.` : `${s.name} did not report a connection. ${d.output.split('\n').slice(0, 4).join(' ')}` });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const usage = useResource<{ entries: Array<{ id: number; ts: number; detail: string }> }>('/api/audit?q=mcp__&limit=100');
  const calls = (usage.data?.entries ?? []).map((e) => {
    const m = /^(mcp__([^_]+(?:_[^_]+)*?)__(\S+))/.exec(e.detail);
    return m ? { id: e.id, ts: e.ts, server: m[2], tool: m[3] } : null;
  }).filter((x): x is { id: number; ts: number; server: string; tool: string } => x !== null);
  const perServer = [...calls.reduce((m, c) => m.set(c.server, (m.get(c.server) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const installed = new Set(data?.servers.map((s) => s.name));

  return (
    <PageFrame
      title="MCP servers"
      actions={
        <Button size="sm" variant="primary" onClick={() => startFrom()}>
          <Plus size={15} aria-hidden /> Add a server
        </Button>
      }
    >
      <div className="h-full overflow-y-auto p-5">
        <div className="mx-auto grid max-w-[1100px] gap-5">
          {error && <ErrorNote>{error}</ErrorNote>}
          {msg && (msg.ok ? <SuccessNote>{msg.text}</SuccessNote> : <ErrorNote>{msg.text}</ErrorNote>)}

          {draft && (
            <Panel title="Review before you add">
              <form onSubmit={add} className="grid gap-4">
                <p className="max-w-[68ch] text-sm leading-relaxed text-os-muted">
                  An MCP server is a program Claude Code starts on your machine. Read the exact command below. Only add servers you trust.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name" htmlFor="m-name">
                    <input id="m-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Command" htmlFor="m-cmd">
                    <input id="m-cmd" value={draft.command} onChange={(e) => setDraft({ ...draft, command: e.target.value })} className={inputCls} />
                  </Field>
                </div>
                <Field label="Arguments" htmlFor="m-args" hint="Separated by spaces. Replace anything in angle brackets, like a folder path.">
                  <input id="m-args" value={draft.args} onChange={(e) => setDraft({ ...draft, args: e.target.value })} className={inputCls} />
                </Field>
                <div className="grid gap-1.5">
                  <span className="text-[13px] font-medium text-os-text">Available to</span>
                  <div className="flex flex-wrap items-center gap-3">
                    <Segmented<'user' | 'project'> label="Scope" value={draft.scope} onChange={(v) => setDraft({ ...draft, scope: v })} options={[{ id: 'user', label: 'All projects' }, { id: 'project', label: 'One project' }]} />
                    {draft.scope === 'project' && (
                      <select aria-label="Project" value={draft.project} onChange={(e) => setDraft({ ...draft, project: e.target.value })}>
                        {data?.projects.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
                <p className="rounded-[var(--os-radius)] bg-os-surface-2 px-3 py-2 font-os-mono text-xs leading-relaxed text-os-text">
                  claude mcp add --scope {draft.scope} {draft.name || '<name>'} -- {draft.command || '<command>'} {draft.args}
                </p>
                <div className="flex gap-2">
                  <Button type="submit" variant="primary" size="sm" disabled={busy === 'add' || !draft.name || !draft.command}>Add this server</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
                </div>
              </form>
            </Panel>
          )}

          <Panel title={`Installed (${data?.servers.length ?? 0})`} padded={false}>
            {data && data.servers.length === 0 ? (
              <EmptyState title="No MCP servers yet">Add one from the catalogue below to give Claude new tools.</EmptyState>
            ) : (
              <ul>
                {data?.servers.map((s) => (
                  <li key={`${s.scope}-${s.project}-${s.name}`} className="flex flex-wrap items-center gap-3 border-t border-os-line px-4 py-3 first:border-t-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-medium text-os-text">
                        {s.name} <span className="ml-1.5 text-xs font-normal text-os-muted">{s.scope === 'user' ? 'all projects' : `project ${data.projects.find((p) => p.id === s.project)?.name ?? ''}`}</span>
                      </p>
                      <p className="truncate font-os-mono text-xs text-os-muted">{s.url ?? `${s.command ?? ''} ${s.args.join(' ')}`}</p>
                    </div>
                    <Button size="sm" onClick={() => test(s)} disabled={busy === s.name}>
                      {busy === s.name ? 'Testing' : 'Test'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(s)} disabled={busy === s.name} aria-label={`Remove ${s.name}`}>
                      <Trash size={15} aria-hidden /> Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Usage log" padded={false}>
            {calls.length === 0 ? (
              <p className="p-4 text-sm text-os-muted">No MCP tool calls recorded yet. Calls made by agents through Zak OS appear here.</p>
            ) : (
              <div className="grid gap-0 lg:grid-cols-[220px_minmax(0,1fr)]">
                <ul className="border-b border-os-line p-4 lg:border-b-0 lg:border-r">
                  {perServer.map(([name, n]) => (
                    <li key={name} className="flex justify-between gap-3 py-1 text-sm text-os-text">
                      <span className="truncate">{name}</span>
                      <span className="tabular-nums text-os-muted">{n}</span>
                    </li>
                  ))}
                </ul>
                <ul className="max-h-60 overflow-y-auto">
                  {calls.slice(0, 25).map((c) => (
                    <li key={c.id} className="flex items-baseline gap-3 border-t border-os-line px-4 py-2 first:border-t-0">
                      <span className="w-24 shrink-0 text-xs text-os-muted">{new Date(c.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="font-os-mono text-xs text-os-text">{c.server}</span>
                      <span className="min-w-0 flex-1 truncate font-os-mono text-xs text-os-muted">{c.tool}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>

          <Panel title="Catalogue" padded={false}>
            <ul className="grid sm:grid-cols-2">
              {data?.catalogue.map((c) => (
                <li key={c.id} className="flex flex-col justify-between gap-3 border-t border-os-line p-4 sm:[&:nth-child(-n+2)]:border-t-0">
                  <div>
                    <p className="text-[15px] font-medium text-os-text">{c.label}</p>
                    <p className="mt-0.5 text-sm text-os-muted">{c.blurb}</p>
                    {c.needs && <p className="mt-1 text-xs text-os-muted">Needs: {c.needs}</p>}
                  </div>
                  <Button size="sm" className="self-start" disabled={installed.has(c.id)} onClick={() => startFrom(c)}>
                    {installed.has(c.id) ? 'Installed' : 'Review and add'}
                  </Button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </PageFrame>
  );
}
