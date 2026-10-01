import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { LockKey, LockKeyOpen } from '@phosphor-icons/react';
import { Button, ErrorNote, Field, Panel, inputCls } from '../../ui';
import { api } from '../../lib/api';

interface Status {
  exists: boolean;
  unlocked: boolean;
}

/** Shows children only while the encrypted secrets store is unlocked; otherwise asks for the master password. */
export function SecretsGate({ children, onChange }: { children: ReactNode; onChange?: (unlocked: boolean) => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    api<Status>('/api/secrets/status')
      .then((s) => {
        setStatus(s);
        onChange?.(s.unlocked);
      })
      .catch((e: Error) => setError(e.message));
  }, [onChange]);

  useEffect(refresh, [refresh]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!status) return;
    setError(null);
    if (!status.exists && password !== confirm) return setError('The two passwords do not match.');
    setBusy(true);
    try {
      await api(status.exists ? '/api/secrets/unlock' : '/api/secrets/init', { method: 'POST', body: { password } });
      setPassword('');
      setConfirm('');
      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const lock = async () => {
    await api('/api/secrets/lock', { method: 'POST' }).catch(() => undefined);
    refresh();
  };

  if (!status) return null;
  if (status.unlocked)
    return (
      <div className="grid gap-4">
        <div className="flex items-center justify-between rounded-[var(--os-radius)] border border-os-line px-4 py-2.5">
          <p className="flex items-center gap-2 text-sm text-os-text">
            <LockKeyOpen size={18} aria-hidden /> Secrets are unlocked. They lock again after 15 minutes of no use.
          </p>
          <Button size="sm" variant="ghost" onClick={lock}>
            Lock now
          </Button>
        </div>
        {children}
      </div>
    );

  return (
    <Panel title={status.exists ? 'Unlock your secrets' : 'Protect your tokens'} className="max-w-xl">
      <form onSubmit={submit} className="grid gap-4">
        <p className="flex items-start gap-3 text-sm leading-relaxed text-os-muted">
          <LockKey size={22} aria-hidden className="mt-0.5 shrink-0 text-os-text" />
          {status.exists
            ? 'Tokens and webhook URLs are kept in an encrypted file. Enter your master password to use them.'
            : 'Tokens and webhook URLs go into an encrypted file on this machine. Choose a master password. It is never stored, so if you forget it the file cannot be recovered.'}
        </p>
        <Field label="Master password" htmlFor="sg-pw">
          <input id="sg-pw" type="password" autoComplete={status.exists ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
        </Field>
        {!status.exists && (
          <Field label="Repeat the password" htmlFor="sg-pw2" hint="At least 8 characters.">
            <input id="sg-pw2" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
          </Field>
        )}
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button type="submit" variant="primary" className="justify-self-start" disabled={busy || !password}>
          {status.exists ? 'Unlock' : 'Create the store'}
        </Button>
      </form>
    </Panel>
  );
}
