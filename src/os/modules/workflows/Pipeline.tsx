import { Check, FileText, Hammer, ListTree, ScanSearch, X, type LucideIcon } from 'lucide-react';
import { cx } from '../../ui/cx';
import type { WorkflowRun } from './api';

type NodeState = 'todo' | 'active' | 'done' | 'failed' | 'halted';

const STAGES: Array<{ id: string; label: string; icon: LucideIcon }> = [
  { id: 'plan', label: 'Plan', icon: ListTree },
  { id: 'build', label: 'Build', icon: Hammer },
  { id: 'review', label: 'Review', icon: ScanSearch },
  { id: 'report', label: 'Report', icon: FileText },
];

const ACTIVE_INDEX: Partial<Record<WorkflowRun['status'], number>> = { planning: 0, awaiting_approval: 1, running: 1, reviewing: 2, reporting: 3 };

function stageStates(run: WorkflowRun): NodeState[] {
  if (run.status === 'done') return STAGES.map(() => 'done');
  const active = ACTIVE_INDEX[run.status];
  if (active !== undefined) return STAGES.map((_, i) => (i < active ? 'done' : i === active ? 'active' : 'todo'));
  // Failed or stopped: the run halted at the first stage that has no result yet.
  const allSettled = run.tasks.length > 0 && run.tasks.every((t) => t.state === 'done' || t.state === 'error');
  const halted = run.tasks.length === 0 ? 0 : !allSettled ? 1 : !run.review ? 2 : 3;
  const mark: NodeState = run.status === 'error' ? 'failed' : 'halted';
  return STAGES.map((_, i) => (i < halted ? 'done' : i === halted ? mark : 'todo'));
}

function detail(run: WorkflowRun, id: string, state: NodeState): string {
  const settled = run.tasks.filter((t) => t.state === 'done' || t.state === 'error').length;
  switch (id) {
    case 'plan':
      return run.tasks.length ? `${run.tasks.length} ${run.tasks.length === 1 ? 'task' : 'tasks'}` : state === 'active' ? 'Planning' : '';
    case 'build':
      if (run.status === 'awaiting_approval') return 'Needs your approval';
      return run.tasks.length ? `${settled} of ${run.tasks.length} finished` : '';
    case 'review':
      return run.verdict ? (run.verdict === 'pass' ? 'Passed' : 'Needs work') : state === 'active' ? 'Checking the repo' : '';
    default:
      return state === 'done' ? 'Ready' : state === 'active' ? 'Writing' : '';
  }
}

const nodeStyle: Record<NodeState, string> = {
  todo: 'border-os-line bg-os-surface text-os-muted',
  active: 'border-os-cyan bg-[rgba(var(--os-cyan-rgb),0.12)] text-os-cyan shadow-[var(--os-glow-cyan)]',
  done: 'border-os-cyan bg-os-cyan text-os-bg',
  failed: 'border-os-danger bg-[rgba(255,107,107,0.12)] text-os-danger',
  halted: 'border-os-amber bg-[rgba(242,181,68,0.1)] text-os-amber',
};

export function Pipeline({ run }: { run: WorkflowRun }) {
  const states = stageStates(run);
  return (
    <ol className="grid grid-cols-4" aria-label="Workflow stages">
      {STAGES.map((stage, i) => {
        const state = states[i];
        const Icon = state === 'done' ? Check : state === 'failed' || state === 'halted' ? X : stage.icon;
        const text = detail(run, stage.id, state);
        const last = i === STAGES.length - 1;
        return (
          <li key={stage.id} className="min-w-0" aria-current={state === 'active' ? 'step' : undefined}>
            <div className="flex items-center">
              <span
                className={cx(
                  'grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-[background-color,border-color,color,box-shadow] duration-500',
                  nodeStyle[state],
                )}
              >
                <Icon size={16} strokeWidth={2} aria-hidden />
              </span>
              {!last && (
                <span className="relative mx-2 h-0.5 flex-1 overflow-hidden rounded-full bg-os-line" aria-hidden>
                  <span
                    className="absolute inset-0 origin-left bg-os-cyan transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{ transform: `scaleX(${state === 'done' ? 1 : 0})` }}
                  />
                  {states[i + 1] === 'active' && <span className="os-flow" />}
                </span>
              )}
            </div>
            <p className={cx('mt-2 text-sm font-medium', state === 'todo' ? 'text-os-muted' : 'text-os-text')}>{stage.label}</p>
            <p className="min-h-4 pr-2 text-xs leading-4 text-os-muted">
              <span className="sr-only">{state === 'todo' ? 'Not started. ' : state === 'active' ? 'In progress. ' : ''}</span>
              {text}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
