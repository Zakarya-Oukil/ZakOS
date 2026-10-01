import { useEffect, useMemo, useState } from 'react';
import { Star } from '@phosphor-icons/react';
import { EmptyState, ErrorNote, inputCls } from '../../ui';
import { useResource } from '../../lib/api';
import { cx } from '../../ui/cx';
import type { Catalogue } from './api';

const PHASES: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'infrastructure', label: 'Infrastructure' },
  { id: 'identity', label: 'People and identity' },
  { id: 'organisation', label: 'Organisations' },
  { id: 'code', label: 'Code and pastes' },
  { id: 'files', label: 'Files and documents' },
  { id: 'media', label: 'Images' },
  { id: 'threat', label: 'Threat intelligence' },
  { id: 'search', label: 'Search' },
  { id: 'misc', label: 'Other' },
];
const KEY = 'zakos_cyberlab_pins';
const readPins = (): string[] => {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
};

export function CatalogueTab() {
  const { data, error } = useResource<Catalogue>('/api/cyberlab/catalogue');
  const [q, setQ] = useState('');
  const [phase, setPhase] = useState('all');
  const [group, setGroup] = useState('all');
  const [pinsOnly, setPinsOnly] = useState(false);
  const [pins, setPins] = useState<string[]>(readPins);
  const [limit, setLimit] = useState(80);

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(pins));
    } catch {
      /* storage blocked */
    }
  }, [pins]);
  useEffect(() => setLimit(80), [q, phase, group, pinsOnly]);

  const groups = useMemo(() => ['all', ...new Set((data?.entries ?? []).filter((e) => phase === 'all' || e.phase === phase).map((e) => e.group))].sort((a, b) => (a === 'all' ? -1 : b === 'all' ? 1 : a.localeCompare(b))), [data, phase]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.entries ?? []).filter((e) => (phase === 'all' || e.phase === phase) && (group === 'all' || e.group === group) && (!pinsOnly || pins.includes(e.url)) && (!s || `${e.name} ${e.note} ${e.group}`.toLowerCase().includes(s)));
  }, [data, q, phase, group, pinsOnly, pins]);

  if (error) return <div className="p-5"><ErrorNote>{error}</ErrorNote></div>;
  if (!data) return <p className="p-5 text-sm text-os-muted">Loading the catalogue</p>;

  return (
    <div className="mx-auto grid max-w-5xl gap-4 p-5">
      <p className="max-w-[72ch] text-[14px] leading-relaxed text-os-muted">
        {data.entries.length} tools picked from <a className="text-os-text underline underline-offset-4" href={data.source} target="_blank" rel="noopener noreferrer">awesome-osint</a> for recon work: infrastructure, identity, organisations, code, files, images and threat intelligence. Social media, maps, news, VPN and browser sections were left out. These open on their own sites, so check each one’s terms before you use it on a target. The list is licensed {data.licence}; fetched {data.fetched}.
      </p>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div>
          <label htmlFor="cat-q" className="sr-only">Search the catalogue</label>
          <input id="cat-q" className={inputCls} placeholder="Search by name or what it does" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div>
          <label htmlFor="cat-group" className="sr-only">Category</label>
          <select id="cat-group" className={cx(inputCls, 'sm:w-auto')} value={group} onChange={(e) => setGroup(e.target.value)}>
            {groups.map((g) => <option key={g} value={g}>{g === 'all' ? 'All categories' : g}</option>)}
          </select>
        </div>
        <label className="flex h-10 items-center gap-2 text-sm text-os-text">
          <input type="checkbox" checked={pinsOnly} onChange={(e) => setPinsOnly(e.target.checked)} /> Pinned only ({pins.length})
        </label>
      </div>
      <div role="group" aria-label="Recon phase" className="flex flex-wrap gap-1.5">
        {PHASES.map((p) => (
          <button key={p.id} type="button" aria-pressed={phase === p.id} onClick={() => { setPhase(p.id); setGroup('all'); }} className={cx('h-8 border px-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]', phase === p.id ? 'border-os-cyan text-os-text' : 'border-os-line text-os-muted hover:text-os-text')}>
            {p.label}
          </button>
        ))}
      </div>
      <p className="text-[13px] text-os-muted" role="status">{list.length} tools</p>
      {list.length === 0 ? (
        <EmptyState title="Nothing matches">Try a shorter search or a different category.</EmptyState>
      ) : (
        <ul className="grid gap-px border border-os-line bg-os-line">
          {list.slice(0, limit).map((e) => {
            const on = pins.includes(e.url);
            return (
              <li key={e.url} className="flex items-start gap-3 bg-os-surface px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-[15px] font-semibold text-os-text underline decoration-os-contour underline-offset-4 hover:text-os-cyan">{e.name}</a>
                    <span className="text-xs text-os-muted">{e.group}</span>
                  </p>
                  {e.note && <p className="mt-0.5 max-w-[80ch] text-[13px] leading-relaxed text-os-muted">{e.note}</p>}
                </div>
                <button type="button" aria-pressed={on} aria-label={`${on ? 'Unpin' : 'Pin'} ${e.name}`} onClick={() => setPins((p) => (on ? p.filter((x) => x !== e.url) : [...p, e.url]))} className="grid h-8 w-8 shrink-0 place-items-center text-os-muted hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]">
                  <Star size={18} weight={on ? 'fill' : 'regular'} className={on ? 'text-os-cyan' : undefined} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {list.length > limit && (
        <button type="button" onClick={() => setLimit((l) => l + 120)} className="justify-self-start text-sm text-os-text underline underline-offset-4">Show more ({list.length - limit} left)</button>
      )}
    </div>
  );
}
