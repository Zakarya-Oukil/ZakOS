import { useState, type FormEvent } from 'react';
import { ArrowsClockwise, Copy, Trash } from '@phosphor-icons/react';
import type { ModuleProps } from '../registry';
import { PageFrame } from '../../shell/PageFrame';
import { Button, EmptyState, ErrorNote, Field, Panel, Segmented, SuccessNote, inputCls } from '../../ui';
import { api, useResource } from '../../lib/api';
import { timeAgo } from '../../lib/projectsApi';

interface Hook {
  name: string;
  action: 'log' | 'task';
  created: number;
  hits: number;
}
interface LogRow {
  id: number;
  ts: number;
  name: string;
  status: number;
  note: string;
  body: string;
}

const origin = () => `${window.location.protocol}//${window.location.hostname}:4000`;

export default function WebhooksPage(_props: ModuleProps) {
  const hooks = useResource<{ hooks: Hook[]; hasKey: boolean; keyCreated: number | null }>('/api/hooks');
  const log = useResource<{ log: LogRow[] }>('/api/hooks/log');
  const [name, setName] = useState('');
  const [action, setAction] = useState<'log' | 'task'>('task');
  const [created, setCreated] = useState<{ name: string; secret: string } | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice('Copied');
      setTimeout(() => setNotice(null), 1500);
    } catch {
      setError('The browser blocked copying. Select the text and copy it by hand.');
    }
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const d = await api<{ name: string; secret: string }>('/api/hooks', { method: 'POST', body: { name, action } });
      setCreated({ name: d.name, secret: d.secret });
      setName('');
      hooks.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const del = async (n: string) => {
    if (!window.confirm(`Delete the webhook "${n}"? Senders using it will start getting errors.`)) return;
    await api(`/api/hooks/${n}`, { method: 'DELETE' }).catch((err: Error) => setError(err.message));
    hooks.reload();
    log.reload();
  };

  const replay = async (id: number) => {
    setError(null);
    try {
      const d = await api<{ note: string }>(`/api/hooks/log/${id}/replay`, { method: 'POST' });
      setNotice(`Replayed: ${d.note}`);
      log.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const makeKey = async () => {
    if (hooks.data?.hasKey && !window.confirm('Creating a new key stops the old one working. Continue?')) return;
    try {
      const d = await api<{ key: string }>('/api/hooks/apikey', { method: 'POST' });
      setNewKey(d.key);
      hooks.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const revoke = async () => {
    await api('/api/hooks/apikey', { method: 'DELETE' }).catch((err: Error) => setError(err.message));
    setNewKey(null);
    hooks.reload();
  };

  return (
    <PageFrame title="Webhooks and keys">
      <div className="h-full overflow-y-auto p-5">
        <div className="mx-auto grid max-w-[1100px] gap-5">
          {(error || hooks.error) && <ErrorNote>{error ?? hooks.error}</ErrorNote>}
          {notice && <SuccessNote>{notice}</SuccessNote>}

          <Panel title="New webhook">
            <form onSubmit={create} className="grid items-end gap-4 md:grid-cols-[1fr_auto_auto]">
              <Field label="Name" htmlFor="wh-name" hint="Lowercase letters, numbers and dashes. It becomes part of the URL.">
                <input id="wh-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="deploy-finished" className={inputCls} />
              </Field>
              <div className="grid gap-1.5">
                <span className="text-[13px] font-medium text-os-text">When it arrives</span>
                <Segmented<'log' | 'task'> label="Action" value={action} onChange={setAction} options={[{ id: 'task', label: 'Make a task' }, { id: 'log', label: 'Just log it' }]} />
              </div>
              <Button type="submit" variant="primary" disabled={!name}>Create</Button>
            </form>
            {created && (
              <div className="mt-4 grid gap-2 rounded-[var(--os-radius)] border border-os-cyan p-4">
                <p className="text-sm font-medium text-os-text">Copy the secret now. It is not shown again.</p>
                <p className="break-all font-os-mono text-xs text-os-text">{created.secret}</p>
                <p className="text-xs leading-relaxed text-os-muted">
                  Sign the request body with HMAC-SHA256 using this secret and send it as <span className="font-os-mono">x-zakos-signature: sha256=&lt;hex&gt;</span> to{' '}
                  <span className="font-os-mono">{origin()}/hooks/{created.name}</span>.
                </p>
                <Button size="sm" className="justify-self-start" onClick={() => copy(created.secret)}>
                  <Copy size={15} aria-hidden /> Copy the secret
                </Button>
              </div>
            )}
          </Panel>

          <Panel title="Your webhooks" padded={false}>
            {hooks.data && hooks.data.hooks.length === 0 ? (
              <EmptyState title="No webhooks yet">Create one to let CI, a form or another service send events in.</EmptyState>
            ) : (
              <ul>
                {hooks.data?.hooks.map((h) => (
                  <li key={h.name} className="flex flex-wrap items-center gap-3 border-t border-os-line px-4 py-3 first:border-t-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-os-mono text-sm text-os-text">/hooks/{h.name}</p>
                      <p className="text-xs text-os-muted">{h.action === 'task' ? 'Makes a task card' : 'Logs only'}, {h.hits} accepted, made {timeAgo(h.created)}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => del(h.name)} aria-label={`Delete ${h.name}`}>
                      <Trash size={15} aria-hidden /> Delete
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Request log" header={<Button size="sm" variant="ghost" onClick={log.reload}><ArrowsClockwise size={15} aria-hidden /> Refresh</Button>} padded={false}>
            {log.data && log.data.log.length === 0 ? (
              <p className="p-4 text-sm text-os-muted">No requests yet.</p>
            ) : (
              <ul>
                {log.data?.log.map((r) => (
                  <li key={r.id} className="border-t border-os-line px-4 py-2.5 first:border-t-0">
                    <div className="flex items-center gap-3">
                      <span className={r.status === 200 ? 'w-9 font-os-mono text-xs text-os-ok' : 'w-9 font-os-mono text-xs text-os-danger'}>{r.status}</span>
                      <span className="font-os-mono text-xs text-os-text">{r.name}</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-os-muted">{r.note}</span>
                      <span className="shrink-0 text-xs text-os-muted">{timeAgo(r.ts)}</span>
                      {r.status === 200 && (
                        <Button size="sm" variant="ghost" onClick={() => replay(r.id)}>Replay</Button>
                      )}
                    </div>
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-os-muted hover:text-os-text">Payload</summary>
                      <pre className="mt-1 max-h-40 overflow-auto rounded-[var(--os-radius)] bg-os-surface-2 p-2 font-os-mono text-xs text-os-text">{r.body}</pre>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Personal API key">
            <p className="mb-3 max-w-[68ch] text-sm leading-relaxed text-os-muted">
              A key lets your own scripts call Zak OS. It can read status and create tasks, nothing more. Only a hash of it is stored, so it is shown once.
            </p>
            {newKey && (
              <div className="mb-3 grid gap-2 rounded-[var(--os-radius)] border border-os-cyan p-4">
                <p className="text-sm font-medium text-os-text">Copy the key now.</p>
                <p className="break-all font-os-mono text-xs text-os-text">{newKey}</p>
                <Button size="sm" className="justify-self-start" onClick={() => copy(newKey)}><Copy size={15} aria-hidden /> Copy the key</Button>
                <p className="font-os-mono text-xs text-os-muted">curl -H "Authorization: Bearer KEY" -H "content-type: application/json" -d '{`{"title":"Fix login"}`}' {origin()}/api/v1/tasks</p>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="primary" onClick={makeKey}>{hooks.data?.hasKey ? 'Create a new key' : 'Create a key'}</Button>
              {hooks.data?.hasKey && <Button size="sm" variant="ghost" onClick={revoke}>Revoke the key</Button>}
              {hooks.data?.hasKey && hooks.data.keyCreated && <span className="text-xs text-os-muted">Made {timeAgo(hooks.data.keyCreated)}</span>}
            </div>
          </Panel>
        </div>
      </div>
    </PageFrame>
  );
}
