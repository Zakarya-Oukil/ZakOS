import { useEffect, useState } from 'react';
import { Panel, ErrorNote, inputCls, textareaCls } from '../../ui';
import { cx } from '../../ui/cx';
import { cyberApi, type StudyData } from './api';

/** Progress is only what you enter. Nothing here is pre-filled or estimated. */
export function StudyTab() {
  const [d, setD] = useState<StudyData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    cyberApi.study().then(setD).catch((e: Error) => setErr(e.message));
  }, []);

  if (err) return <div className="p-5"><ErrorNote>{err}</ErrorNote></div>;
  if (!d) return <p className="p-5 text-sm text-os-muted">Loading</p>;

  const set = (key: string, patch: Partial<{ percent: number; notes: string }>) => {
    const cur = d.progress[key] ?? { percent: 0, notes: '' };
    const next = { ...d, progress: { ...d.progress, [key]: { ...cur, ...patch } } };
    setD(next);
    setSaved(false);
  };
  const persist = async () => {
    try {
      await cyberApi.saveStudy({ progress: d.progress, exams: d.exams });
      setSaved(true);
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const overall = (tid: string) => {
    const t = d.tracks.find((x) => x.id === tid)!;
    if (!t.domains.length) return null;
    const total = t.domains.reduce((s, x) => s + (x.weight ?? 1), 0);
    return Math.round(t.domains.reduce((s, x) => s + ((d.progress[`${tid}.${x.id}`]?.percent ?? 0) * (x.weight ?? 1)) / total, 0));
  };

  return (
    <div className="mx-auto grid max-w-4xl gap-6 p-5">
      <p className="max-w-[68ch] text-[14px] leading-relaxed text-os-muted">
        Track your progress by exam domain. Percentages and notes are yours and are stored on this machine. Security+ domain weights are the published SY0-701 weightings, used to compute the overall figure.
      </p>
      {d.tracks.map((t) => {
        const o = overall(t.id);
        return (
          <Panel key={t.id} title={t.name} header={<span className={cx('text-xs font-medium', t.status === 'earned' ? 'text-os-cyan' : 'text-os-muted')}>{t.status === 'earned' ? 'Earned' : 'In progress'}</span>}>
            {t.status === 'earned' ? (
              <p className="text-sm text-os-text">Certified. Add the verification link and your notes on what the exam covered in the Brain.</p>
            ) : (
              <div className="grid gap-4">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <p className="os-display text-[40px] leading-none text-os-text">{o ?? 0}%<span className="ml-2 align-middle text-[14px] font-normal text-os-muted">overall</span></p>
                  <div>
                    <label htmlFor={`exam-${t.id}`} className="mb-1 block text-xs text-os-muted">Exam date</label>
                    <input id={`exam-${t.id}`} type="date" className={cx(inputCls, 'h-9 w-auto')} value={d.exams[t.id] ?? ''} onChange={(e) => { setD({ ...d, exams: { ...d.exams, [t.id]: e.target.value } }); setSaved(false); }} />
                  </div>
                </div>
                <ul className="grid gap-4">
                  {t.domains.map((x) => {
                    const k = `${t.id}.${x.id}`;
                    const p = d.progress[k] ?? { percent: 0, notes: '' };
                    return (
                      <li key={x.id} className="grid gap-1.5 border-t border-os-line pt-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <label htmlFor={`p-${k}`} className="text-sm font-medium text-os-text">{x.name}{x.weight ? <span className="ml-2 font-normal text-os-muted">{x.weight}% of the exam</span> : null}</label>
                          <output htmlFor={`p-${k}`} className="font-os-mono text-sm tabular-nums text-os-text">{p.percent}%</output>
                        </div>
                        <input id={`p-${k}`} type="range" min={0} max={100} step={5} value={p.percent} onChange={(e) => set(k, { percent: Number(e.target.value) })} />
                        <label htmlFor={`n-${k}`} className="sr-only">Notes for {x.name}</label>
                        <textarea id={`n-${k}`} rows={2} className={textareaCls} value={p.notes} onChange={(e) => set(k, { notes: e.target.value })} placeholder="Weak spots, labs done, what to revise" />
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </Panel>
        );
      })}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => void persist()} className="os-btn inline-flex h-10 items-center bg-os-cyan px-5 text-sm font-medium text-os-on-accent" data-variant="primary">Save progress</button>
        {saved && <span className="text-sm text-os-ok" role="status">Saved</span>}
      </div>
    </div>
  );
}
