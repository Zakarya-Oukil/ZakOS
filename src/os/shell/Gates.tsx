import { OwnerAvatar } from './OwnerAvatar';
import { useState, type FormEvent } from 'react';
import { LockSimple } from '@phosphor-icons/react';
import { PageFrame } from './PageFrame';
import { Button, ErrorNote, Field, Panel, inputCls } from '../ui';
import { api } from '../lib/api';
import { AUTH_EVENT } from '../lib/useAuth';
import type { LicenceInfo } from '../lib/useLicence';
import type { OsModule } from '../modules/registry';

/** Shown in place of a page that needs a higher plan. The page's data is untouched. */
export function Locked({ module: m, info }: { module: OsModule; info: LicenceInfo | null }) {
  const need = m.premium === 'team' ? 'Team' : 'Pro';
  return (
    <PageFrame title={m.label}>
      <div className="grid h-full place-items-center p-6">
        <Panel className="max-w-lg" title={`${m.label} is part of the ${need} plan`}>
          <div className="grid gap-4">
            <p className="flex items-start gap-3 text-[15px] leading-relaxed text-os-text">
              <LockSimple size={26} aria-hidden className="mt-0.5 shrink-0 text-os-cyan" />
              {m.description}
            </p>
            <p className="text-sm leading-relaxed text-os-muted">
              Everything you already have keeps working and nothing is deleted. Activate a licence key to open this page.
            </p>
            <div className="flex flex-wrap gap-2">
              <a href="#/licence">
                <Button variant="primary">Enter a licence key</Button>
              </a>
              {info?.buyUrl && (
                <a href={info.buyUrl} target="_blank" rel="noreferrer">
                  <Button>See the plans</Button>
                </a>
              )}
            </div>
          </div>
        </Panel>
      </div>
    </PageFrame>
  );
}

/** Full-screen sign-in, shown only after the owner has turned sign-in on. */
export function SignIn() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/api/auth/login', { method: 'POST', body: { name, password } });
      window.dispatchEvent(new Event(AUTH_EVENT));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-[100dvh] place-items-center p-6">
      <Panel className="w-full max-w-sm" title="Sign in to Zak OS">
        <form onSubmit={submit} className="grid gap-4">
          <OwnerAvatar size={56} />
          <Field label="Name" htmlFor="si-name">
            <input id="si-name" autoFocus autoComplete="username" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Password" htmlFor="si-pw">
            <input id="si-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
          </Field>
          {error && <ErrorNote>{error}</ErrorNote>}
          <Button type="submit" variant="primary" disabled={busy || !name || !password}>
            Sign in
          </Button>
        </form>
      </Panel>
    </div>
  );
}
