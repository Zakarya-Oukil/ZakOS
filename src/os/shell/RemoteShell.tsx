import { useCallback, useEffect, useState } from 'react';
import { Check, X } from '@phosphor-icons/react';
import { Button, ErrorNote, Panel } from '../ui';
import { api } from '../lib/api';
import { timeAgo } from '../lib/projectsApi';
import { AUTH_EVENT, useAuth } from '../lib/useAuth';
import { SignIn } from './Gates';

interface Pending {
  id: string;
  summary: string;
  project: string;
  ts: number;
  sessionTitle?: string;
}

/** What a phone sees: one column with the pending approvals and nothing else. Used when the page is not opened on this machine. */
export function RemoteShell() {
  const auth = useAuth();
  const [items, setItems] = useState<Pending[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ approvals: Pending[] }>('/api/remote/approvals')
      .then((d) => {
        setItems(d.approvals);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!auth.user) return;
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [auth.user, load]);

  const decide = async (id: string, what: 'approve' | 'dismiss') => {
    setBusy(id);
    try {
      await api(`/api/remote/approvals/${id}/${what}`, { method: 'POST' });
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const signOut = async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    window.dispatchEvent(new Event(AUTH_EVENT));
  };

  if (!auth.loaded) return null;
  if (!auth.enabled)
    return (
      <main className="grid min-h-[100dvh] place-items-center p-6">
        <Panel title="Remote access is not set up" className="max-w-sm">
          <p className="text-sm leading-relaxed text-os-muted">Sign-in is off on the host machine, so remote approvals are refused. Turn on sign-in in the Team tab there.</p>
        </Panel>
      </main>
    );
  if (!auth.user) return <SignIn />;

  return (
    <main className="mx-auto grid min-h-[100dvh] w-full max-w-lg content-start gap-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="font-os-sans text-[22px] font-extrabold tracking-tight text-os-text">Approvals</h1>
        <Button size="sm" variant="ghost" onClick={signOut}>Sign out</Button>
      </header>
      {error && <ErrorNote>{error}</ErrorNote>}
      {items.length === 0 && !error && <p className="py-10 text-center text-sm text-os-muted">Nothing is waiting for you.</p>}
      <ul className="grid gap-3">
        {items.map((a) => (
          <li key={a.id}>
            <Panel title={a.project}>
              <p className="text-[15px] leading-snug text-os-text">{a.summary}</p>
              <p className="mt-1 text-xs text-os-muted">{a.sessionTitle ? `${a.sessionTitle}, ` : ''}{timeAgo(a.ts)}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant="primary" disabled={busy === a.id || auth.user?.role === 'viewer'} onClick={() => decide(a.id, 'approve')} className="h-12">
                  <Check size={18} aria-hidden /> Approve
                </Button>
                <Button disabled={busy === a.id || auth.user?.role === 'viewer'} onClick={() => decide(a.id, 'dismiss')} className="h-12">
                  <X size={18} aria-hidden /> Dismiss
                </Button>
              </div>
            </Panel>
          </li>
        ))}
      </ul>
    </main>
  );
}
