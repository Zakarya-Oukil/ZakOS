export type AgentEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; id: string; output: string; isError: boolean }
  | { type: 'status'; state: string }
  | { type: 'done'; cliSessionId?: string }
  | { type: 'error'; message: string };

import type { Trust } from '../settings';

export interface AgentRunOptions {
  prompt: string;
  /** Permission level for this run, already resolved from the project or global setting. */
  trust: Trust;
  cwd: string;
  cliSessionId?: string;
  resume: boolean;
  signal: AbortSignal;
}

export interface AgentAdapter {
  id: string;
  label: string;
  detect(): Promise<{ available: boolean; reason?: string; version?: string }>;
  run(opts: AgentRunOptions): AsyncIterable<AgentEvent>;
}
