import { PageFrame } from '../shell/PageFrame';
import { Panel } from '../ui';

interface PlaceholderProps {
  title: string;
  phase: string;
  summary: string;
  plan: string[];
}

/** Honest stand-in for a module that is planned but not built yet. */
export function Placeholder({ title, phase, summary, plan }: PlaceholderProps) {
  return (
    <PageFrame title={title}>
      <div className="h-full overflow-y-auto p-6">
        <Panel title={phase} className="max-w-2xl">
          <p className="max-w-[65ch] text-sm leading-relaxed text-os-text">{summary}</p>
          <ul className="mt-4 grid list-disc gap-1.5 pl-5 text-sm text-os-muted">
            {plan.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Panel>
      </div>
    </PageFrame>
  );
}
