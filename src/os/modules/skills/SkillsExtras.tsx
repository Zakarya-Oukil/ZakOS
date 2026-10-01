import { useState } from 'react';
import { Warning } from '@phosphor-icons/react';
import { Button, ErrorNote, Field, Panel, SuccessNote, inputCls, textareaCls } from '../../ui';
import { api } from '../../lib/api';

interface Fetched {
  content: string;
  name: string;
  description: string;
  flags: string[];
  source: string;
}

/** Bring a skill in from a GitHub or GitLab link. The review comes first and nothing is installed until you say so. */
export function ImportSkill({ scopes, onDone, onClose }: { scopes: Array<{ id: string; label: string }>; onDone: (scope: string, name: string) => void; onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [got, setGot] = useState<Fetched | null>(null);
  const [name, setName] = useState('');
  const [scope, setScope] = useState('user');
  const [sure, setSure] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchIt = async () => {
    setBusy(true);
    setError(null);
    setGot(null);
    try {
      const d = await api<Fetched>('/api/skills-x/fetch', { method: 'POST', body: { url } });
      setGot(d);
      setName(d.name);
      setSure(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const install = async () => {
    if (!got) return;
    setBusy(true);
    setError(null);
    try {
      await api('/api/skills-x/install', { method: 'POST', body: { name, scope, content: got.content } });
      onDone(scope, name);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-3 grid gap-3 rounded-[var(--os-radius)] border border-os-line p-3">
      <Field label="Link to a SKILL.md" htmlFor="imp-url" hint="A GitHub or GitLab file link. The text is fetched and shown to you before anything is saved.">
        <input id="imp-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com/owner/repo/blob/main/skills/review/SKILL.md" className={inputCls + ' h-9 text-xs'} />
      </Field>
      <div className="flex gap-2">
        <Button size="sm" variant="primary" onClick={fetchIt} disabled={busy || !url.trim()}>{busy && !got ? 'Fetching' : 'Fetch and review'}</Button>
        <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      {got && (
        <div className="grid gap-3">
          {got.flags.length > 0 ? (
            <div role="alert" className="rounded-[var(--os-radius)] border border-os-amber p-3">
              <p className="flex items-center gap-2 text-sm font-medium text-os-text"><Warning size={16} aria-hidden className="text-os-amber" /> Look at these before you install</p>
              <ul className="mt-1.5 grid gap-1 pl-6 text-xs text-os-text [list-style:disc]">
                {got.flags.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          ) : (
            <SuccessNote>Nothing in it looked unusual. Still read it, a skill is instructions your agent follows.</SuccessNote>
          )}
          <label htmlFor="imp-body" className="sr-only">The skill text</label>
          <textarea id="imp-body" readOnly value={got.content} rows={10} className={textareaCls + ' font-os-mono text-xs'} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" htmlFor="imp-name">
              <input id="imp-name" value={name} onChange={(e) => setName(e.target.value.toLowerCase())} className={inputCls + ' h-9 font-os-mono'} />
            </Field>
            <Field label="Install for" htmlFor="imp-scope">
              <select id="imp-scope" value={scope} onChange={(e) => setScope(e.target.value)} className="w-full">
                {scopes.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </Field>
          </div>
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-os-text">
            <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} className="mt-0.5" />
            I read it and I trust where it came from.
          </label>
          <Button size="sm" variant="primary" className="justify-self-start" disabled={!sure || !name || busy} onClick={install}>Install this skill</Button>
        </div>
      )}
    </div>
  );
}

/** Run the skill's text against a sample request, with no tools, and show what Claude says it would do. */
export function TrySkill({ scope, name }: { scope: string; name: string }) {
  const [sample, setSample] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setError(null);
    setAnswer(null);
    try {
      const d = await api<{ answer: string }>('/api/skills-x/try', { method: 'POST', body: { scope, name, sample } });
      setAnswer(d.answer);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Try it on a sample request">
      <div className="grid gap-3">
        <p className="text-xs leading-relaxed text-os-muted">Claude reads this skill and answers in text only, with no tools and no files touched. It uses a little of your Claude plan.</p>
        <label htmlFor="try-sample" className="sr-only">Sample request</label>
        <textarea id="try-sample" rows={3} value={sample} onChange={(e) => setSample(e.target.value)} placeholder="Prepare release notes for version 2.1" className={textareaCls} />
        <Button size="sm" className="justify-self-start" onClick={run} disabled={busy || !sample.trim()}>{busy ? 'Trying' : 'Try the skill'}</Button>
        {error && <ErrorNote>{error}</ErrorNote>}
        {answer && <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-[var(--os-radius)] bg-os-bg p-3 font-os-sans text-sm leading-relaxed text-os-text">{answer}</pre>}
      </div>
    </Panel>
  );
}
