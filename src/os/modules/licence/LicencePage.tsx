import { OwnerAvatar } from '../../shell/OwnerAvatar';
import { useState, type FormEvent } from 'react';
import type { ModuleProps } from '../registry';
import { PageFrame } from '../../shell/PageFrame';
import { Button, ErrorNote, Field, Panel, SuccessNote, inputCls, textareaCls } from '../../ui';
import { api } from '../../lib/api';
import { LICENCE_EVENT, useLicence } from '../../lib/useLicence';
import { MODULES } from '../registry';

const PLAN_LABEL = { free: 'Free', pro: 'Pro', team: 'Team' } as const;

export default function LicencePage(_props: ModuleProps) {
  const { info, refresh } = useLicence();
  const [key, setKey] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [buy, setBuy] = useState<string | null>(null);
  const [manifest, setManifest] = useState<string | null>(null);
  const [update, setUpdate] = useState<{ configured: boolean; latest: string | null; notes: string; url: string } | null>(null);

  const changed = () => {
    window.dispatchEvent(new Event(LICENCE_EVENT));
    refresh();
  };

  const activate = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      const d = await api<{ plan: keyof typeof PLAN_LABEL }>('/api/licence/activate', { method: 'POST', body: { key } });
      setMsg({ ok: true, text: `Activated the ${PLAN_LABEL[d.plan]} plan.` });
      setKey('');
      changed();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    }
  };

  const remove = async () => {
    if (!window.confirm('Remove the licence key? Premium pages lock again. Your data stays.')) return;
    await api('/api/licence', { method: 'DELETE' }).catch((e: Error) => setMsg({ ok: false, text: e.message }));
    changed();
  };

  const saveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      await api('/api/licence/settings', { method: 'PUT', body: { buyUrl: buy ?? info?.buyUrl ?? '', manifestUrl: manifest ?? info?.manifestUrl ?? '' } });
      setMsg({ ok: true, text: 'Links saved.' });
      refresh();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    }
  };

  const check = async () => {
    setMsg(null);
    try {
      setUpdate(await api('/api/licence/updates'));
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    }
  };

  const premium = MODULES.filter((m) => m.premium);
  const newer = update?.latest && info && update.latest !== info.version;

  return (
    <PageFrame title="Licence">
      <div className="h-full overflow-y-auto p-5">
        <div className="mx-auto grid max-w-[900px] gap-5">
          {msg && (msg.ok ? <SuccessNote>{msg.text}</SuccessNote> : <ErrorNote>{msg.text}</ErrorNote>)}

          <Panel title="Your plan">
            <p className="font-os-sans text-[34px] font-extrabold leading-none tracking-tight text-os-text">{info ? PLAN_LABEL[info.plan] : '...'}</p>
            {info?.licensee && (
              <p className="mt-3 flex items-center gap-3 text-sm text-os-muted">
                <OwnerAvatar name={info.licensee} size={44} />
                <span>
                Licensed to {info.licensee}
                {info.expires ? `, valid until ${new Date(info.expires).toLocaleDateString()}` : ', no expiry'}.
                </span>
              </p>
            )}
            {info?.reason && <p className="mt-2 text-sm text-os-danger">The saved key is no longer valid: {info.reason}</p>}
            <p className="mt-4 max-w-[68ch] text-sm leading-relaxed text-os-muted">
              Without a licence you keep everything on the Free plan. Pages on a higher plan show what they do and how to unlock them. Nothing is deleted and your data stays on disk and in backups.
            </p>
            <ul className="mt-3 grid gap-1 text-sm text-os-text sm:grid-cols-2">
              {premium.map((m) => (
                <li key={m.id}>{m.label} <span className="text-xs text-os-muted">({m.premium === 'team' ? 'Team' : 'Pro'})</span></li>
              ))}
            </ul>
            {info?.buyUrl && (
              <a href={info.buyUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex h-10 items-center rounded-full bg-os-cyan px-5 text-sm font-medium text-os-on-accent hover:brightness-110">
                Upgrade
              </a>
            )}
          </Panel>

          <Panel title="Activate a key">
            <form onSubmit={activate} className="grid gap-3">
              <Field label="Licence key" htmlFor="lic-key" hint="Keys start with ZAKOS1. They are checked on this machine, no internet needed.">
                <textarea id="lic-key" rows={3} value={key} onChange={(e) => setKey(e.target.value)} className={textareaCls + ' font-os-mono text-xs'} spellCheck={false} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="primary" size="sm" disabled={!key.trim()}>Activate</Button>
                {info && info.plan !== 'free' && <Button type="button" size="sm" variant="ghost" onClick={remove}>Remove the key</Button>}
              </div>
              {info && !info.hasPublicKey && <p className="text-xs text-os-danger">This build has no licence public key, so keys cannot be checked.</p>}
            </form>
          </Panel>

          <Panel title="Updates">
            <p className="text-sm text-os-muted">Installed version {info?.version ?? '...'}.</p>
            <div className="mt-3 flex items-center gap-3">
              <Button size="sm" onClick={check} disabled={!info?.manifestUrl}>Check for updates</Button>
              {!info?.manifestUrl && <span className="text-xs text-os-muted">Add an update link below first.</span>}
            </div>
            {update?.configured && (
              <p className="mt-3 text-sm text-os-text">
                {newer ? `Version ${update.latest} is available.` : 'You are on the latest version.'} {update.notes}
                {newer && update.url && <> <a className="underline underline-offset-2" href={update.url} target="_blank" rel="noreferrer">Download</a></>}
              </p>
            )}
          </Panel>

          <Panel title="Your links (for sellers)">
            <form onSubmit={saveSettings} className="grid gap-3">
              <p className="max-w-[68ch] text-sm text-os-muted">If you resell Zak OS, point the Upgrade button at your checkout page and the update check at a small JSON file you host. Payment itself happens on your page, with your own provider.</p>
              <Field label="Upgrade link" htmlFor="lic-buy">
                <input id="lic-buy" type="url" placeholder="https://" value={buy ?? info?.buyUrl ?? ''} onChange={(e) => setBuy(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Update manifest link" htmlFor="lic-man" hint='A JSON file like {"version":"1.2.0","notes":"What changed","url":"https://..."}.'>
                <input id="lic-man" type="url" placeholder="https://" value={manifest ?? info?.manifestUrl ?? ''} onChange={(e) => setManifest(e.target.value)} className={inputCls} />
              </Field>
              <Button type="submit" size="sm" className="justify-self-start">Save links</Button>
            </form>
          </Panel>
        </div>
      </div>
    </PageFrame>
  );
}
