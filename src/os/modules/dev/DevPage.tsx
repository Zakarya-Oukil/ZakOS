import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, Info, Play, RefreshCw, Square, XCircle } from 'lucide-react';
import type { ModuleProps } from '../registry';
import { PageFrame } from '../../shell/PageFrame';
import { Panel, Tabs } from '../../ui';
import { cx } from '../../ui/cx';
import { projectsApi, type ProjectInfo } from '../../lib/projectsApi';
import { devApi, type AppState, type Check, type HeavyCheck, type HeavyResult, type Level, type ScriptInfo } from './api';

const btn =
  'inline-flex h-8 items-center gap-2 rounded-[var(--os-radius)] border border-os-line bg-os-surface-2 px-3 text-sm text-os-text transition-colors ' +
  'hover:border-os-cyan focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50';
const field =
  'rounded-[var(--os-radius)] border border-os-line bg-os-bg px-2 text-sm text-os-text placeholder:text-os-muted focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]';

type Tab = 'run' | 'health';
const TABS = [
  { id: 'run', label: 'Run and preview' },
  { id: 'health', label: 'Health' },
];

const LEVEL: Record<Level, { icon: typeof Info; tone: string; word: string }> = {
  pass: { icon: CheckCircle2, tone: 'text-os-cyan', word: 'Passed' },
  warn: { icon: AlertTriangle, tone: 'text-os-amber', word: 'Needs attention' },
  fail: { icon: XCircle, tone: 'text-os-danger', word: 'Failed' },
  info: { icon: Info, tone: 'text-os-muted', word: 'Note' },
};

// ---- run and preview ---------------------------------------------------------------------------

function RunTab({ projectId }: { projectId: string }) {
  const [scripts, setScripts] = useState<ScriptInfo[]>([]);
  const [state, setState] = useState<AppState | null>(null);
  const [script, setScript] = useState('');
  const [custom, setCustom] = useState('');
  const [log, setLog] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const offset = useRef(0);
  const logEl = useRef<HTMLPreElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    setLog('');
    setError(null);
    setState(null);
    offset.current = 0;
    devApi
      .app(projectId)
      .then((r) => {
        setScripts(r.scripts);
        setState(r.state);
        setScript(r.scripts[0]?.name ?? '');
      })
      .catch((e: Error) => setError(e.message));
  }, [projectId]);

  // Output is pulled every second while an app exists; the server keeps the log, so leaving and returning loses nothing.
  useEffect(() => {
    let live = true;
    const pull = () =>
      devApi
        .log(projectId, offset.current)
        .then((r) => {
          if (!live) return;
          if (r.text || r.reset) setLog((prev) => (r.reset ? r.text : prev + r.text).slice(-120_000));
          offset.current = r.next;
          setState(r.state);
        })
        .catch(() => {});
    void pull();
    const t = setInterval(pull, 1000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [projectId]);

  useEffect(() => {
    const el = logEl.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [log]);

  const running = state?.state === 'running';

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      setLog('');
      offset.current = 0;
      setState(await devApi.start(projectId, custom.trim() ? { command: custom.trim() } : { script }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    try {
      await devApi.stop(projectId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[minmax(340px,44%)_minmax(0,1fr)]">
      <div className="flex min-h-0 flex-col border-r border-os-line">
        <div className="grid gap-2 border-b border-os-line p-3">
          {scripts.length > 0 && (
            <>
              <label htmlFor="dev-script" className="text-xs text-os-muted">Script from package.json</label>
              <select id="dev-script" value={script} onChange={(e) => { setScript(e.target.value); setCustom(''); }} disabled={running} className={cx(field, 'h-8 font-os-mono')}>
                {scripts.map((s) => (
                  <option key={s.name} value={s.name}>{s.name}  ({s.command.slice(0, 50)})</option>
                ))}
              </select>
            </>
          )}
          <label htmlFor="dev-cmd" className="text-xs text-os-muted">{scripts.length > 0 ? 'Or a command of your own' : 'Command to run (no package.json scripts found)'}</label>
          <input id="dev-cmd" value={custom} onChange={(e) => setCustom(e.target.value)} disabled={running} placeholder="python -m http.server 8000" spellCheck={false} className={cx(field, 'h-8 font-os-mono')} />
          <div className="flex items-center gap-2">
            {running ? (
              <button type="button" className={cx(btn, 'border-os-amber text-os-amber')} disabled={busy} onClick={() => void stop()}>
                <Square size={13} aria-hidden /> Stop
              </button>
            ) : (
              <button type="button" className={btn} disabled={busy || (!custom.trim() && !script)} onClick={() => void start()}>
                <Play size={13} aria-hidden /> Start
              </button>
            )}
            <span className="min-w-0 truncate text-xs text-os-muted" role="status">
              {state ? (state.state === 'running' ? 'Running' : state.state === 'stopped' ? 'Stopped' : `Ended with code ${state.exitCode}`) : 'Not running'}
            </span>
          </div>
          {error && <p className="text-xs text-os-danger" role="alert">{error}</p>}
        </div>
        <pre
          ref={logEl}
          aria-label="Output"
          tabIndex={0}
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          }}
          className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words bg-os-bg p-3 font-os-mono text-xs leading-relaxed text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
        >
          {log || <span className="text-os-muted">Output appears here once the app starts.</span>}
        </pre>
      </div>

      <div className="hidden min-h-0 flex-col lg:flex">
        <div className="flex h-10 items-center gap-2 border-b border-os-line px-3 text-xs">
          <span className="min-w-0 flex-1 truncate font-os-mono text-os-muted">{state?.url ?? 'Waiting for the app to print its address'}</span>
          {state?.url && (
            <>
              <button type="button" className={cx(btn, 'h-7 w-7 justify-center px-0')} aria-label="Reload the preview" onClick={() => setFrameKey((k) => k + 1)}>
                <RefreshCw size={13} aria-hidden />
              </button>
              <a className={cx(btn, 'h-7')} href={state.url} target="_blank" rel="noreferrer">
                <ExternalLink size={13} aria-hidden /> Open in browser
              </a>
            </>
          )}
        </div>
        {state?.url && running ? (
          <iframe key={frameKey} title="App preview" src={state.url} sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals" className="min-h-0 flex-1 border-0 bg-white" />
        ) : (
          <p className="p-6 text-sm text-os-muted">{running ? 'The app is starting. The preview opens as soon as it prints a local address such as http://localhost:3000.' : 'Start the app to preview it here.'}</p>
        )}
      </div>
    </div>
  );
}

// ---- health ------------------------------------------------------------------------------------

const HEAVY: Array<{ id: HeavyCheck; label: string; hint: string }> = [
  { id: 'typecheck', label: 'Type check', hint: 'Runs tsc without writing files. Can take a minute.' },
  { id: 'tests', label: 'Run tests', hint: 'Runs npm test.' },
  { id: 'audit', label: 'Dependency audit', hint: 'Runs npm audit. Needs the internet.' },
];

function HealthTab({ projectId }: { projectId: string }) {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Partial<Record<HeavyCheck, HeavyResult>>>({});
  const [running, setRunning] = useState<HeavyCheck | null>(null);

  const load = useCallback(() => {
    devApi
      .checks(projectId)
      .then((c) => {
        setChecks(c);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [projectId]);

  useEffect(() => {
    setChecks(null);
    setResults({});
    load();
  }, [projectId, load]);

  const counts = useMemo(() => {
    const c = { pass: 0, warn: 0, fail: 0, info: 0 };
    checks?.forEach((x) => c[x.level]++);
    return c;
  }, [checks]);

  const run = async (id: HeavyCheck) => {
    setRunning(id);
    try {
      const r = await devApi.run(projectId, id);
      setResults((prev) => ({ ...prev, [id]: r }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mx-auto grid max-w-3xl gap-4">
        {error && <p className="text-sm text-os-danger" role="alert">{error}</p>}
        {!checks && !error && <p className="text-sm text-os-muted">Checking</p>}
        {checks && (
          <>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-os-text">{counts.pass} passed</span>
              <span className={counts.warn ? 'text-os-amber' : 'text-os-muted'}>{counts.warn} to look at</span>
              <span className={counts.fail ? 'text-os-danger' : 'text-os-muted'}>{counts.fail} failed</span>
              <button type="button" className={cx(btn, 'ml-auto')} onClick={load}>
                <RefreshCw size={13} aria-hidden /> Check again
              </button>
            </div>
            <ul className="grid gap-1">
              {checks.map((c) => {
                const L = LEVEL[c.level];
                return (
                  <li key={c.id} className="flex items-start gap-3 rounded-[var(--os-radius)] border border-os-line px-3 py-2">
                    <L.icon size={16} aria-label={L.word} className={cx('mt-0.5 shrink-0', L.tone)} />
                    <span className="min-w-0">
                      <span className="block text-sm text-os-text">{c.label}</span>
                      <span className="block text-xs leading-relaxed text-os-muted">{c.detail}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <Panel title="Deeper checks">
          <div className="grid gap-3">
            {HEAVY.map((h) => {
              const r = results[h.id];
              const L = r ? LEVEL[r.level] : null;
              return (
                <div key={h.id} className="grid gap-1.5">
                  <div className="flex items-center gap-3">
                    <button type="button" className={btn} disabled={running !== null} onClick={() => void run(h.id)}>
                      {running === h.id ? 'Running' : h.label}
                    </button>
                    <span className="text-xs text-os-muted">{h.hint}</span>
                  </div>
                  {r && L && (
                    <div className="rounded-[var(--os-radius)] border border-os-line p-2.5">
                      <p className={cx('flex items-center gap-2 text-sm', L.tone)}>
                        <L.icon size={15} aria-hidden /> {r.summary}
                        <span className="ml-auto text-xs text-os-muted">{(r.ms / 1000).toFixed(1)} s</span>
                      </p>
                      {r.output && (
                        <details className="mt-1.5">
                          <summary className="cursor-pointer text-xs text-os-muted">Output</summary>
                          <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words font-os-mono text-xs text-os-text">{r.output}</pre>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ---- page --------------------------------------------------------------------------------------

export default function DevPage({ route, navigate }: ModuleProps) {
  const [projects, setProjects] = useState<ProjectInfo[] | null>(null);
  const projectId = route[0] ?? projects?.[0]?.id;
  const tab: Tab = route[1] === 'health' ? 'health' : 'run';

  useEffect(() => {
    projectsApi.list().then((l) => setProjects(l.filter((p) => p.exists))).catch(() => setProjects([]));
  }, []);

  return (
    <PageFrame
      title="Dev"
      leading={<Tabs aria-label="Dev view" tabs={TABS} value={tab} onChange={(id) => projectId && navigate('dev', projectId, id)} />}
      actions={
        projects && projects.length > 0 ? (
          <>
            <label htmlFor="dev-project" className="sr-only">Project</label>
            <select id="dev-project" value={projectId} onChange={(e) => navigate('dev', e.target.value, tab)} className={cx(field, 'h-8 max-w-[14rem]')}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </>
        ) : undefined
      }
    >
      {projects && projects.length === 0 && <p className="p-6 text-sm text-os-muted">No projects yet. Add a folder on the Projects page, then run and check it here.</p>}
      {!projects && <p className="p-6 text-sm text-os-muted">Loading</p>}
      {projectId && tab === 'run' && <RunTab key={projectId} projectId={projectId} />}
      {projectId && tab === 'health' && <HealthTab key={projectId} projectId={projectId} />}
    </PageFrame>
  );
}
