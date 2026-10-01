import { useState, type FormEvent } from 'react';
import { CheckCircle, CircleDashed } from '@phosphor-icons/react';
import type { ModuleProps } from '../registry';
import { PageFrame } from '../../shell/PageFrame';
import { Button, ErrorNote, Field, Panel, SuccessNote, inputCls } from '../../ui';
import { api, useResource } from '../../lib/api';
import { SecretsGate } from './SecretsGate';

interface FieldDef {
  key: string;
  label: string;
  secret: boolean;
  placeholder: string;
}
interface Service {
  id: string;
  label: string;
  blurb: string;
  fields: FieldDef[];
  connected: boolean;
  detail: string;
  values: Record<string, string>;
}

function ServiceCard({ s, unlocked, onSaved }: { s: Service; unlocked: boolean; onSaved: () => void }) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api(`/api/integrations/${s.id}`, { method: 'PUT', body: form });
      setForm({});
      setMsg({ ok: true, text: 'Saved.' });
      onSaved();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const d = await api<{ detail?: string }>(`/api/integrations/${s.id}/test`, { method: 'POST' });
      setMsg({ ok: true, text: d.detail ?? 'It works.' });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title={s.label}
      header={
        <span className={s.connected ? 'flex items-center gap-1.5 text-xs font-medium text-os-ok' : 'flex items-center gap-1.5 text-xs text-os-muted'}>
          {s.connected ? <CheckCircle size={16} aria-hidden /> : <CircleDashed size={16} aria-hidden />}
          {s.detail}
        </span>
      }
    >
      <p className="mb-4 text-sm leading-relaxed text-os-muted">{s.blurb}</p>
      {s.fields.length > 0 && (
        <form onSubmit={save} className="grid gap-3">
          {s.fields.map((f) => (
            <Field key={f.key} label={f.label} htmlFor={`${s.id}-${f.key}`} hint={f.secret && s.connected ? 'Saved. Type a new value to replace it.' : undefined}>
              <input
                id={`${s.id}-${f.key}`}
                type={f.secret ? 'password' : 'text'}
                autoComplete="off"
                disabled={!unlocked && f.secret}
                value={form[f.key] ?? (f.secret ? '' : s.values[f.key] ?? '')}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                placeholder={f.secret && s.connected ? '••••••••' : f.placeholder}
                className={inputCls}
              />
            </Field>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" variant="primary" disabled={busy || !unlocked || Object.keys(form).length === 0}>
              Save
            </Button>
            <Button type="button" size="sm" onClick={test} disabled={busy || !s.connected}>
              Send a test
            </Button>
          </div>
        </form>
      )}
      {s.id === 'github' && (
        <Button size="sm" onClick={test} disabled={busy}>
          Check the connection
        </Button>
      )}
      {msg && <div className="mt-3">{msg.ok ? <SuccessNote>{msg.text}</SuccessNote> : <ErrorNote>{msg.text}</ErrorNote>}</div>}
    </Panel>
  );
}

export default function IntegrationsPage(_props: ModuleProps) {
  const { data, error, reload } = useResource<{ services: Service[]; notYet: string[] }>('/api/integrations');
  const [unlocked, setUnlocked] = useState(false);

  return (
    <PageFrame title="Integrations">
      <div className="h-full overflow-y-auto p-5">
        <div className="mx-auto grid max-w-[1100px] gap-5">
          {error && <ErrorNote>{error}</ErrorNote>}
          <p className="max-w-[68ch] text-[15px] leading-relaxed text-os-muted">
            Connect the services Zak OS can tell about finished runs. Tokens are encrypted on this machine and never sent back to the page.
            New kinds of action an agent asks for still land in Approvals first.
          </p>
          <SecretsGate onChange={(u) => { setUnlocked(u); reload(); }}>
            <div className="grid items-start gap-5 lg:grid-cols-2">
              {data?.services.map((s) => (
                <ServiceCard key={s.id} s={s} unlocked={unlocked} onSaved={reload} />
              ))}
            </div>
          </SecretsGate>
          {!unlocked && data && (
            <div className="grid items-start gap-5 lg:grid-cols-2">
              {data.services
                .filter((s) => s.id === 'github')
                .map((s) => (
                  <ServiceCard key={s.id} s={s} unlocked={false} onSaved={reload} />
                ))}
            </div>
          )}
          {data && <p className="text-sm text-os-muted">Not available yet: {data.notYet.join(', ')}. They need an OAuth app, which is set up per customer.</p>}
        </div>
      </div>
    </PageFrame>
  );
}
