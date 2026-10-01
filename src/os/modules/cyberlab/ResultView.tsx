import { useState, type ReactNode } from 'react';
import { CheckCircle, Copy, Warning, XCircle } from '@phosphor-icons/react';
import { cx } from '../../ui/cx';
import { Button } from '../../ui';
import { TYPE_LABEL, type RunOut } from './api';

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isUrl = (s: string) => /^https?:\/\/[^\s]+$/.test(s);
const ACRONYMS = /\b(dns|asn|ip|url|cpes|cve|cves|rdap|spf|dmarc|dkim|mx|ns|ttl|gps|exif|pdf|md5|sha1|sha256)\b/gi;
const label = (k: string) => k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').replace(/^./, (c) => c.toUpperCase()).replace(ACRONYMS, (m) => m.toUpperCase());

function Scalar({ v }: { v: unknown }): ReactNode {
  if (v === null || v === undefined || v === '') return <span className="text-os-muted">none</span>;
  if (typeof v === 'boolean') return <span>{v ? 'yes' : 'no'}</span>;
  if (typeof v === 'string' && isUrl(v))
    return (
      <a href={v} target="_blank" rel="noopener noreferrer" className="break-all text-os-text underline decoration-os-contour underline-offset-4 hover:text-os-cyan">
        {v}
      </a>
    );
  return <span className="break-words font-os-mono text-[13px]">{String(v)}</span>;
}

const LEVEL = {
  good: { Icon: CheckCircle, text: 'Good', cls: 'text-os-ok' },
  warn: { Icon: Warning, text: 'Warning', cls: 'text-os-amber' },
  bad: { Icon: XCircle, text: 'Problem', cls: 'text-os-danger' },
} as const;

function Findings({ list }: { list: Array<{ level: keyof typeof LEVEL; text: string }> }) {
  return (
    <ul className="grid gap-1.5">
      {list.map((f, i) => {
        const L = LEVEL[f.level] ?? LEVEL.warn;
        return (
          <li key={i} className="flex items-start gap-2 text-sm">
            <L.Icon size={16} weight="fill" className={cx('mt-0.5 shrink-0', L.cls)} aria-hidden />
            <span>
              <span className={cx('font-medium', L.cls)}>{L.text}. </span>
              <span className="text-os-text">{f.text}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Table({ rows }: { rows: Array<Record<string, unknown>> }) {
  const [all, setAll] = useState(false);
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))].slice(0, 8);
  const shown = all ? rows : rows.slice(0, 60);
  return (
    <div>
      <div className="max-h-[420px] overflow-auto border border-os-line">
        <table className="w-full min-w-max text-left text-[13px]">
          <thead className="sticky top-0 bg-os-surface-2">
            <tr>
              {cols.map((c) => (
                <th key={c} scope="col" className="px-2.5 py-1.5 font-medium text-os-muted">
                  {label(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={i} className="border-t border-os-line align-top">
                {cols.map((c) => (
                  <td key={c} className="px-2.5 py-1.5">
                    <Value v={r[c]} depth={2} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 60 && !all && (
        <button type="button" onClick={() => setAll(true)} className="mt-1.5 text-xs text-os-muted underline underline-offset-4 hover:text-os-text">
          Show all {rows.length} rows
        </button>
      )}
    </div>
  );
}

function Value({ v, depth = 0 }: { v: unknown; depth?: number }): ReactNode {
  if (Array.isArray(v)) {
    if (v.length === 0) return <span className="text-os-muted">none</span>;
    if (v.every((x) => x && typeof x === 'object' && 'level' in x && 'text' in x)) return <Findings list={v as Array<{ level: keyof typeof LEVEL; text: string }>} />;
    if (v.every(isObj) && depth < 2) return <Table rows={v as Array<Record<string, unknown>>} />;
    if (v.every((x) => typeof x !== 'object' || x === null))
      return (
        <ul className="grid gap-0.5">
          {v.slice(0, 200).map((x, i) => (
            <li key={i}>
              <Scalar v={x} />
            </li>
          ))}
          {v.length > 200 && <li className="text-xs text-os-muted">and {v.length - 200} more</li>}
        </ul>
      );
    return <pre className="max-h-48 overflow-auto font-os-mono text-xs">{JSON.stringify(v, null, 1)}</pre>;
  }
  if (isObj(v)) {
    const entries = Object.entries(v).filter(([, x]) => x !== undefined);
    if (depth >= 3) return <pre className="max-h-48 overflow-auto font-os-mono text-xs">{JSON.stringify(v, null, 1)}</pre>;
    return (
      <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(7rem,12rem)_minmax(0,1fr)]">
        {entries.map(([k, x]) => (
          <div key={k} className="contents">
            <dt className="text-[13px] text-os-muted">{label(k)}</dt>
            <dd className="min-w-0 text-sm">
              <Value v={x} depth={depth + 1} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return <Scalar v={v} />;
}

export function ResultView({ run }: { run: RunOut }) {
  const [raw, setRaw] = useState(false);
  const counts = run.entities.reduce<Record<string, number>>((m, e) => ((m[e.type] = (m[e.type] ?? 0) + 1), m), {});
  return (
    <div className="grid gap-4">
      <div>
        <p className="os-display text-[24px] text-os-text">{run.summary}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-os-mono text-xs text-os-muted">
          <span>run {run.id}</span>
          <span>{run.ms} ms</span>
          {run.sha256 && (
            <span className="inline-flex items-center gap-1">
              sha256 {run.sha256.slice(0, 16)}
              <button type="button" aria-label="Copy the full SHA-256 of this output" onClick={() => void navigator.clipboard?.writeText(run.sha256 ?? '')} className="grid h-5 w-5 place-items-center text-os-muted hover:text-os-text">
                <Copy size={12} aria-hidden />
              </button>
            </span>
          )}
        </p>
      </div>
      {Object.keys(counts).length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Entities found">
          {Object.entries(counts).map(([t, n]) => (
            <li key={t} className="border border-os-line px-2 py-0.5 text-xs text-os-text">
              {n} {TYPE_LABEL[t] ?? t}
              {n > 1 && t !== 'hash' ? 's' : ''}
            </li>
          ))}
        </ul>
      )}
      <div>{raw ? <pre className="max-h-[480px] overflow-auto border border-os-line bg-os-bg p-3 font-os-mono text-xs">{JSON.stringify(run.data, null, 2)}</pre> : <Value v={run.data} />}</div>
      <div>
        <Button size="sm" variant="ghost" onClick={() => setRaw((r) => !r)}>
          {raw ? 'Show formatted' : 'Show raw JSON'}
        </Button>
      </div>
    </div>
  );
}
