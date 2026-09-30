import { useCallback, useEffect, useState } from 'react';
import { agentsSocket } from '../../lib/agentsSocket';

export interface Totals {
  runs: number;
  tokens: number;
  costUsd: number;
}

export interface Window {
  utilization: number;
  resetsAt: number;
}

export interface Provider {
  id: string;
  label: string;
  available: boolean;
  version: string | null;
  reason: string | null;
  reportsUsage: boolean;
  trackedSince: number | null;
  lastHour: Totals;
  last5Hours: Totals;
  lastDay: Totals;
  lastWeek: Totals;
  windows: { fiveHour: Window | null; sevenDay: Window | null; status: string | null; updated: number } | null;
}

export interface HomeData {
  attention: {
    approvals: number;
    runsAwaiting: Array<{ id: string; goal: string }>;
    failedRuns: Array<{ id: string; goal: string; error: string | null }>;
    unreadNotifications: number;
  };
  running: {
    sessions: Array<{ id: string; agent: string; title: string; cwd: string; updated: number }>;
    runs: Array<{ id: string; goal: string; status: string; done: number; total: number }>;
  };
  schedules: Array<{
    id: string;
    name: string;
    trigger: { kind: 'cron'; cron: string } | { kind: 'commit' };
    enabled: boolean;
    nextAt: number | null;
    lastRunAt: number | null;
    lastRunId: string | null;
    lastStatus: string | null;
    lastError: string | null;
  }>;
  activity: Array<{ id: number; ts: number; kind: string; actor: string; detail: string; session_id: string | null; run_id: string | null; project: string | null }>;
  providers: Provider[];
  projects: Array<{ id: string; name: string; color: string; path: string; exists: boolean; graphUpdated: number | null; lastSessionAt: number | null }>;
  limits: { runsToday: number; maxRunsPerDay: number; activeRuns: number; maxActiveRuns: number };
}

async function call<T>(path: string): Promise<T> {
  const res = await fetch(path);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

/** The whole dashboard, refreshed when anything it shows changes and on a slow poll as a safety net. */
export function useHome() {
  const [home, setHome] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    call<{ home: HomeData }>('/api/home')
      .then((r) => {
        setHome(r.home);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(refresh, [refresh]);
  useEffect(() => {
    // Bursts of events (every streamed token is one) collapse into one refresh.
    let timer: number | undefined;
    const soon = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(refresh, 600);
    };
    const offs = [
      agentsSocket.subscribeApprovals(soon),
      agentsSocket.subscribeWorkflows(soon),
      agentsSocket.subscribeNotifications(soon),
      agentsSocket.subscribe((m) => m.event.type === 'status' && soon()),
    ];
    const poll = window.setInterval(refresh, 20_000);
    return () => {
      offs.forEach((off) => off());
      window.clearTimeout(timer);
      window.clearInterval(poll);
    };
  }, [refresh]);

  return { home, error, refresh };
}
