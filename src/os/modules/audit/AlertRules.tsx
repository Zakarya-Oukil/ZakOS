import { useState, type FormEvent } from 'react';
import { Trash } from '@phosphor-icons/react';
import { Button, ErrorNote, Field, Panel, inputCls } from '../../ui';
import { api, useResource } from '../../lib/api';
import { timeAgo } from '../../lib/projectsApi';

interface Rule {
  id: string;
  name: string;
  kind: string;
  contains: string;
  enabled: boolean;
  fired: number;
  lastAt: number | null;
}

/** Alert rules: watch the audit log for a kind of entry or a word, and ring the bell when one appears. */
export function AlertRules({ kinds }: { kinds: string[] }) {
  const { data, reload } = useResource<{ rules: Rule[] }>('/api/alerts');
  const [name, setName] = useState('');
  const [kind, setKind] = useState('');
  const [contains, setContains] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api('/api/alerts', { method: 'POST', body: { name, kind, contains } });
      setName('');
      setKind('');
      setContains('');
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const toggle = async (r: Rule) => {
    await api(`/api/alerts/${r.id}`, { method: 'PATCH', body: { enabled: !r.enabled } }).catch(() => undefined);
    reload();
  };
  const remove = async (r: Rule) => {
    await api(`/api/alerts/${r.id}`, { method: 'DELETE' }).catch(() => undefined);
    reload();
  };

  return (
    <Panel title="Alert rules">
      <div className="grid gap-4">
        <p className="max-w-[68ch] text-sm leading-relaxed text-os-muted">An alert rings the notification bell when a new audit entry matches. A rule fires at most once a minute.</p>
        {data && data.rules.length > 0 && (
          <ul className="grid gap-2">
            {data.rules.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-[var(--os-radius)] border border-os-line px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-os-text">{r.name}</p>
                  <p className="text-xs text-os-muted">
                    {r.kind ? `kind ${r.kind}` : 'any kind'}
                    {r.contains ? `, containing "${r.contains}"` : ''}. Fired {r.fired} time{r.fired === 1 ? '' : 's'}
                    {r.lastAt ? `, last ${timeAgo(r.lastAt)}` : ''}.
                  </p>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-[13px] text-os-muted">
                  <input type="checkbox" checked={r.enabled} onChange={() => toggle(r)} />
                  On
                </label>
                <Button size="sm" variant="ghost" aria-label={`Delete ${r.name}`} onClick={() => remove(r)}>
                  <Trash size={15} aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={add} className="grid items-end gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <Field label="Name" htmlFor="al-name">
            <input id="al-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Failed runs" className={inputCls} />
          </Field>
          <Field label="Kind of entry" htmlFor="al-kind">
            <select id="al-kind" value={kind} onChange={(e) => setKind(e.target.value)} className="w-full">
              <option value="">Any</option>
              {kinds.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </Field>
          <Field label="Containing" htmlFor="al-contains">
            <input id="al-contains" value={contains} onChange={(e) => setContains(e.target.value)} placeholder="optional word" className={inputCls} />
          </Field>
          <Button type="submit" size="sm" variant="primary" disabled={!name.trim() || (!kind && !contains.trim())}>Add alert</Button>
        </form>
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
    </Panel>
  );
}
