import fs from 'node:fs';
import path from 'node:path';
import { getAdapter } from '../agents/adapters';
import type { Broadcast } from '../agents/runner';
import { DEFAULT_OPTIONS, startRun, withDefaults, type Role, type Run, type RunOptions } from './engine';

/** Everything needed to start a run; also what a template or a schedule stores. */
export interface LaunchInput {
  goal: string;
  cwd: string;
  projectId?: string;
  options: RunOptions;
}

export type Parsed = { ok: true; input: LaunchInput } | { ok: false; status: number; error: string };

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const ROLES: Role[] = ['orchestrator', 'worker', 'reviewer'];

/**
 * Validates untrusted input (an HTTP body, a stored template) into a LaunchInput.
 * Every role must name a real, installed agent so a typo or missing CLI fails here, not mid-run.
 */
export async function parseLaunch(body: Record<string, any> | undefined): Promise<Parsed> {
  const goal = str(body?.goal);
  if (!goal) return { ok: false, status: 400, error: 'goal is required' };

  const rawCwd = body?.cwd;
  if (rawCwd !== undefined && rawCwd !== '' && typeof rawCwd !== 'string') return { ok: false, status: 400, error: 'cwd must be a string' };
  const cwd = path.resolve(str(rawCwd) ?? process.cwd());
  let isDir = false;
  try {
    isDir = fs.statSync(cwd).isDirectory();
  } catch {
    /* missing or unreadable */
  }
  if (!isDir) return { ok: false, status: 400, error: 'cwd does not exist or is not a directory' };

  const agents: Partial<Record<Role, string>> = {};
  for (const role of ROLES) {
    const id = str(body?.agents?.[role]);
    if (!id) continue;
    const adapter = getAdapter(id);
    if (!adapter) return { ok: false, status: 400, error: `Unknown agent for ${role}: ${id}` };
    const status = await adapter.detect();
    if (!status.available) return { ok: false, status: 400, error: `${adapter.label} is not available (${status.reason ?? 'not installed'})` };
    agents[role] = id;
  }

  return {
    ok: true,
    input: {
      goal: goal.slice(0, 4000),
      cwd,
      projectId: str(body?.projectId)?.slice(0, 64),
      options: withDefaults({
        approval: body?.approval !== false,
        worktrees: body?.worktrees !== false,
        agents: agents as RunOptions['agents'],
        outcomes: {
          obsidian: body?.outcomes?.obsidian ?? DEFAULT_OPTIONS.outcomes.obsidian,
          pr: body?.outcomes?.pr === true,
          notify: body?.outcomes?.notify ?? DEFAULT_OPTIONS.outcomes.notify,
          graphify: body?.outcomes?.graphify === true,
        },
      }),
    },
  };
}

export function launchRun(input: LaunchInput, broadcast: Broadcast): Run {
  return startRun(input.goal, input.cwd, input.projectId, input.options, broadcast);
}

/** Flattens a LaunchInput back into the body shape parseLaunch accepts (used to revalidate stored input). */
export function toBody(input: LaunchInput): Record<string, unknown> {
  return {
    goal: input.goal,
    cwd: input.cwd,
    projectId: input.projectId,
    approval: input.options.approval,
    worktrees: input.options.worktrees,
    agents: input.options.agents,
    outcomes: input.options.outcomes,
  };
}

export { DEFAULT_OPTIONS };
