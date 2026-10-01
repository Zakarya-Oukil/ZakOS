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
      <header className="relative z-20 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-os-line bg-os-surface px-5">
        <div className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto">
          <h1 className="shrink-0 font-os-sans text-[18px] font-semibold tracking-tight text-os-text">{title}</h1>
          {leading}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      <div className="relative min-h-0 flex-1">{children}</div>
    </div>
  );
}
