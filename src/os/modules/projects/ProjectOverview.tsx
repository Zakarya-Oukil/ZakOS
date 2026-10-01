import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowSquareOut } from '@phosphor-icons/react';
import { Button, ErrorNote, Field, Panel, SuccessNote, inputCls, textareaCls } from '../../ui';
import { api, useResource } from '../../lib/api';
import { timeAgo, type ProjectInfo } from '../../lib/projectsApi';
import { agentsApi } from '../agents/api';
import { PageFrame } from '../../shell/PageFrame';

export interface Meta {
  group: string;
  tags: string[];
  archived: boolean;
  defaultAgent: string;
  vaultFolder: string;
  notes: string;
  autoGraph: boolean;
  pinned: boolean;
}

interface Gh {
  issues: Array<{ number: number; title: string; author: { login: string }; url: string; updatedAt: string }>;
  prs: Array<{ number: number; title: string; author: { login: string }; headRefName: string; url: string; isDraft: boolean; reviewDecision: string; updatedAt: string }>;
}

export function ProjectOverview({ project, navigate }: { project: ProjectInfo; navigate: (...parts: string[]) => void }) {
  const overview = useResource<{ meta: Meta; vaultNotes: Array<{ title: string; relativePath: string; updated?: string }> }>(`/api/project-meta/${project.id}/overview`);
  const gh = useResource<Gh>(`/api/project-meta/${project.id}/github`);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [tags, setTags] = useState('');
  const [instr, setInstr] = useState<string | null>(null);
  const [instrSaved, setInstrSaved] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (overview.data) {
      setMeta(overview.data.meta);
      setTags(overview.data.meta.tags.join(', '));
    }
  }, [overview.data]);

  useEffect(() => {
    api<{ content: string }>(`/api/project-meta/${project.id}/instructions`)
      .then((d) => {
        setInstr(d.content);
        setInstrSaved(d.content);
      })
      .catch(() => setInstr(''));
  }, [project.id]);

  const saveMeta = async () => {
    if (!meta) return;
    setMsg(null);
    try {
      await api(`/api/project-meta/${project.id}`, { method: 'PUT', body: { ...meta, tags: tags.split(',').map((t) => t.trim()).filter(Boolean) } });
      setMsg({ ok: true, text: 'Saved.' });
      overview.reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  const saveInstr = async () => {
    setMsg(null);
    try {
      await api(`/api/project-meta/${project.id}/instructions`, { method: 'PUT', body: { content: instr ?? '' } });
      setInstrSaved(instr ?? '');
      setMsg({ ok: true, text: 'CLAUDE.md saved in the project folder.' });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  const session = async () => {
    try {
      const s = await agentsApi.create(meta?.defaultAgent ?? 'claude', project.path);
      navigate('agents', meta?.defaultAgent ?? 'claude', s.id);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  const toTask = async (title: string, url: string) => {
    try {
      await api('/api/tasks', { method: 'POST', body: { title, body: url, project: project.id } });
      setMsg({ ok: true, text: 'Added to the Tasks board.' });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  return (
    <PageFrame
      title={project.name}
      leading={
        <button type="button" onClick={() => navigate('projects')} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm text-os-muted hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]">
          <ArrowLeft size={14} aria-hidden /> All projects
        </button>
      }
      actions={
        <Button size="sm" variant="primary" onClick={session}>New session</Button>
      }
    >
      <div className="h-full overflow-y-auto p-5">
        <div className="mx-auto grid max-w-[1100px] gap-5">
          <p className="break-all font-os-mono text-xs text-os-muted">{project.path}</p>
          {msg && (msg.ok ? <SuccessNote>{msg.text}</SuccessNote> : <ErrorNote>{msg.text}</ErrorNote>)}

          <div className="flex flex-wrap gap-2">
            {(['git', 'dev', 'files', 'brain'] as const).map((m) => (
              <Button key={m} size="sm" onClick={() => navigate(m, project.id)}>{m === 'git' ? 'Git' : m === 'dev' ? 'Run and health' : m === 'files' ? 'Files' : 'Graph'}</Button>
            ))}
          </div>

          <div className="grid items-start gap-5 lg:grid-cols-2">
            <Panel title="About this project">
              {!meta ? <p className="text-sm text-os-muted">Loading</p> : (
                <div className="grid gap-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Group" htmlFor="pm-group" hint="For example Client work or Experiments.">
                      <input id="pm-group" value={meta.group} onChange={(e) => setMeta({ ...meta, group: e.target.value })} className={inputCls} />
                    </Field>
                    <Field label="Default agent" htmlFor="pm-agent">
                      <select id="pm-agent" value={meta.defaultAgent} onChange={(e) => setMeta({ ...meta, defaultAgent: e.target.value })} className="w-full">
                        <option value="claude">Claude Code</option>
                        <option value="hermes">Hermes</option>
                        <option value="antigravity">Antigravity</option>
                      </select>
                    </Field>
                  </div>
                  <Field label="Tags" htmlFor="pm-tags" hint="Separated by commas.">
                    <input id="pm-tags" value={tags} onChange={(e) => setTags(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Linked vault folder" htmlFor="pm-vault" hint="A folder inside your Obsidian vault, like 02 Coding Projects/Web Development/My App. Its newest notes show below.">
                    <input id="pm-vault" value={meta.vaultFolder} onChange={(e) => setMeta({ ...meta, vaultFolder: e.target.value })} className={inputCls} />
                  </Field>
                  <label className="flex cursor-pointer items-center gap-2.5 text-sm text-os-text">
                    <input type="checkbox" checked={meta.pinned} onChange={(e) => setMeta({ ...meta, pinned: e.target.checked })} />
                    Pin to Home
                  </label>
                  <label className="flex cursor-pointer items-start gap-2.5 text-sm text-os-text">
                    <input type="checkbox" checked={meta.autoGraph} onChange={(e) => setMeta({ ...meta, autoGraph: e.target.checked })} className="mt-0.5" />
                    <span>Rebuild the graph after every commit<span className="block text-xs text-os-muted">Uses graphify's code pass: no AI credits. Needs Python and graphify installed.</span></span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2.5 text-sm text-os-text">
                    <input type="checkbox" checked={meta.archived} onChange={(e) => setMeta({ ...meta, archived: e.target.checked })} />
                    Archived (hidden from the main list and the Home map)
                  </label>
                  <Button size="sm" variant="primary" className="justify-self-start" onClick={saveMeta}>Save</Button>
                </div>
              )}
            </Panel>

            <Panel title="Standing instructions (CLAUDE.md)">
              <div className="grid gap-3">
                <p className="max-w-[60ch] text-sm leading-relaxed text-os-muted">Claude Code reads this file at the start of every session in this folder. Put conventions, commands and things not to touch here.</p>
                <label htmlFor="pm-instr" className="sr-only">CLAUDE.md contents</label>
                <textarea id="pm-instr" rows={10} value={instr ?? ''} onChange={(e) => setInstr(e.target.value)} placeholder="# Project rules" spellCheck={false} className={textareaCls + ' font-os-mono text-xs'} />
                <Button size="sm" variant="primary" className="justify-self-start" disabled={instr === instrSaved} onClick={saveInstr}>Save CLAUDE.md</Button>
              </div>
            </Panel>
          </div>

          <div className="grid items-start gap-5 lg:grid-cols-2">
            <Panel title="GitHub issues" padded={false}>
              {gh.error && <p className="p-4 text-sm text-os-muted">{gh.error}</p>}
              {gh.data && gh.data.issues.length === 0 && <p className="p-4 text-sm text-os-muted">No open issues.</p>}
              <ul>
                {gh.data?.issues.map((i) => (
                  <li key={i.number} className="flex items-center gap-3 border-t border-os-line px-4 py-2.5 first:border-t-0">
                    <div className="min-w-0 flex-1">
                      <a href={i.url} target="_blank" rel="noreferrer" className="block truncate text-sm text-os-text hover:text-os-cyan">#{i.number} {i.title}</a>
                      <span className="text-xs text-os-muted">{i.author?.login}, {timeAgo(Date.parse(i.updatedAt))}</span>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => toTask(`#${i.number} ${i.title}`, i.url)}>Add to Tasks</Button>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Pull requests" padded={false}>
              {gh.data && gh.data.prs.length === 0 && <p className="p-4 text-sm text-os-muted">No open pull requests.</p>}
              {!gh.data && !gh.error && <p className="p-4 text-sm text-os-muted">Asking GitHub</p>}
              <ul>
                {gh.data?.prs.map((p) => (
                  <li key={p.number} className="border-t border-os-line px-4 py-2.5 first:border-t-0">
                    <a href={p.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 truncate text-sm text-os-text hover:text-os-cyan">#{p.number} {p.title}{p.isDraft ? ' (draft)' : ''} <ArrowSquareOut size={12} aria-hidden /></a>
                    <span className="text-xs text-os-muted">{p.author?.login}, {p.headRefName}, {p.reviewDecision ? p.reviewDecision.toLowerCase().replace('_', ' ') : 'no review yet'}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          {overview.data && overview.data.vaultNotes.length > 0 && (
            <Panel title="Newest notes in the linked vault folder" padded={false}>
              <ul>
                {overview.data.vaultNotes.map((n) => (
                  <li key={n.relativePath} className="flex items-baseline justify-between gap-3 border-t border-os-line px-4 py-2 first:border-t-0">
                    <span className="min-w-0 truncate text-sm text-os-text">{n.title}</span>
                    <span className="shrink-0 text-xs text-os-muted">{n.updated ? timeAgo(Date.parse(n.updated)) : ''}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </PageFrame>
  );
}
