import { useEffect, useState } from 'react';
import { Button, Panel } from '../ui';
import { cyberApi, fmtTime, type CaseRow, type RunRow, type StudyData } from '../modules/cyberlab/api';
import type { HeroProps } from './heroes';

const goto = (path: string) => {
  window.location.hash = path;
};

/** The Cybersec Home: a desk of real cases, real runs and your own study progress. Nothing here is sample data. */
export function CyberHero({ hello, summary }: HeroProps) {
  const [cases, setCases] = useState<CaseRow[] | null>(null);
  const [runs, setRuns] = useState<RunRow[] | null>(null);
  const [study, setStudy] = useState<StudyData | null>(null);

  useEffect(() => {
    cyberApi.cases().then((r) => setCases(r.cases)).catch(() => setCases([]));
    cyberApi.runs().then((r) => setRuns(r.runs)).catch(() => setRuns([]));
    cyberApi.study().then(setStudy).catch(() => undefined);
  }, []);

  const open = (cases ?? []).filter((c) => c.status === 'open');
  const overall = (id: string) => {
    const t = study?.tracks.find((x) => x.id === id);
    if (!t?.domains.length || !study) return 0;
    const total = t.domains.reduce((s, x) => s + (x.weight ?? 1), 0);
    return Math.round(t.domains.reduce((s, x) => s + ((study.progress[`${id}.${x.id}`]?.percent ?? 0) * (x.weight ?? 1)) / total, 0));
  };
  const date = new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <section aria-label="Investigation desk" className="grid gap-8 pb-2 pt-4">
      <div className="grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_240px]">
        <div>
          <p className="text-[14px] text-os-muted">{date}</p>
          <h2 className="os-display mt-2 text-[58px] text-os-text">{hello}</h2>
          <p className="mt-3 max-w-[56ch] text-[17px] leading-relaxed text-os-muted">{summary}</p>
          {study && (
            <ul className="mt-5 flex flex-wrap gap-2" aria-label="Certifications">
              {study.tracks.map((t) => (
                <li key={t.id} className={t.status === 'earned' ? 'border border-os-cyan px-2.5 py-1 text-[13px] font-medium text-os-cyan' : 'border border-dashed border-os-contour px-2.5 py-1 text-[13px] text-os-muted'}>
                  {t.name.split(' (')[0]} {t.status === 'earned' ? 'earned' : 'in progress'}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => goto('#/cyberlab/tools')}>Open CyberLab</Button>
            <Button onClick={() => goto('#/cyberlab/cases')}>Cases</Button>
          </div>
        </div>
        <figure className="cyber-print mx-auto w-full max-w-[240px]">
          <img src="/img/portrait.webp" alt="Zakarya Oukil" width={480} height={600} />
          <figcaption>Zakarya Oukil</figcaption>
        </figure>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <Panel bare title="Open cases" header={<a className="text-xs text-os-muted hover:text-os-text" href="#/cyberlab/cases">All cases</a>}>
          {cases === null ? (
            <p className="text-sm text-os-muted">Loading</p>
          ) : open.length === 0 ? (
            <p className="text-sm text-os-muted">No open cases. A case holds your scope, evidence and findings. <a className="text-os-text underline underline-offset-4" href="#/cyberlab/cases">Open one</a>.</p>
          ) : (
            <ul className="grid gap-2.5">
              {open.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <a href={`#/cyberlab/cases/${c.id}`} className="block text-[15px] font-medium text-os-text hover:text-os-cyan">{c.name}</a>
                  <span className="text-xs text-os-muted">{c.runs ?? 0} runs · {c.entities ?? 0} entities · {fmtTime(c.updated)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel bare title="Recent tool runs" header={<a className="text-xs text-os-muted hover:text-os-text" href="#/audit">Audit log</a>}>
          {runs === null ? (
            <p className="text-sm text-os-muted">Loading</p>
          ) : runs.length === 0 ? (
            <p className="text-sm text-os-muted">No runs yet. Start with a domain you own in <a className="text-os-text underline underline-offset-4" href="#/cyberlab/tools/dns-records">DNS records</a>.</p>
          ) : (
            <ul className="grid gap-2.5">
              {runs.slice(0, 5).map((r) => (
                <li key={r.id} className="text-sm">
                  <span className="font-os-mono text-[13px] text-os-text">{r.input.length > 34 ? `${r.input.slice(0, 33)}…` : r.input}</span>
                  <span className="block text-xs text-os-muted">{r.tool} · {r.ok ? r.summary : 'failed'} · {fmtTime(r.ts)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel bare title="Study" header={<a className="text-xs text-os-muted hover:text-os-text" href="#/cyberlab/study">Update</a>}>
          {!study ? (
            <p className="text-sm text-os-muted">Loading</p>
          ) : (
            <ul className="grid gap-3">
              {study.tracks.filter((t) => t.status !== 'earned').map((t) => (
                <li key={t.id}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-os-text">{t.name.split(' (')[0]}</span>
                    <span className="font-os-mono text-[13px] tabular-nums text-os-text">{overall(t.id)}%</span>
                  </div>
                  <div className="mt-1.5 h-1 bg-os-surface-2" role="progressbar" aria-label={`${t.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={overall(t.id)}>
                    <div className="h-full bg-os-cyan" style={{ width: `${overall(t.id)}%` }} />
                  </div>
                  {study.exams[t.id] && <p className="mt-1 text-xs text-os-muted">Exam {new Date(study.exams[t.id]).toLocaleDateString([], { dateStyle: 'medium' })}</p>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </section>
  );
}
