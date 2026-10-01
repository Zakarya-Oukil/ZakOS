import { useState, type FormEvent } from 'react';
import { Trash } from '@phosphor-icons/react';
import type { ModuleProps } from '../registry';
import { PageFrame } from '../../shell/PageFrame';
import { Button, ErrorNote, Field, Panel, Segmented, SuccessNote, inputCls } from '../../ui';
import { api, useResource } from '../../lib/api';
import { timeAgo } from '../../lib/projectsApi';
import { AUTH_EVENT, useAuth } from '../../lib/useAuth';

type Role = 'owner' | 'operator' | 'viewer';
interface User {
  id: string;
  name: string;
  role: Role;
  created: number;
  last_login: number | null;
}
interface AuditEntry {
  id: number;
  ts: number;
  kind: string;
  actor: string;
  detail: string;
}

const ROLE_TEXT: Record<Role, string> = {
  owner: 'Everything, including accounts, secrets and integrations.',
  operator: 'Use agents, workflows, tasks and approvals. Cannot manage accounts or secrets.',
  viewer: 'Look but not change anything.',
};

export default function TeamPage(_props: ModuleProps) {
  const auth = useAuth();
  const users = useResource<{ users: User[] }>(auth.enabled && auth.user?.role === 'owner' ? '/api/auth/users' : null, [auth.enabled, auth.user?.id]);
  const activity = useResource<{ entries: AuditEntry[] }>(auth.enabled ? '/api/audit?q=&limit=40' : null, [auth.enabled]);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('operator');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [offPw, setOffPw] = useState('');

  const changed = () => {
    window.dispatchEvent(new Event(AUTH_EVENT));
    users.reload();
  };

  const setup = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api('/api/auth/setup', { method: 'POST', body: { name, password } });
      setName('');
      setPassword('');
      changed();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api('/api/auth/users', { method: 'POST', body: { name, password, role } });
      setNotice(`Added ${name}.`);
      setName('');
      setPassword('');
      users.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const setRoleFor = async (u: User, r: Role) => {
    setError(null);
    try {
      await api(`/api/auth/users/${u.id}`, { method: 'PATCH', body: { role: r } });
      users.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const remove = async (u: User) => {
    if (!window.confirm(`Remove ${u.name}? They are signed out at once.`)) return;
    setError(null);
    try {
      await api(`/api/auth/users/${u.id}`, { method: 'DELETE' });
      users.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const disable = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api('/api/auth/disable', { method: 'POST', body: { password: offPw } });
      setOffPw('');
      changed();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const signOut = async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    changed();
  };

  const isOwner = auth.user?.role === 'owner';
  const accountEvents = activity.data?.entries.filter((e) => e.kind.startsWith('auth-') || e.actor !== 'owner').slice(0, 15) ?? [];

  return (
    <PageFrame title="Team" actions={auth.user && <Button size="sm" variant="ghost" onClick={signOut}>Sign out {auth.user.name}</Button>}>
      <div className="h-full overflow-y-auto p-5">
        <div className="mx-auto grid max-w-[1000px] gap-5">
          {error && <ErrorNote>{error}</ErrorNote>}
          {notice && <SuccessNote>{notice}</SuccessNote>}

          {auth.loaded && !auth.enabled && (
            <Panel title="Turn on sign-in">
              <form onSubmit={setup} className="grid max-w-md gap-4">
                <p className="text-sm leading-relaxed text-os-muted">
                  Zak OS runs for one person by default. Create the owner account to turn on sign-in. After that every request needs a session, and you can add people with limited roles. Each person runs their own copy of Zak OS, so this protects shared machines and remote approvals, not a shared server.
                </p>
                <Field label="Your name" htmlFor="tm-name">
                  <input id="tm-name" autoComplete="username" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Password" htmlFor="tm-pw" hint="At least 8 characters.">
                  <input id="tm-pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
                </Field>
                <Button type="submit" variant="primary" className="justify-self-start" disabled={!name || password.length < 8}>Create the owner account</Button>
              </form>
            </Panel>
          )}

          {auth.enabled && isOwner && (
            <>
              <Panel title="People" padded={false}>
                <ul>
                  {users.data?.users.map((u) => (
                    <li key={u.id} className="flex flex-wrap items-center gap-3 border-t border-os-line px-4 py-3 first:border-t-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-medium text-os-text">{u.name}{u.id === auth.user?.id && <span className="ml-2 text-xs font-normal text-os-muted">you</span>}</p>
                        <p className="text-xs text-os-muted">{u.last_login ? `Last signed in ${timeAgo(u.last_login)}` : 'Never signed in'}</p>
                      </div>
                      <select aria-label={`Role for ${u.name}`} value={u.role} onChange={(e) => setRoleFor(u, e.target.value as Role)}>
                        <option value="owner">Owner</option>
                        <option value="operator">Operator</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <Button size="sm" variant="ghost" onClick={() => remove(u)} aria-label={`Remove ${u.name}`}>
                        <Trash size={15} aria-hidden /> Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel title="Add a person">
                <form onSubmit={add} className="grid max-w-xl gap-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Name" htmlFor="tm-n2">
                      <input id="tm-n2" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Password" htmlFor="tm-p2" hint="They can keep it. At least 8 characters.">
                      <input id="tm-p2" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
                    </Field>
                  </div>
                  <div className="grid gap-2">
                    <span className="text-[13px] font-medium text-os-text">Role</span>
                    <Segmented<Role> label="Role" value={role} onChange={setRole} options={[{ id: 'owner', label: 'Owner' }, { id: 'operator', label: 'Operator' }, { id: 'viewer', label: 'Viewer' }]} />
                    <p className="text-xs text-os-muted">{ROLE_TEXT[role]}</p>
                  </div>
                  <Button type="submit" variant="primary" size="sm" className="justify-self-start" disabled={!name || password.length < 8}>Add person</Button>
                </form>
              </Panel>

              <Panel title="Recent account activity" padded={false}>
                {accountEvents.length === 0 ? (
                  <p className="p-4 text-sm text-os-muted">Nothing yet.</p>
                ) : (
                  <ul>
                    {accountEvents.map((e) => (
                      <li key={e.id} className="flex items-baseline gap-3 border-t border-os-line px-4 py-2 text-sm first:border-t-0">
                        <span className="w-24 shrink-0 text-xs text-os-muted">{timeAgo(e.ts)}</span>
                        <span className="shrink-0 font-os-mono text-xs text-os-muted">{e.actor}</span>
                        <span className="min-w-0 flex-1 truncate text-os-text">{e.detail}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel title="Single sign-on">
                <p className="max-w-[68ch] text-sm leading-relaxed text-os-muted">
                  Google and GitHub sign-in need an OAuth app registered to your own domain, so it cannot work out of the box on a local install. It is part of a hosted setup and is not available here yet.
                </p>
              </Panel>

              <Panel title="Turn sign-in off">
                <form onSubmit={disable} className="grid max-w-sm gap-3">
                  <p className="text-sm text-os-muted">This removes every account and signs everyone out. Zak OS goes back to single-user mode. Your data stays.</p>
                  <Field label="Your password" htmlFor="tm-off">
                    <input id="tm-off" type="password" value={offPw} onChange={(e) => setOffPw(e.target.value)} className={inputCls} />
                  </Field>
                  <Button type="submit" size="sm" className="justify-self-start" disabled={!offPw}>Turn off sign-in</Button>
                </form>
              </Panel>
            </>
          )}

          {auth.enabled && auth.user && !isOwner && (
            <Panel title="Your account">
              <p className="text-sm text-os-text">You are signed in as {auth.user.name}, role {auth.user.role}.</p>
              <p className="mt-1 text-sm text-os-muted">{ROLE_TEXT[auth.user.role]}</p>
            </Panel>
          )}
        </div>
      </div>
    </PageFrame>
  );
}
