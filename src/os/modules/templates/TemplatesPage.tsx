import { useRef, useState } from 'react';
import { DownloadSimple, UploadSimple } from '@phosphor-icons/react';
import type { ModuleProps } from '../registry';
import { PageFrame } from '../../shell/PageFrame';
import { Button, ErrorNote, Field, Panel, Segmented, SuccessNote, inputCls } from '../../ui';
import { api } from '../../lib/api';
import { projectsApi } from '../../lib/projectsApi';
import { useAppearance, type Appearance } from '../../theme/appearance';
import { KIND_LABEL, LIBRARY, type Item, type Kind } from './library';

export default function TemplatesPage(_props: ModuleProps) {
  const { update } = useAppearance();
  const [kind, setKind] = useState<Kind>('workflow');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [scaffold, setScaffold] = useState<{ item: Item; name: string; parent: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const say = (ok: boolean, text: string) => setMsg({ ok, text });

  const install = async (item: Item) => {
    setBusy(item.id);
    setMsg(null);
    try {
      if (item.kind === 'prompt') {
        await api('/api/prompts', { method: 'POST', body: { name: item.title, text: item.body } });
        say(true, `Saved "${item.title}" to your prompt library. Type / in a prompt box to use it.`);
      } else if (item.kind === 'skill') {
        const d = await api<{ scopes: Array<{ id: string }> }>('/api/skills');
        const scope = d.scopes.find((s) => s.id === 'user')?.id ?? d.scopes[0]?.id;
        if (!scope) throw new Error('No skill folder is available');
        await api('/api/skills', { method: 'POST', body: { scope, name: item.extra!.name, description: item.extra!.description, body: item.body } });
        say(true, `Installed the skill ${item.extra!.name}. Switch it on or off in Skills.`);
      } else if (item.kind === 'workflow') {
        const projects = await projectsApi.list();
        if (!projects[0]) throw new Error('Add a project first. A workflow template needs a folder to run in.');
        await api('/api/workflow-templates', { method: 'POST', body: { name: item.title, goal: item.body, cwd: projects[0].path, projectId: projects[0].id } });
        say(true, `Saved the workflow "${item.title}" for ${projects[0].name}. Run or schedule it from Workflows.`);
      } else if (item.kind === 'theme') {
        update({ accent: item.extra!.accent, backdrop: item.extra!.backdrop as Appearance['backdrop'], motion: item.extra!.motion as Appearance['motion'] });
        say(true, `Applied the theme "${item.title}".`);
      } else if (item.kind === 'project') {
        setScaffold({ item, name: '', parent: '' });
      }
    } catch (e) {
      say(false, (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const create = async () => {
    if (!scaffold) return;
    setBusy('scaffold');
    try {
      await api('/api/scaffold', { method: 'POST', body: { starter: scaffold.item.extra!.starter, name: scaffold.name, parent: scaffold.parent } });
      say(true, `Created ${scaffold.name} and added it to Projects.`);
      setScaffold(null);
    } catch (e) {
      say(false, (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const pick = async () => {
    const p = await projectsApi.pickFolder('Where should the project go?').catch(() => null);
    if (p && scaffold) setScaffold({ ...scaffold, parent: p });
  };

  const exportAll = () => {
    const items = LIBRARY.filter((i) => i.kind === kind);
    const blob = new Blob([JSON.stringify({ app: 'zak-os-templates', kind, items }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `zak-os-${kind}-templates.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importFile = async (file: File) => {
    setMsg(null);
    try {
      const j = JSON.parse(await file.text()) as { app?: string; kind?: Kind; items?: Item[] };
      if (j.app !== 'zak-os-templates' || !Array.isArray(j.items)) throw new Error('That file is not a Zak OS template pack.');
      let done = 0;
      for (const it of j.items) {
        if (!it || typeof it.title !== 'string' || typeof it.body !== 'string' || !['workflow', 'skill', 'prompt', 'theme'].includes(it.kind)) continue;
        await install({ ...it, id: `imp-${done}` });
        done++;
      }
      say(true, `Imported ${done} item${done === 1 ? '' : 's'} from ${file.name}. Review them before you run anything.`);
    } catch (e) {
      say(false, (e as Error).message);
    }
  };

  const items = LIBRARY.filter((i) => i.kind === kind);

  return (
    <PageFrame
      title="Templates"
      actions={
        <>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" aria-label="Import a template pack" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
          <Button size="sm" onClick={() => fileRef.current?.click()}><UploadSimple size={15} aria-hidden /> Import</Button>
          <Button size="sm" onClick={exportAll}><DownloadSimple size={15} aria-hidden /> Export this tab</Button>
        </>
      }
    >
      <div className="h-full overflow-y-auto p-5">
        <div className="mx-auto grid max-w-[1100px] gap-5">
          <Segmented<Kind> label="Kind" value={kind} onChange={setKind} options={(Object.keys(KIND_LABEL) as Kind[]).map((k) => ({ id: k, label: KIND_LABEL[k] }))} />
          {msg && (msg.ok ? <SuccessNote>{msg.text}</SuccessNote> : <ErrorNote>{msg.text}</ErrorNote>)}

          {scaffold && (
            <Panel title={`New project from ${scaffold.item.title}`}>
              <div className="grid max-w-xl gap-4">
                <Field label="Project name" htmlFor="sc-name" hint="Letters, numbers, dash or underscore.">
                  <input id="sc-name" value={scaffold.name} onChange={(e) => setScaffold({ ...scaffold, name: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Create it inside" htmlFor="sc-parent">
                  <div className="flex gap-2">
                    <input id="sc-parent" value={scaffold.parent} onChange={(e) => setScaffold({ ...scaffold, parent: e.target.value })} placeholder="C:\\Users\\you\\Projects" className={inputCls} />
                    <Button type="button" size="sm" onClick={pick}>Browse</Button>
                  </div>
                </Field>
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" onClick={create} disabled={busy === 'scaffold' || !scaffold.name || !scaffold.parent}>Create project</Button>
                  <Button variant="ghost" size="sm" onClick={() => setScaffold(null)}>Cancel</Button>
                </div>
              </div>
            </Panel>
          )}

          <ul className="grid gap-4 md:grid-cols-2">
            {items.map((it) => (
              <li key={it.id}>
                <Panel title={it.title} className="h-full">
                  <div className="flex h-full flex-col justify-between gap-4">
                    <div>
                      <p className="text-sm leading-relaxed text-os-muted">{it.blurb}</p>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-os-muted hover:text-os-text">See exactly what it adds</summary>
                        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-[var(--os-radius)] bg-os-surface-2 p-3 font-os-mono text-xs leading-relaxed text-os-text">{it.body}</pre>
                      </details>
                    </div>
                    <Button size="sm" className="self-start" onClick={() => install(it)} disabled={busy === it.id}>
                      {it.kind === 'theme' ? 'Apply' : it.kind === 'project' ? 'Use this starter' : 'Install'}
                    </Button>
                  </div>
                </Panel>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </PageFrame>
  );
}
