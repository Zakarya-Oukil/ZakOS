import { Fragment, useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button, EmptyState, ErrorNote, Field, Markdown, Panel, Segmented, inputCls, textareaCls } from '../../ui';
import { cx } from '../../ui/cx';
import { cyberApi, fmtTime, TYPE_LABEL, type CaseDetail, type CaseRow, type RunOut } from './api';
import { Graph } from './Graph';
import { ResultView } from './ResultView';

type View = 'evidence' | 'entities' | 'graph' | 'timeline' | 'notes' | 'report';

function RunDetail({ id }: { id: string }) {
  const [run, setRun] = useState<RunOut | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    cyberApi.run_(id).then((r) => (r.run.output ? setRun({ ...r.run.output, id: r.run.id, ms: r.run.ms, sha256: r.run.sha256 }) : setErr(r.run.error ?? 'No output was stored for this run'))).catch((e: Error) => setErr(e.message));
  }, [id]);
  if (err) return <p className="text-sm text-os-danger">{err}</p>;
  if (!run) return <p className="text-sm text-os-muted">Loading the stored output</p>;
  return <ResultView run={run} />;
}

function CaseDetailView({ id, onChanged, onBack, onUseCase }: { id: string; onChanged: () => void; onBack: () => void; onUseCase: (id: string) => void }) {
  const [d, setD] = useState<CaseDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<View>('evidence');
  const [open, setOpen] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [scope, setScope] = useState('');
  const [notes, setNotes] = useState('');
  const [type, setType] = useState('all');
  const [report, setReport] = useState<string | null>(null);
  const [saved, setSaved] = useState('');

  const load = useCallback(() => {
    cyberApi.caseDetail(id).then((r) => {
      setD(r);
      setScope(r.case.scope);
      setNotes(r.case.notes);
    }).catch((e: Error) => setErr(e.message));
  }, [id]);
  useEffect(load, [load]);

  const timeline = useMemo(() => {
    if (!d) return [];
    return [...d.runs].sort((a, b) => a.ts - b.ts).map((r) => ({ run: r, found: d.entities.filter((e) => e.first_run === r.id) }));
  }, [d]);

  if (err) return <ErrorNote>{err}</ErrorNote>;
  if (!d) return <p className="text-sm text-os-muted">Loading the case</p>;
  const c = d.case;
  const types = ['all', ...new Set(d.entities.map((e) => e.type))];
  const ents = d.entities.filter((e) => type === 'all' || e.type === type);
  const selected = sel ? d.entities.find((e) => `${e.type}:${e.value}` === sel) : undefined;

  const save = async (patch: Parameters<typeof cyberApi.updateCase>[1], what: string) => {
    try {
      await cyberApi.updateCase(id, patch);
      setSaved(`${what} saved`);
      load();
      onChanged();
      setTimeout(() => setSaved(''), 2500);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const build = async () => {
    try {
      setReport(await cyberApi.report(id));
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const download = () => {
    if (!report) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([report], { type: 'text/markdown' }));
    a.download = `${c.name.replace(/[^\w-]+/g, '-').toLowerCase() || 'case'}-report.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button type="button" onClick={onBack} className="mb-1 text-[13px] text-os-muted underline underline-offset-4 hover:text-os-text">All cases</button>
          <h2 className="os-display text-[34px] text-os-text">{c.name}</h2>
          <p className="mt-1 text-[13px] text-os-muted">
            {c.status === 'open' ? 'Open' : 'Closed'} since {fmtTime(c.created)} · {d.runs.length} runs · {d.entities.length} entities · {d.edges.length} links
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onUseCase(id)}>Run tools in this case</Button>
          <Button onClick={() => void save({ status: c.status === 'open' ? 'closed' : 'open' }, 'Status')}>{c.status === 'open' ? 'Close the case' : 'Reopen'}</Button>
          <Button
            variant="ghost"
            onClick={async () => {
              if (!window.confirm(`Delete “${c.name}” with all of its runs, entities and links? This cannot be undone.`)) return;
              await cyberApi.deleteCase(id);
              onChanged();
              onBack();
            }}
          >
            Delete
          </Button>
        </div>
      </div>

      <Panel title="Scope and authorisation" header={saved && <span className="text-xs text-os-ok" role="status">{saved}</span>}>
        <div className="grid gap-2">
          <label htmlFor="case-scope" className="sr-only">Scope and authorisation</label>
          <textarea id="case-scope" className={textareaCls} rows={3} value={scope} onChange={(e) => setScope(e.target.value)} placeholder="Who authorised this, what is in scope, what is out of scope, and the dates." />
          <div>
            <Button size="sm" disabled={scope === c.scope} onClick={() => void save({ scope }, 'Scope')}>Save the scope</Button>
          </div>
        </div>
      </Panel>

      <Segmented<View>
        label="Case view"
        value={view}
        onChange={setView}
        options={[
          { id: 'evidence', label: 'Evidence' },
          { id: 'entities', label: 'Entities' },
          { id: 'graph', label: 'Graph' },
          { id: 'timeline', label: 'Timeline' },
          { id: 'notes', label: 'Notes' },
          { id: 'report', label: 'Report' },
        ]}
      />

      {view === 'evidence' &&
        (d.runs.length === 0 ? (
          <EmptyState title="No evidence yet" action={<Button variant="primary" onClick={() => onUseCase(id)}>Run a tool</Button>}>Every tool run you save to this case is listed here with the time, target and a hash of its output.</EmptyState>
        ) : (
          <div className="overflow-x-auto border border-os-line">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="bg-os-surface-2 text-os-muted">
                <tr>
                  {['Time', 'Tool', 'Target', 'Result', 'SHA-256'].map((h) => <th key={h} scope="col" className="px-3 py-2 font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {d.runs.map((r) => (
                  <Fragment key={r.id}>
                    <tr className="border-t border-os-line align-top">
                      <td className="whitespace-nowrap px-3 py-2 text-os-muted">{fmtTime(r.ts)}</td>
                      <td className="px-3 py-2">{r.tool}{r.mode === 'active' && <span className="ml-1.5 border border-os-amber px-1 text-xs text-os-amber">active</span>}</td>
                      <td className="max-w-[16rem] break-all px-3 py-2 font-os-mono">{r.input}</td>
                      <td className="px-3 py-2">
                        {r.ok ? r.summary : <span className="text-os-danger">Failed: {r.error}</span>}{' '}
                        {r.ok === 1 && (
                          <button type="button" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)} className="text-os-text underline underline-offset-4 hover:text-os-cyan">
                            {open === r.id ? 'Hide output' : 'View output'}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2 font-os-mono text-xs text-os-muted">{r.sha256?.slice(0, 16)}</td>
                    </tr>
                    {open === r.id && (
                      <tr className="border-t border-os-line bg-os-bg">
                        <td colSpan={5} className="p-4"><RunDetail id={r.id} /></td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {view === 'entities' &&
        (d.entities.length === 0 ? (
          <EmptyState title="No entities yet">Domains, IP addresses, emails and accounts found by your runs are collected here.</EmptyState>
        ) : (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="ent-type" className="text-[13px] text-os-muted">Type</label>
              <select id="ent-type" className={cx(inputCls, 'h-9 w-auto')} value={type} onChange={(e) => setType(e.target.value)}>
                {types.map((t) => <option key={t} value={t}>{t === 'all' ? 'All types' : TYPE_LABEL[t] ?? t}</option>)}
              </select>
              <span className="text-[13px] text-os-muted">{ents.length} shown</span>
            </div>
            <div className="max-h-[560px] overflow-auto border border-os-line">
              <table className="w-full min-w-[720px] text-left text-[13px]">
                <thead className="sticky top-0 bg-os-surface-2 text-os-muted">
                  <tr>{['Type', 'Value', 'Confidence', 'Note', 'Run', ''].map((h, i) => <th key={i} scope="col" className="px-3 py-2 font-medium">{h || <span className="sr-only">Actions</span>}</th>)}</tr>
                </thead>
                <tbody>
                  {ents.map((e) => (
                    <tr key={e.id} className="border-t border-os-line align-top">
                      <td className="px-3 py-1.5 text-os-muted">{TYPE_LABEL[e.type] ?? e.type}</td>
                      <td className="max-w-[18rem] break-all px-3 py-1.5 font-os-mono">{e.value}</td>
                      <td className="px-3 py-1.5">
                        <select aria-label={`Confidence for ${e.value}`} className={cx(inputCls, 'h-8 w-auto px-2 text-[13px]')} value={e.confidence} onChange={async (ev) => { await cyberApi.updateEntity(e.id, { confidence: ev.target.value }); load(); }}>
                          <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <input aria-label={`Note for ${e.value}`} className={cx(inputCls, 'h-8 px-2 text-[13px]')} defaultValue={e.note} placeholder="Add a note" onBlur={async (ev) => { if (ev.target.value !== e.note) { await cyberApi.updateEntity(e.id, { note: ev.target.value }); load(); } }} />
                      </td>
                      <td className="px-3 py-1.5 font-os-mono text-xs text-os-muted">{e.first_run?.slice(0, 12)}</td>
                      <td className="px-3 py-1.5"><button type="button" aria-label={`Remove ${e.value}`} onClick={async () => { await cyberApi.deleteEntity(e.id); load(); }} className="text-os-muted underline underline-offset-4 hover:text-os-danger">Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

      {view === 'graph' &&
        (d.entities.length === 0 ? (
          <EmptyState title="Nothing to draw yet">Run a tool in this case and its findings appear here as a graph.</EmptyState>
        ) : (
          <div className="grid gap-3">
            <Graph entities={d.entities} edges={d.edges} selected={sel} onSelect={setSel} />
            {sel && (
              <Panel title="Selected">
                <p className="break-all font-os-mono text-sm text-os-text">{sel}</p>
                {selected && <p className="mt-1 text-[13px] text-os-muted">Confidence {selected.confidence}{selected.note ? ` · ${selected.note}` : ''}</p>}
                <ul className="mt-2 grid gap-1 text-[13px]">
                  {d.edges.filter((e) => e.a === sel || e.b === sel).map((e, i) => (
                    <li key={i} className="text-os-muted">
                      <button type="button" onClick={() => setSel(e.a === sel ? e.b : e.a)} className="break-all font-os-mono text-os-text underline underline-offset-4">{e.a === sel ? e.b : e.a}</button> ({e.a === sel ? e.rel : `${e.rel}, incoming`})
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>
        ))}

      {view === 'timeline' &&
        (timeline.length === 0 ? (
          <EmptyState title="No timeline yet">Runs appear here in the order they happened.</EmptyState>
        ) : (
          <ol className="grid gap-0 border-l border-os-line pl-5">
            {timeline.map(({ run, found }) => (
              <li key={run.id} className="relative pb-5">
                <span className={cx('absolute -left-[26px] top-1.5 h-2.5 w-2.5 border bg-os-bg', run.ok ? 'border-os-text' : 'border-os-danger')} aria-hidden />
                <p className="text-[13px] text-os-muted">{fmtTime(run.ts)} · {run.tool} · {run.mode}</p>
                <p className="break-all font-os-mono text-sm text-os-text">{run.input}</p>
                <p className="text-sm text-os-text">{run.ok ? run.summary : <span className="text-os-danger">Failed: {run.error}</span>}</p>
                {found.length > 0 && <p className="mt-1 text-[13px] text-os-muted">New: {found.slice(0, 6).map((f) => f.value).join(', ')}{found.length > 6 ? ` and ${found.length - 6} more` : ''}</p>}
              </li>
            ))}
          </ol>
        ))}

      {view === 'notes' && (
        <div className="grid gap-2">
          <label htmlFor="case-notes" className="text-[13px] font-medium text-os-text">Analyst notes</label>
          <textarea id="case-notes" className={textareaCls} rows={12} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Hypotheses, what you ruled out, what to try next. Included in the report." />
          <div><Button size="sm" disabled={notes === c.notes} onClick={() => void save({ notes }, 'Notes')}>Save the notes</Button></div>
        </div>
      )}

      {view === 'report' && (
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => void build()}>{report ? 'Rebuild the report' : 'Build the report'}</Button>
            <Button disabled={!report} onClick={download}>Download Markdown</Button>
            <Button disabled={!report} onClick={() => window.print()}>Print or save as PDF</Button>
          </div>
          <p className="max-w-[68ch] text-[13px] text-os-muted">The report holds the scope, your notes, every entity with its confidence and source run, the relationships, and an evidence log with the hash of each run’s output. Print uses your browser’s “Save as PDF”.</p>
          {report && (
            <div id="cl-report" className="border border-os-line bg-os-surface p-6">
              <Markdown text={report} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CasesTab({ cases, openId, onOpen, onChanged, onUseCase }: { cases: CaseRow[]; openId?: string; onOpen: (id?: string) => void; onChanged: () => void; onUseCase: (id: string) => void }) {
  const [name, setName] = useState('');
  const [scope, setScope] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const r = await cyberApi.createCase(name, scope);
      setName('');
      setScope('');
      onChanged();
      onOpen(r.id);
    } catch (x) {
      setErr((x as Error).message);
    }
  };

  if (openId) return <div className="mx-auto max-w-5xl p-5"><CaseDetailView id={openId} onChanged={onChanged} onBack={() => onOpen(undefined)} onUseCase={onUseCase} /></div>;

  return (
    <div className="mx-auto grid max-w-5xl gap-6 p-5">
      <Panel title="Open a case">
        <form onSubmit={create} className="grid gap-3">
          <Field label="Case name" htmlFor="nc-name"><input id="nc-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Client or exercise name" /></Field>
          <Field label="Scope and authorisation" htmlFor="nc-scope" hint="Write down who authorised the work and what is in and out of scope. It is printed at the top of the report.">
            <textarea id="nc-scope" className={textareaCls} rows={3} value={scope} onChange={(e) => setScope(e.target.value)} />
          </Field>
          {err && <ErrorNote>{err}</ErrorNote>}
          <div><Button type="submit" variant="primary" disabled={!name.trim()}>Open the case</Button></div>
        </form>
      </Panel>
      {cases.length === 0 ? (
        <EmptyState title="No cases yet">A case keeps the scope, every run, what you found and how it connects, so a finding can always be traced to its source.</EmptyState>
      ) : (
        <ul className="grid gap-px border border-os-line bg-os-line">
          {cases.map((c) => (
            <li key={c.id} className="bg-os-surface">
              <button type="button" onClick={() => onOpen(c.id)} className="grid w-full gap-1 px-4 py-3 text-left transition-colors hover:bg-os-surface-2 focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="os-display text-[22px] text-os-text">{c.name}</span>
                  <span className="shrink-0 text-xs text-os-muted">{c.status === 'open' ? 'Open' : 'Closed'}</span>
                </span>
                <span className="text-[13px] text-os-muted">{c.runs ?? 0} runs · {c.entities ?? 0} entities · updated {fmtTime(c.updated)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
