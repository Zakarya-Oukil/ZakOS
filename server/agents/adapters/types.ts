export type AgentEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; id: string; output: string; isError: boolean }
  | { type: 'status'; state: string }
  | { type: 'permission_denied'; denials: Denial[] }
  | { type: 'usage'; usage: UsageReport }
  | { type: 'rate_limit'; windows: RateWindows }
  | { type: 'done'; cliSessionId?: string }
  | { type: 'error'; message: string };

import type { Trust } from '../settings';

/** Tokens and cost for one run, as the CLI reported them. */
export interface UsageReport {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  costUsd: number;
  model?: string;
}

/** The plan windows a CLI reported: utilization is 0 to 1, resetsAt is unix seconds. */
export interface RateWindows {
  fiveHour?: { utilization: number; resetsAt: number };
  sevenDay?: { utilization: number; resetsAt: number };
  status?: string;
}

/** An action the CLI refused because it needed a permission the session did not have. */
export interface Denial {
  tool: string;
  input: Record<string, unknown>;
}

export interface AgentRunOptions {
  prompt: string;
  /** Permission level for this run, already resolved from the project or global setting. */
  trust: Trust;
  cwd: string;
  cliSessionId?: string;
  resume: boolean;
  /** Resume `cliSessionId` as a copy: the conversation continues under a new id (Claude only). */
  fork?: boolean;
  /** Model for this session (Claude only): an alias like opus or a full model id. */
  model?: string;
  /** Claude permission rules granted for this turn only, e.g. `Bash(npm test)`. */
  allowedTools?: string[];
  signal: AbortSignal;
}

export interface AgentAdapter {
  id: string;
  label: string;
  detect(): Promise<{ available: boolean; reason?: string; version?: string }>;
  run(opts: AgentRunOptions): AsyncIterable<AgentEvent>;
}
