import { useEffect, useState } from 'react';
import { ArrowSquareOut, Trash } from '@phosphor-icons/react';
import { Button, EmptyState, ErrorNote, Field, Panel, SuccessNote, inputCls } from '../../ui';
import { cx } from '../../ui/cx';
import { api, useResource } from '../../lib/api';
import { projectsApi, timeAgo, type ProjectInfo } from '../../lib/projectsApi';

// ---- port map ----------------------------------------------------------------------------------

interface AppRow {
  projectId: string;
  state: 'running' | 'stopped' | 'exited';
  command: string;
  startedAt: number;
  url: string | null;
}

/** Every app running through Zak OS and the port it chose, so two projects never fight over :3000 unseen. */
export function PortMap({ onOpen }: { onOpen: (projectId: string) => void }) {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const { data, reload } = useResource<{ apps: AppRow[] }>('/api/apps');
  useEffect(() => {
    projectsApi.list().then(setProjects).catch(() => undefined);
    const t = setInterval(reload, 4000);
    return () => clearInterval(t);
  }, [reload]);

  const rows = (data?.apps ?? []).filter((a) => a.state === 'running');
  const portOf = (u: string | null) => (u ? new URL(u).port : '');
  const ports = rows.map((r) => portOf(r.url)).filter(Boolean);
  const clash = new Set(ports.filter((p, i) => ports.indexOf(p) !== i));

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mx-auto grid max-w-3xl gap-4">
        <p className="max-w-[68ch] text-sm leading-relaxed text-os-muted">Apps you started from the Run tab. Each project can run one app, and several projects can run at once.</p>
        {rows.length === 0 ? (
          <EmptyState title="Nothing is running">Start an app from the Run tab and it shows up here with its port.</EmptyState>
        ) : (
          <Panel title={`Running (${rows.length})`} padded={false}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-os-muted">
                  <th scope="col" className="px-4 py-2 font-medium">Project</th>
                  <th scope="col" className="px-2 py-2 font-medium">Port</th>
                  <th scope="col" className="px-2 py-2 font-medium">Command</th>
                  <th scope="col" className="px-2 py-2 font-medium">Up</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.projectId} className="border-t border-os-line">
                    <td className="px-4 py-2.5 text-os-text">{projects.find((p) => p.id === r.projectId)?.name ?? r.projectId.slice(0, 8)}</td>
                    <td className={cx('px-2 py-2.5 font-os-mono', clash.has(portOf(r.url)) ? 'text-os-danger' : 'text-os-text')}>{portOf(r.url) || 'waiting'}{clash.has(portOf(r.url)) ? ' (clash)' : ''}</td>
                    <td className="max-w-[16rem] truncate px-2 py-2.5 font-os-mono text-xs text-os-muted">{r.command}</td>
                    <td className="px-2 py-2.5 text-xs text-os-muted">{timeAgo(r.startedAt)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="inline-flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => onOpen(r.projectId)}>Open</Button>
                        {r.url && (
                          <a href={r.url} target="_blank" rel="noreferrer" aria-label="Open in the browser" className="inline-flex h-8 items-center rounded-full px-3 text-os-muted hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]">
                            <ArrowSquareOut size={15} aria-hidden />
                          </a>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}
      </div>
    </div>
  );
}

// ---- environment profiles -------------------------------------------------------------------------

export function EnvProfiles({ projectId, profile, onProfile, disabled }: { projectId: string; profile: string; onProfile: (p: string) => void; disabled: boolean }) {
  const { data, reload } = useResource<{ profiles: Record<string, string[]> }>(`/api/dev-env/${projectId}`);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [k, setK] = useState('');
  const [v, setV] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const names = Object.keys(data?.profiles ?? {});
  const target = profile || name.trim();

  const save = async () => {
    setError(null);
    setOk(null);
    try {
      await api(`/api/dev-env/${projectId}/${target}`, { method: 'PUT', body: { vars: { [k]: v } } });
      setK('');
      setV('');
      setOk(`Saved ${k} to ${target}. The value is hidden from now on.`);
      if (!profile) onProfile(target);
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const unset = async (key: string) => {
    await api(`/api/dev-env/${projectId}/${profile}`, { method: 'PUT', body: { vars: { [key]: '' } } }).catch((e: Error) => setError(e.message));
    reload();
  };

  const drop = async () => {
    if (!window.confirm(`Delete the profile "${profile}" and its variables?`)) return;
    await api(`/api/dev-env/${projectId}/${profile}`, { method: 'DELETE' }).catch(() => undefined);
    onProfile('');
    reload();
  };

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <label htmlFor="dev-profile" className="text-xs text-os-muted">Environment</label>
        <select id="dev-profile" value={profile} onChange={(e) => onProfile(e.target.value)} disabled={disabled} className="h-8 text-[13px]">
          <option value="">None (use this machine as is)</option>
          {names.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="text-xs text-os-muted underline underline-offset-4 hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]">
          {open ? 'Hide' : 'Edit'}
        </button>
      </div>
      {open && (
        <div className="grid gap-3 rounded-[var(--os-radius)] border border-os-line p-3">
          {!profile && (
            <Field label="New profile name" htmlFor="env-name" hint="For example dev or staging.">
              <input id="env-name" value={name} onChange={(e) => setName(e.target.value.toLowerCase())} className={inputCls + ' h-9'} />
            </Field>
          )}
          {profile && (data?.profiles[profile] ?? []).length > 0 && (
            <ul className="grid gap-1">
              {data!.profiles[profile].map((key) => (
                <li key={key} className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-os-mono text-xs text-os-text">{key} <span className="text-os-muted">= hidden</span></span>
                  <button type="button" aria-label={`Remove ${key}`} onClick={() => unset(key)} className="rounded-full p-1.5 text-os-muted hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"><Trash size={14} aria-hidden /></button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <label className="sr-only" htmlFor="env-key">Variable name</label>
            <input id="env-key" value={k} onChange={(e) => setK(e.target.value)} placeholder="API_URL" spellCheck={false} className={inputCls + ' h-9 font-os-mono text-xs'} />
            <label className="sr-only" htmlFor="env-val">Value</label>
            <input id="env-val" type="password" autoComplete="off" value={v} onChange={(e) => setV(e.target.value)} placeholder="value" className={inputCls + ' h-9 font-os-mono text-xs'} />
            <Button size="sm" onClick={save} disabled={!k.trim() || !v || !target}>Save</Button>
          </div>
          <p className="text-xs text-os-muted">Values stay on this machine, are not shown again and are never written to the audit log.</p>
          {profile && <Button size="sm" variant="ghost" className="justify-self-start" onClick={drop}>Delete this profile</Button>}
          {error && <ErrorNote>{error}</ErrorNote>}
          {ok && <SuccessNote>{ok}</SuccessNote>}
        </div>
      )}
    </div>
  );
}

// ---- deploy recipe -----------------------------------------------------------------------------------

interface Preview {
  stack: string;
  reason: string;
  port: number;
  files: Record<string, string>;
  existing: string[];
  notes: string[];
}

export function DeployTab({ projectId }: { projectId: string }) {
  const [port, setPort] = useState('3000');
  const [domain, setDomain] = useState('');
  const [stack, setStack] = useState('');
  const [overwrite, setOverwrite] = useState(false);
  const [file, setFile] = useState('Dockerfile');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const q = `/api/deploy/preview?project=${projectId}&port=${encodeURIComponent(port)}&domain=${encodeURIComponent(domain)}${stack ? `&stack=${stack}` : ''}`;
  const { data, error } = useResource<Preview>(q);

  const write = async () => {
    setMsg(null);
    try {
      const d = await api<{ written: string[] }>('/api/deploy/write', { method: 'POST', body: { project: projectId, port: Number(port), domain, stack: stack || undefined, overwrite } });
      setMsg({ ok: true, text: `Wrote ${d.written.join(', ')} into the project folder.` });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mx-auto grid max-w-4xl gap-5">
        <p className="max-w-[68ch] text-sm leading-relaxed text-os-muted">Writes the files to run this project on a small VPS with Docker. Zak OS never connects to a server: <span className="font-os-mono">deploy.sh</span> runs on your machine when you decide to run it.</p>
        <Panel title="Recipe">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Stack" htmlFor="dp-stack" hint={data?.reason}>
              <select id="dp-stack" value={stack} onChange={(e) => setStack(e.target.value)} className="w-full">
                <option value="">Detect ({data?.stack ?? '...'})</option>
                <option value="node">Node</option>
                <option value="python">Python</option>
                <option value="static">Static site</option>
              </select>
            </Field>
            <Field label="Port the app uses" htmlFor="dp-port">
              <input id="dp-port" inputMode="numeric" value={port} onChange={(e) => setPort(e.target.value.replace(/\D/g, ''))} className={inputCls} />
            </Field>
            <Field label="Domain (optional)" htmlFor="dp-domain" hint="Adds a Caddyfile that gets the HTTPS certificate for you.">
              <input id="dp-domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="app.example.com" className={inputCls} />
            </Field>
          </div>
        </Panel>
        {error && <ErrorNote>{error}</ErrorNote>}
        {data && (
          <Panel title="Files" padded={false}>
            <div className="grid lg:grid-cols-[200px_minmax(0,1fr)]">
              <ul className="border-b border-os-line p-2 lg:border-b-0 lg:border-r">
                {Object.keys(data.files).map((f) => (
                  <li key={f}>
                    <button type="button" aria-current={file === f ? 'true' : undefined} onClick={() => setFile(f)} className={cx('flex w-full items-center justify-between rounded-full px-3 py-1.5 text-left font-os-mono text-xs focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]', file === f ? 'bg-os-surface-2 text-os-text' : 'text-os-muted hover:text-os-text')}>
                      {f}
                      {data.existing.includes(f) && <span className="font-sans text-[11px] text-os-amber">exists</span>}
                    </button>
                  </li>
                ))}
              </ul>
              <pre className="max-h-96 overflow-auto p-4 font-os-mono text-xs leading-relaxed text-os-text">{data.files[file] ?? data.files.Dockerfile}</pre>
            </div>
          </Panel>
        )}
        {data && data.existing.length > 0 && (
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-os-text">
            <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} className="mt-0.5" />
            <span>Replace the files that already exist ({data.existing.join(', ')})</span>
          </label>
        )}
        {msg && (msg.ok ? <SuccessNote>{msg.text}</SuccessNote> : <ErrorNote>{msg.text}</ErrorNote>)}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={write} disabled={!data}>Write the files into the project</Button>
        </div>
        {data && (
          <ul className="grid gap-1 text-sm text-os-muted">
            {data.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
