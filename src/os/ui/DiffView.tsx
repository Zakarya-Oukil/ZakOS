import { useSyncExternalStore } from 'react';
import { cx } from './cx';

/** One diff viewer for Git, session changes and run review. Unified or side by side, remembered across pages. */
type Mode = 'unified' | 'split';
const KEY = 'zakos_diff_mode';
const listeners = new Set<() => void>();
let current: Mode | null = null;

function read(): Mode {
  if (current) return current;
  try {
    current = window.localStorage.getItem(KEY) === 'split' ? 'split' : 'unified';
  } catch {
    current = 'unified';
  }
  return current;
}

function setMode(m: Mode) {
  current = m;
  try {
    window.localStorage.setItem(KEY, m);
  } catch {
    /* storage blocked */
  }
  listeners.forEach((l) => l());
}

const useMode = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
  );

interface Row {
  kind: 'ctx' | 'del' | 'add' | 'meta';
  left?: string;
  right?: string;
}

/** Pairs removed and added lines into rows, so a changed line sits next to the line it replaced. */
function toRows(lines: string[]): Row[] {
  const rows: Row[] = [];
  let dels: string[] = [];
  let adds: string[] = [];
  const flush = () => {
    const n = Math.max(dels.length, adds.length);
    for (let i = 0; i < n; i++) rows.push({ kind: dels[i] !== undefined && adds[i] !== undefined ? 'ctx' : dels[i] !== undefined ? 'del' : 'add', left: dels[i], right: adds[i] });
    dels = [];
    adds = [];
  };
  for (const l of lines) {
    if (l.startsWith('---') || l.startsWith('+++') || l.startsWith('diff ') || l.startsWith('index ')) {
      flush();
      rows.push({ kind: 'meta', left: l });
    } else if (l.startsWith('@@')) {
      flush();
      rows.push({ kind: 'meta', left: l });
    } else if (l.startsWith('-')) dels.push(l.slice(1));
    else if (l.startsWith('+')) adds.push(l.slice(1));
    else {
      flush();
      rows.push({ kind: 'ctx', left: l.slice(1), right: l.slice(1) });
    }
  }
  flush();
  return rows;
}

const ADD = 'bg-[rgba(var(--os-cyan-rgb),0.1)] text-os-cyan';
const DEL = 'bg-[rgba(255,107,107,0.09)] text-os-danger';

export function DiffView({ text, maxHeight = 'max-h-72' }: { text: string; maxHeight?: string }) {
  const mode = useMode();
  const lines = text.split('\n');
  return (
    <div className="border-t border-os-line bg-os-bg">
      <div className="flex items-center justify-end gap-1 px-3 pt-2" role="group" aria-label="Diff layout">
        {(['unified', 'split'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={cx('h-7 rounded-full px-3 text-xs transition-colors focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]', mode === m ? 'bg-os-surface-2 text-os-text' : 'text-os-muted hover:text-os-text')}
          >
            {m === 'unified' ? 'Unified' : 'Side by side'}
          </button>
        ))}
      </div>
      {mode === 'unified' ? (
        <pre className={cx(maxHeight, 'overflow-auto px-3 py-2 font-os-mono text-xs leading-[1.5]')}>
          {lines.map((l, i) => (
            <span key={i} className={cx('block whitespace-pre', l.startsWith('+') && !l.startsWith('+++') && ADD, l.startsWith('-') && !l.startsWith('---') && DEL, l.startsWith('@@') && 'text-os-muted')}>
              {l || ' '}
            </span>
          ))}
        </pre>
      ) : (
        <div className={cx(maxHeight, 'overflow-auto px-3 py-2 font-os-mono text-xs leading-[1.5]')}>
          {toRows(lines).map((r, i) =>
            r.kind === 'meta' ? (
              <div key={i} className="whitespace-pre text-os-muted">{r.left}</div>
            ) : (
              <div key={i} className="grid grid-cols-2 gap-px">
                <span className={cx('whitespace-pre overflow-hidden', r.left !== undefined && r.kind !== 'ctx' && r.right === undefined && DEL, r.kind === 'ctx' && r.left !== r.right && DEL)}>{r.left ?? ' '}</span>
                <span className={cx('whitespace-pre overflow-hidden', r.right !== undefined && r.kind !== 'ctx' && r.left === undefined && ADD, r.kind === 'ctx' && r.left !== r.right && ADD)}>{r.right ?? ' '}</span>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
