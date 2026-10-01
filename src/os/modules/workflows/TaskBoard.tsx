import { Check, CircleDashed, X } from 'lucide-react';
import { LayoutGroup, motion } from 'motion/react';
import { cx } from '../../ui/cx';
import { spring, usePrefersReducedMotion } from '../../theme/motion';
import { isActive, type TaskState, type WorkflowRun, type WorkflowTask } from './api';

const COLUMNS: Array<{ label: string; states: TaskState[]; empty: string }> = [
  { label: 'Queued', states: ['queued'], empty: 'Nothing waiting' },
  { label: 'Running', states: ['running'], empty: 'No sub-agent is working' },
  { label: 'Finished', states: ['done', 'error'], empty: 'Nothing finished yet' },
];

/** First readable line of an agent reply, markdown marks removed. */
function firstLine(text?: string): string {
  const line = (text ?? '').split('\n').map((l) => l.replace(/^[#>*\-\s]+/, '').replace(/[`*_]/g, '').trim()).find(Boolean);
  return line ?? '';
}

function StateIcon({ state }: { state: TaskState }) {
  if (state === 'done') return <Check size={15} strokeWidth={2.25} className="text-os-cyan" aria-label="Done" />;
  if (state === 'error') return <X size={15} strokeWidth={2.25} className="text-os-danger" aria-label="Failed" />;
  if (state === 'running') return <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-os-cyan os-live-dot" role="img" aria-label="Running" />;
  return <CircleDashed size={15} strokeWidth={1.75} className="text-os-muted" aria-label="Queued" />;
}

function TaskCard({ task, selected, onSelect }: { task: WorkflowTask; selected: boolean; onSelect: () => void }) {
  const note = task.merge === 'conflict' || task.merge === 'failed' ? task.mergeNote : task.state === 'error' ? task.error : task.state === 'done' ? firstLine(task.result) : task.state === 'running' ? 'Working' : 'Waiting for a free slot';
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cx(
        'relative block w-full min-w-0 overflow-hidden rounded-[var(--os-radius)] border bg-os-surface-2 px-3 py-2.5 text-left transition-colors',
        'focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]',
        selected ? 'border-os-cyan' : task.state === 'running' ? 'border-[rgba(var(--os-cyan-rgb),0.4)]' : 'border-os-line hover:border-os-muted',
      )}
    >
      <span className="flex items-start gap-2.5">
        <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center">
          <StateIcon state={task.state} />
        </span>
        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
          <span className="block text-sm font-medium leading-snug text-os-text">{task.title}</span>
          {note && (
            <span className={cx('mt-0.5 line-clamp-2 block text-xs leading-snug', task.state === 'error' || task.merge === 'conflict' || task.merge === 'failed' ? 'text-os-danger' : 'text-os-muted')}>
              {note}
            </span>
          )}
        </span>
      </span>
      {task.state === 'running' && <span className="os-indeterminate" aria-hidden />}
    </button>
  );
}

export function TaskBoard({ run, selected, onSelect }: { run: WorkflowRun; selected?: string; onSelect: (id: string) => void }) {
  const reduced = usePrefersReducedMotion();
  if (run.tasks.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-os-muted">
        {isActive(run.status) ? 'The orchestrator is reading the project and splitting the goal. Tasks appear here.' : 'This run planned no tasks.'}
      </p>
    );
  }
  return (
    // layoutId moves a card from one column to the next as its state changes.
    <LayoutGroup>
      <div className="grid gap-4 p-3 md:grid-cols-3 md:[&>section]:min-w-0">
        {COLUMNS.map((col) => {
          const tasks = run.tasks.filter((t) => col.states.includes(t.state));
          return (
            <section key={col.label} className="min-w-0" aria-label={col.label}>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-os-muted">
                {col.label}
                <span className="rounded-full bg-os-surface-2 px-1.5 font-os-mono text-xs tabular-nums text-os-text">{tasks.length}</span>
              </h3>
              <div className="grid min-h-16 content-start gap-2 rounded-[var(--os-radius)]">
                {tasks.map((t) => (
                  <motion.div key={t.id} layoutId={t.id} className="min-w-0" transition={reduced ? { duration: 0 } : spring.soft}>
                    <TaskCard task={t} selected={selected === t.id} onSelect={() => onSelect(t.id)} />
                  </motion.div>
                ))}
                {tasks.length === 0 && (
                  <p className="rounded-[var(--os-radius)] border border-dashed border-os-line px-3 py-3 text-xs text-os-muted">{col.empty}</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
