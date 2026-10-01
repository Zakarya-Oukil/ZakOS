import { useMemo, useState } from 'react';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { Button } from '../../ui';
import { cx } from '../../ui/cx';
import { useResource } from '../../lib/api';

interface Ev {
  id: string;
  name: string;
  at: number;
  kind: 'planned' | 'ran';
  status?: string;
}

const DAY = 86_400_000;
const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Past runs and the next planned ones on one calendar. A busy day collapses to a count so the grid stays readable. */
export function AutomationCalendar({ onOpen }: { onOpen: (id: string) => void }) {
  const { data } = useResource<{ events: Ev[] }>('/api/automation-calendar?days=42');
  const [weekOffset, setWeekOffset] = useState(0);
  const [openDay, setOpenDay] = useState<number | null>(null);

  const monday = useMemo(() => {
    const d = new Date(startOfDay(Date.now()));
    const dow = (d.getDay() + 6) % 7;
    return d.getTime() - dow * DAY + weekOffset * 7 * DAY;
  }, [weekOffset]);

  const days = useMemo(() => {
    const out: Array<{ t: number; events: Ev[] }> = [];
    for (let i = 0; i < 28; i++) {
      const t = monday + i * DAY;
      out.push({ t, events: (data?.events ?? []).filter((e) => e.at >= t && e.at < t + DAY) });
    }
    return out;
  }, [monday, data]);

  const today = startOfDay(Date.now());
  const picked = openDay !== null ? days.find((d) => d.t === openDay) : undefined;
  const label = `${new Date(monday).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} to ${new Date(monday + 27 * DAY).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
      <div className="flex items-center justify-between border-b border-os-line px-5 py-3">
        <p className="text-[15px] font-semibold text-os-text">{label}</p>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" aria-label="Earlier" onClick={() => setWeekOffset((w) => w - 4)}><CaretLeft size={14} aria-hidden /></Button>
          <Button size="sm" variant="ghost" onClick={() => setWeekOffset(0)}>Today</Button>
          <Button size="sm" variant="ghost" aria-label="Later" onClick={() => setWeekOffset((w) => w + 4)}><CaretRight size={14} aria-hidden /></Button>
        </div>
      </div>
      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)] overflow-y-auto lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="p-4">
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-[var(--os-radius-lg)] border border-os-line bg-os-line">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="bg-os-surface px-2 py-1.5 text-xs font-medium text-os-muted">{d}</div>
            ))}
            {days.map((d) => {
              const date = new Date(d.t);
              const ran = d.events.filter((e) => e.kind === 'ran');
              const planned = d.events.filter((e) => e.kind === 'planned');
              return (
                <button
                  key={d.t}
                  type="button"
                  onClick={() => setOpenDay(d.t === openDay ? null : d.t)}
                  aria-label={`${date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}, ${ran.length} run${ran.length === 1 ? '' : 's'}, ${planned.length} planned`}
                  aria-pressed={d.t === openDay}
                  className={cx(
                    'grid min-h-[88px] content-start gap-1 bg-os-surface p-2 text-left transition-colors hover:bg-os-surface-2 focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--os-cyan)]',
                    d.t < today && 'opacity-80',
                    d.t === openDay && 'bg-os-surface-2',
                  )}
                >
                  <span className={cx('text-xs tabular-nums', d.t === today ? 'font-bold text-os-cyan' : 'text-os-muted')}>{date.getDate()}</span>
                  {ran.length > 0 && <span className="truncate text-xs text-os-text">{ran.length === 1 ? ran[0].name : `${ran.length} runs`}</span>}
                  {planned.length > 0 && <span className="truncate text-xs text-os-muted">{planned.length === 1 ? `${new Date(planned[0].at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ${planned[0].name}` : `${planned.length} planned`}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <aside className="border-t border-os-line p-4 lg:border-l lg:border-t-0" aria-label="Day details">
          {!picked ? (
            <p className="text-sm text-os-muted">Pick a day to see what ran and what is planned.</p>
          ) : (
            <div className="grid gap-3">
              <h3 className="text-sm font-semibold text-os-text">{new Date(picked.t).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
              {picked.events.length === 0 && <p className="text-sm text-os-muted">Nothing on this day.</p>}
              <ul className="grid gap-1.5">
                {picked.events.slice(0, 40).map((e, i) => (
                  <li key={i}>
                    <button type="button" onClick={() => onOpen(e.id)} className="flex w-full items-baseline gap-2 rounded-[var(--os-radius)] px-2 py-1.5 text-left hover:bg-os-surface-2 focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]">
                      <span className="w-12 shrink-0 text-xs tabular-nums text-os-muted">{new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-os-text">{e.name}</span>
                      <span className={cx('text-xs', e.kind === 'planned' ? 'text-os-muted' : e.status === 'error' ? 'text-os-danger' : 'text-os-ok')}>{e.kind === 'planned' ? 'planned' : e.status ?? 'ran'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
