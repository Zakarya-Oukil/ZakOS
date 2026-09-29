import type { ReactNode } from 'react';

interface PageFrameProps {
  title: string;
  /** Left of the actions, next to the title (tabs, switchers). */
  leading?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

/** Every module page renders inside this: its own top bar plus a scrolling body. */
export function PageFrame({ title, leading, actions, children }: PageFrameProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-os-line bg-os-surface px-4">
        <div className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto">
          <h1 className="shrink-0 font-os-sans text-[15px] font-semibold text-os-text">{title}</h1>
          {leading}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
