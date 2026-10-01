import { useEffect, useState } from 'react';
import { Copy, FloppyDisk } from '@phosphor-icons/react';
import type { ModuleProps } from '../registry';
import { PageFrame } from '../../shell/PageFrame';
import { Button, EmptyState, ErrorNote, Markdown, Panel, Segmented, SuccessNote } from '../../ui';
import { api } from '../../lib/api';
import { timeAgo } from '../../lib/projectsApi';

type Schedule = 'off' | 'daily' | 'weekly';

export default function ReportsPage(_props: ModuleProps) {
  const [days, setDays] = useState<'1' | '7' | '30'>('7');
  const [report, setReport] = useState<{ title: string; markdown: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<Schedule>('off');
  const [lastAt, setLastAt] = useState<number | null>(null);

  useEffect(() => {
    api<{ settings: { schedule: Schedule; lastAt: number | null } }>('/api/reports/settings')
      .then((d) => {
        setSchedule(d.settings.schedule);
        setLastAt(d.settings.lastAt);
      })
      .catch(() => undefined);
  }, []);

  const generate = async (save: boolean) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const d = await api<{ title: string; markdown: string; saved: string | null }>('/api/reports/generate', { method: 'POST', body: { days: Number(days), save } });
      setReport({ title: d.title, markdown: d.markdown });
      if (d.saved) {
        setNotice(`Saved to the vault as ${d.saved}`);
        setLastAt(Date.now());
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const changeSchedule = async (s: Schedule) => {
    setSchedule(s);
    try {
      await api('/api/reports/settings', { method: 'PUT', body: { schedule: s } });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const copy = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report.markdown);
      setNotice('Copied as Markdown');
    } catch {
      setError('The browser blocked copying. Select the text and copy it by hand.');
    }
  };

  return (
    <PageFrame
      title="Reports"
      actions={
        <>
          <Segmented<'1' | '7' | '30'> label="Period" value={days} onChange={setDays} options={[{ id: '1', label: 'Day' }, { id: '7', label: 'Week' }, { id: '30', label: 'Month' }]} />
          <Button variant="primary" size="sm" onClick={() => generate(false)} disabled={busy}>
            {busy ? 'Building' : 'Generate report'}
          </Button>
        </>
      }
    >
      <div className="h-full overflow-y-auto p-5">
        <div className="mx-auto grid max-w-[1100px] items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Panel
            title={report?.title ?? 'Report'}
            header={
              report && (
                <>
                  <Button size="sm" variant="ghost" onClick={copy}>
                    <Copy size={15} aria-hidden /> Copy
                  </Button>
                  <Button size="sm" onClick={() => generate(true)} disabled={busy}>
                    <FloppyDisk size={15} aria-hidden /> Save to vault
                  </Button>
                </>
              )
            }
          >
            {error && <ErrorNote>{error}</ErrorNote>}
            {notice && <SuccessNote>{notice}</SuccessNote>}
            {report ? (
              <div className="mt-3 max-w-[72ch]">
                <Markdown text={report.markdown} />
              </div>
            ) : (
              <EmptyState title="No report yet">Pick a period and generate one. It covers what was done, what it cost, what is open and what to do next, built from your own audit log, runs and task board.</EmptyState>
            )}
          </Panel>

          <Panel title="Schedule">
            <p className="mb-3 text-sm leading-relaxed text-os-muted">Save a report to the vault automatically while Zak OS is running.</p>
            <Segmented<Schedule> label="Schedule" value={schedule} onChange={changeSchedule} options={[{ id: 'off', label: 'Off' }, { id: 'daily', label: 'Daily' }, { id: 'weekly', label: 'Weekly' }]} />
            <p className="mt-3 text-xs text-os-muted">{lastAt ? `Last saved ${timeAgo(lastAt)}.` : 'Nothing saved yet.'} Reports go to the 00 Reports folder in your vault. Email delivery arrives with the email integration.</p>
          </Panel>
        </div>
      </div>
    </PageFrame>
  );
}
