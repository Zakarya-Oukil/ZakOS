import fs from 'node:fs';
import path from 'node:path';
import type { RateWindows, UsageReport } from './adapters/types';
import { insertUsage } from './store';

/**
 * Usage tracking. Tokens and cost are only known for what Claude Code reports about runs that went
 * through Zak OS. Plan windows (the 5-hour and weekly limits) are whatever Claude last said, so they
 * are a snapshot with a timestamp, not a live reading. Other agents report neither.
 */
export interface WindowSnapshot {
  /** 0 to 1, how much of the window has been used. */
  utilization: number;
  /** Unix seconds when the window resets. */
  resetsAt: number;
}

export interface ProviderSnapshot {
  fiveHour?: WindowSnapshot;
  sevenDay?: WindowSnapshot;
  status?: string;
  updated: number;
}

const FILE = path.resolve(process.cwd(), 'data', 'provider-limits.json');

function read(): Record<string, ProviderSnapshot> {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export const getSnapshots = (): Record<string, ProviderSnapshot> => read();

export function recordWindows(agent: string, w: RateWindows) {
  const all = read();
  const win = (x?: { utilization: number; resetsAt: number }): WindowSnapshot | undefined =>
    x && Number.isFinite(x.utilization) && Number.isFinite(x.resetsAt) ? { utilization: x.utilization, resetsAt: x.resetsAt } : undefined;
  // Keep the previous reading of a window that this event did not mention.
  all[agent] = { ...all[agent], fiveHour: win(w.fiveHour) ?? all[agent]?.fiveHour, sevenDay: win(w.sevenDay) ?? all[agent]?.sevenDay, status: w.status ?? all[agent]?.status, updated: Date.now() };
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(all, null, 2));
}

export function recordUsage(agent: string, sessionId: string, u: UsageReport) {
  try {
    insertUsage({ agent, session_id: sessionId, input: u.input, output: u.output, cache_read: u.cacheRead, cache_write: u.cacheWrite, cost_usd: u.costUsd, model: u.model ?? null });
  } catch (err) {
    console.error('[usage] could not write:', err instanceof Error ? err.message : err);
  }
}
