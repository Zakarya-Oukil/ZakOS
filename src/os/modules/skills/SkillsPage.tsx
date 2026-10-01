import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, FloppyDisk, LinkSimple, Plus, Trash } from '@phosphor-icons/react';
import type { ModuleProps } from '../registry';
import { PageFrame } from '../../shell/PageFrame';
import { ImportSkill, TrySkill } from './SkillsExtras';
import { cx } from '../../ui/cx';
import { timeAgo } from '../../lib/projectsApi';
import { skillsApi, type SkillDetail, type SkillInfo } from './api';

const btn =
  'inline-flex h-9 items-center gap-2 rounded-full border border-os-line bg-os-surface-2 px-4 text-sm text-os-text transition-colors ' +
  'hover:border-os-cyan focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50';
const field =
  'rounded-[var(--os-input-radius)] border border-os-line bg-os-bg px-3 text-sm text-os-text placeholder:text-os-muted focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]';

function Switch({ on, label, disabled, onChange }: { on: boolean; label: string; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cx(
        'relative h-5 w-9 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] disabled:cursor-not-allowed disabled:opacity-40',
        on ? 'border-os-cyan bg-os-cyan' : 'border-os-line bg-os-surface-2',
      )}
    >
      <span className={cx('absolute top-0.5 h-3.5 w-3.5 rounded-full bg-os-bg transition-[left]', on ? 'left-[18px]' : 'left-0.5 !bg-os-muted')} />
    </button>
  );
}

export default function SkillsPage({ route, navigate }: ModuleProps) {
  const [skills, setSkills] = useState<SkillInfo[] | null>(null);
  const [scopes, setScopes] = useState<Array<{ id: string; label: string }>>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [usage, setUsage] = useState<Record<string, number>>({});
  useEffect(() => {
    fetch('/api/skills-x/usage').then((r) => r.json()).then((d) => d.success && setUsage(d.counts)).catch(() => undefined);
  }, []);
  const [form, setForm] = useState({ scope: 'user', name: '', description: '' });

  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [scope, name] = [route[0], route[1]];

  const refresh = useCallback(() => {
    skillsApi
      .list()
      .then((r) => {
        setSkills(r.skills);
        setScopes(r.scopes);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(refresh, [refresh]);

  const current = useMemo(() => skills?.find((s) => s.scope === scope && s.name === name), [skills, scope, name]);

  useEffect(() => {
    setDetail(null);
    setNotice(null);
    setDeleting(false);
    setConfirmDelete('');
    if (!scope || !name) return;
    skillsApi
      .get(scope, name)
      .then((d) => {
        setDetail(d);
        setDraft(d.content);
      })
      .catch((e: Error) => setNotice(e.message));
  }, [scope, name]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (skills ?? []).filter((s) => !q || s.name.includes(q) || s.description.toLowerCase().includes(q));
  }, [skills, query]);

  const groups = useMemo(() => {
    const map = new Map<string, SkillInfo[]>();
    for (const s of filtered) map.set(s.scopeLabel, [...(map.get(s.scopeLabel) ?? []), s]);
    return [...map.entries()];
  }, [filtered]);

  const dirty = detail !== null && draft !== detail.content;
  const readOnly = detail?.linked ?? false;

  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setNotice(null);
    try {
      await fn();
      if (done) setNotice(done);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      refresh();
    }
  };

  const create = async () => {
    setNotice(null);
    try {
      const n = form.name.trim().toLowerCase();
      await skillsApi.create(form.scope, n, form.description);
      setCreating(false);
      setForm({ scope: form.scope, name: '', description: '' });
      refresh();
      navigate('skills', form.scope, n);
    } catch (e) {
      setNotice((e as Error).message);
    }
  };

  return (
    <PageFrame
      title="Skills"
      actions={
        <>
          <button type="button" className={btn} onClick={() => { setImporting((v) => !v); setCreating(false); setNotice(null); }}>
            Import from a link
          </button>
          <button type="button" className={btn} onClick={() => { setCreating((v) => !v); setImporting(false); setNotice(null); }}>
            <Plus size={14} aria-hidden /> New skill
          </button>
        </>
      }
    >
      <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-y-auto border-r border-os-line p-3" aria-label="Skills">
          {importing && (
            <ImportSkill
              scopes={scopes}
              onClose={() => setImporting(false)}
              onDone={(sc, n) => {
                setImporting(false);
                refresh();
                navigate('skills', sc, n);
              }}
            />
          )}
          {creating && (
            <form
              className="mb-3 grid gap-2 rounded-[var(--os-radius)] border border-os-line p-3"
              onSubmit={(e) => {
                e.preventDefault();
                void create();
              }}
            >
              <label htmlFor="sk-scope" className="text-xs text-os-muted">Where</label>
              <select id="sk-scope" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} className={cx(field, 'h-8')}>
                {scopes.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
              <label htmlFor="sk-name" className="text-xs text-os-muted">Name (lowercase, dashes)</label>
              <input id="sk-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="release-notes" className={cx(field, 'h-8 font-os-mono')} />
              <label htmlFor="sk-desc" className="text-xs text-os-muted">When should Claude use it?</label>
              <textarea id="sk-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Write release notes from the git log when asked to prepare a release" className={cx(field, 'resize-y py-1.5')} />
              <div className="flex gap-2">
                <button type="submit" className={btn} disabled={!form.name.trim() || !form.description.trim()}>Create</button>
                <button type="button" className={btn} onClick={() => setCreating(false)}>Cancel</button>
              </div>
            </form>
          )}
          <label htmlFor="sk-search" className="sr-only">Search skills</label>
          <input id="sk-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search skills" className={cx(field, 'mb-3 h-8 w-full')} />
          {error && <p className="mb-2 text-xs text-os-danger" role="alert">{error}</p>}
          {!skills && !error && <p className="text-sm text-os-muted">Loading</p>}
          {skills && groups.length === 0 && (
            <p className="text-sm text-os-muted">{query ? 'No skills match.' : 'No skills yet. A skill is a SKILL.md file that teaches Claude a repeatable job. Create one to start.'}</p>
          )}
          {groups.map(([label, list]) => (
            <section key={label} className="mb-4">
              <h2 className="mb-1 text-xs font-medium text-os-muted">{label}</h2>
              <ul className="grid gap-0.5">
                {list.map((s) => (
                  <li key={`${s.scope}:${s.name}`} className={cx('flex items-start gap-2 rounded-[var(--os-radius)] px-2 py-2', s.scope === scope && s.name === name ? 'bg-os-surface-2' : 'hover:bg-os-surface-2')}>
                    <a
                      href={`#/skills/${encodeURIComponent(s.scope)}/${encodeURIComponent(s.name)}`}
                      aria-current={s.scope === scope && s.name === name ? 'page' : undefined}
                      className={cx('min-w-0 flex-1 focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]', !s.enabled && 'opacity-60')}
                    >
                      <span className="flex items-center gap-1.5 text-sm text-os-text">
                        <span className="truncate font-os-mono text-[13px]">{s.name}</span>
                        {s.linked && <LinkSimple size={12} aria-label="Linked from another folder, read-only" className="shrink-0 text-os-muted" />}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-os-muted">{s.description || 'No description'}</span>
                      {usage[s.name] ? <span className="mt-0.5 block text-[11px] text-os-muted">Used {usage[s.name]} time{usage[s.name] === 1 ? '' : 's'} by agents</span> : null}
                    </a>
                    <Switch on={s.enabled} label={`${s.enabled ? 'Disable' : 'Enable'} ${s.name}`} disabled={s.linked} onChange={(v) => void run(() => skillsApi.setEnabled(s.scope, s.name, v))} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </aside>

        <section className="hidden min-h-0 min-w-0 flex-col lg:flex" aria-label="Skill editor">
          {!scope || !name ? (
            <p className="p-6 text-sm text-os-muted">Pick a skill to read or edit it. Claude loads enabled skills by their description, so a clear description is what makes one get used.</p>
          ) : !detail ? (
            <p className="p-6 text-sm text-os-muted">{notice ?? 'Loading'}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-os-line px-4 py-2">
                <h2 className="font-os-mono text-sm text-os-text">{name}</h2>
                <span className="text-xs text-os-muted">
                  {current?.scopeLabel}
                  {current ? ` · updated ${timeAgo(current.updated)}` : ''}
                </span>
                <span className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    className={btn}
                    onClick={() => void navigator.clipboard?.writeText(`/${name}`).then(() => setNotice(`Copied /${name}`)).catch(() => setNotice('Clipboard is not available here.'))}
                  >
                    <Copy size={14} aria-hidden /> Copy /{name}
                  </button>
                  <a className={btn} href={`/api/skills-x/export/${encodeURIComponent(scope)}/${encodeURIComponent(name)}`} download>Export file</a>
                  <button type="button" className={btn} disabled={readOnly || !dirty} onClick={() => void run(async () => { await skillsApi.save(scope, name, draft); setDetail({ ...detail, content: draft }); }, 'Saved.')}>
                    <FloppyDisk size={14} aria-hidden /> Save
                  </button>
                </span>
              </div>
              {notice && <p role="status" className="border-b border-os-line px-4 py-1.5 text-xs text-os-amber">{notice}</p>}
              {readOnly && <p className="border-b border-os-line px-4 py-1.5 text-xs text-os-muted">This skill is a link to another folder, so it is read-only here. Edit it where it lives.</p>}
              {!detail.enabled && <p className="border-b border-os-line px-4 py-1.5 text-xs text-os-muted">This skill is turned off. Claude cannot see it until you switch it on.</p>}
              <label htmlFor="sk-content" className="sr-only">SKILL.md</label>
              <textarea
                id="sk-content"
                value={draft}
                readOnly={readOnly}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    if (dirty && !readOnly) void run(async () => { await skillsApi.save(scope, name, draft); setDetail({ ...detail, content: draft }); }, 'Saved.');
                  }
                }}
                spellCheck={false}
                className="min-h-0 flex-1 resize-none border-0 bg-os-bg p-4 font-os-mono text-[13px] leading-relaxed text-os-text focus-visible:outline-none"
              />
              <div className="border-t border-os-line p-4"><TrySkill key={`${scope}/${name}`} scope={scope} name={name} /></div>
              <div className="grid gap-2 border-t border-os-line px-4 py-2">
                {detail.files.length > 1 && (
                  <p className="text-xs text-os-muted">
                    Also in this folder: {detail.files.filter((f) => f.path !== 'SKILL.md' && f.path !== 'SKILL.md.disabled').slice(0, 8).map((f) => f.path).join(', ')}
                    {detail.files.length > 9 ? ` and ${detail.files.length - 9} more` : ''}
                  </p>
                )}
                {dirty && <p className="text-xs text-os-amber">Unsaved changes. Ctrl+S saves.</p>}
                {!readOnly &&
                  (deleting ? (
                    <form
                      className="flex flex-wrap items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (confirmDelete === name) void run(async () => { await skillsApi.remove(scope, name); navigate('skills'); });
                      }}
                    >
                      <label htmlFor="sk-del" className="text-xs text-os-danger">Type {name} to delete the whole folder</label>
                      <input id="sk-del" autoFocus value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} className={cx(field, 'h-7 w-48 font-os-mono text-xs')} />
                      <button type="submit" className={cx(btn, 'h-7 text-os-danger')} disabled={confirmDelete !== name}>Delete</button>
                      <button type="button" className={cx(btn, 'h-7')} onClick={() => setDeleting(false)}>Cancel</button>
                    </form>
                  ) : (
                    <button type="button" className={cx(btn, 'w-fit text-os-muted hover:text-os-danger')} onClick={() => setDeleting(true)}>
                      <Trash size={14} aria-hidden /> Delete skill
                    </button>
                  ))}
              </div>
            </>
          )}
        </section>
      </div>
    </PageFrame>
  );
}
