import { useEffect, useMemo } from 'react';
import { X } from '@phosphor-icons/react';
import { IconButton } from '../../ui';
import type { Item } from './items';

/** The last answer an agent gave in a session: its final run of text blocks after the last user message. */
export function lastAnswer(items: Item[]): string {
  let out = '';
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (it.kind === 'user') break;
    if (it.kind === 'text') out = it.text + (out ? '\n\n' + out : '');
  }
  return out.trim();
}

const tokenize = (t: string) => t.split(/(\s+)/).filter((x) => x.length > 0);

/** Marks the words that appear in one answer and not the other, with a longest-common-subsequence over words. */
function mark(a: string, b: string): { left: Array<{ t: string; diff: boolean }>; right: Array<{ t: string; diff: boolean }> } {
  const x = tokenize(a).slice(0, 1500);
  const y = tokenize(b).slice(0, 1500);
  const n = x.length;
  const m = y.length;
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const left: Array<{ t: string; diff: boolean }> = [];
  const right: Array<{ t: string; diff: boolean }> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) {
      left.push({ t: x[i], diff: false });
      right.push({ t: y[j], diff: false });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) left.push({ t: x[i++], diff: !/^\s+$/.test(x[i - 1]) });
    else right.push({ t: y[j++], diff: !/^\s+$/.test(y[j - 1]) });
  }
  while (i < n) left.push({ t: x[i++], diff: !/^\s+$/.test(x[i - 1]) });
  while (j < m) right.push({ t: y[j++], diff: !/^\s+$/.test(y[j - 1]) });
  return { left, right };
}

export function CompareAnswers({ labels, answers, onClose }: { labels: [string, string]; answers: [string, string]; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const { left, right } = useMemo(() => mark(answers[0], answers[1]), [answers]);
  const same = useMemo(() => {
    const total = Math.max(left.filter((t) => t.t.trim()).length, right.filter((t) => t.t.trim()).length) || 1;
    return Math.round((left.filter((t) => !t.diff && t.t.trim()).length / total) * 100);
  }, [left, right]);

  const col = (label: string, toks: typeof left, empty: string) => (
    <section className="min-w-0 border-os-line first:border-r">
      <h3 className="sticky top-0 border-b border-os-line bg-os-bg px-4 py-2 text-[13px] font-semibold text-os-text">{label}</h3>
      <p className="whitespace-pre-wrap break-words px-4 py-3 text-[14px] leading-relaxed text-os-text">
        {toks.length === 0 ? <span className="text-os-muted">{empty}</span> : toks.map((t, i) => (t.diff ? <mark key={i} className="rounded-sm bg-[rgba(var(--os-cyan-rgb),0.2)] text-os-text">{t.t}</mark> : <span key={i}>{t.t}</span>))}
      </p>
    </section>
  );

  return (
    <div role="dialog" aria-modal="true" aria-label="Compare the two answers" className="absolute inset-0 z-30 flex flex-col bg-os-bg">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-os-line px-4">
        <p className="text-[15px] font-semibold text-os-text">
          Compare answers <span className="ml-2 text-sm font-normal text-os-muted">{same}% of the words are shared. Highlighted words appear in one answer only.</span>
        </p>
        <IconButton aria-label="Close" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-2 overflow-y-auto">
        {col(labels[0], left, 'No answer yet in this session.')}
        {col(labels[1], right, 'No answer yet in this session.')}
      </div>
    </div>
  );
}
