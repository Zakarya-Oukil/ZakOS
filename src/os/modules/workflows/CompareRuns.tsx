import { useMemo, useState } from 'react';
import { EmptyState } from '../../ui';
import { cx } from '../../ui/cx';
import { api, money, useResource } from '../../lib/api';
import { timeAgo } from '../../lib/projectsApi';
import type { WorkflowRun } from './api';

/** Two runs side by side: plan, outcome, cost, files and verdict, so a retry can be judged against the first try. */
function useCost(run: WorkflowRun | undefined) {
  const ids = run ? [run.orchestratorSessionId, run.reviewerSessionId, ...run.tasks.map((t) => t.sessionId)].filter((x): x is string => !!x) : [];
  const { data } = useResource<{ cost: number }>(run && ids.length ? `/api/flows/run-cost?ids=${ids.join(',')}` : null, [run?.id]);
  return data?.cost ?? null;
}

const duration = (r: WorkflowRun) => {
  const s = Math.round((r.updated - r.created) / 1000);
  return s < 90 ? `${s} s` : `${Math.round(s / 60)} min`;
};

function Column({ run }: { run: WorkflowRun | undefined }) {
  const cost = useCost(run);
  if (!run) return <div className="p-4 text-sm text-os-muted">Pick a run.</div>;
  const files = run.tasks.reduce((n, t) => n + (t.filesChanged ?? 0), 0);
  return (
    <div className="grid min-w-0 content-start gap-4 p-4">
      <p className="text-[15px] font-medium leading-snug text-os-text">{run.goal}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-sm">
        <dt className="text-os-muted">Outcome</dt>
        <dd className={cx('font-medium', run.status === 'done' ? 'text-os-ok' : run.status === 'error' ? 'text-os-danger' : 'text-os-text')}>{run.status}{run.verdict ? `, reviewer says ${run.verdict === 'pass' ? 'pass' : 'needs work'}` : ''}</dd>
        <dt className="text-os-muted">Started</dt>
        <dd className="text-os-text">{timeAgo(run.created)}, took {duration(run)}</dd>
        <dt className="text-os-muted">Cost</dt>
        <dd className="text-os-text">{cost === null ? 'Not reported' : money(cost)}</dd>
        <dt className="text-os-muted">Tasks</dt>
        <dd className="text-os-text">{run.tasks.filter((t) => t.state === 'done').length} of {run.tasks.length} done, {files} file{files === 1 ? '' : 's'} changed</dd>
      </dl>
      <div>
        <h3 className="mb-1.5 text-[13px] font-semibold text-os-text">Plan</h3>
        <ol className="grid list-decimal gap-1 pl-5 text-sm text-os-text">
          {run.tasks.map((t) => (
            <li key={t.id}>
              {t.title} <span className={cx('text-xs', t.state === 'done' ? 'text-os-ok' : t.state === 'error' ? 'text-os-danger' : 'text-os-muted')}>{t.state}</span>
            </li>
          ))}
          {run.tasks.length === 0 && <li className="list-none text-os-muted">No plan was made.</li>}
        </ol>
      </div>
      {run.review && (
        <div>
          <h3 className="mb-1.5 text-[13px] font-semibold text-os-text">Review</h3>
          <p className="max-h-48 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-os-text">{run.review.slice(0, 1800)}</p>
        </div>
      )}
      {run.error && <p className="text-sm text-os-danger">{run.error}</p>}
    </div>
  );
}

export function CompareRuns({ runs }: { runs: WorkflowRun[] }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const ra = useMemo(() => runs.find((r) => r.id === a), [runs, a]);
  const rb = useMemo(() => runs.find((r) => r.id === b), [runs, b]);
  void api;

  if (runs.length < 2) return <EmptyState title="Two runs to compare">Start a second run, for example a retry with a changed goal, and compare it with the first here.</EmptyState>;

  const opt = (
    <>
      <option value="">Pick a run</option>
      {runs.map((r) => (
        <option key={r.id} value={r.id}>{r.goal.slice(0, 60)} ({timeAgo(r.created)})</option>
      ))}
    </>
  );

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
      <div className="grid gap-3 border-b border-os-line p-4 md:grid-cols-2">
        <div>
          <label htmlFor="cmp-a" className="mb-1 block text-[13px] font-medium text-os-text">First run</label>
          <select id="cmp-a" value={a} onChange={(e) => setA(e.target.value)} className="w-full">{opt}</select>
        </div>
        <div>
          <label htmlFor="cmp-b" className="mb-1 block text-[13px] font-medium text-os-text">Second run</label>
          <select id="cmp-b" value={b} onChange={(e) => setB(e.target.value)} className="w-full">{opt}</select>
        </div>
      </div>
      <div className="grid min-h-0 grid-cols-1 overflow-y-auto md:grid-cols-2 md:[&>*:first-child]:border-r md:[&>*:first-child]:border-os-line">
        <Column run={ra} />
        <Column run={rb} />
      </div>
    </div>
  );
}
