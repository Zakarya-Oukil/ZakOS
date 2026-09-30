import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { sendMessage, stop as stopSession, type Broadcast } from '../agents/runner';
import * as sessions from '../agents/store';
import { trustForPath } from '../projects/store';
import { commitWorktree, createWorktree, isGitRepo, mergeBranch, removeWorktree, type Worktree } from './worktree';

export type RunStatus = 'planning' | 'awaiting_approval' | 'running' | 'reviewing' | 'reporting' | 'done' | 'error' | 'stopped';
export type TaskState = 'queued' | 'running' | 'done' | 'error';

export interface Task {
  id: string;
  title: string;
  prompt: string;
  state: TaskState;
  sessionId?: string;
  result?: string;
  error?: string;
  /** Set when the task ran in its own git worktree. */
  branch?: string;
  filesChanged?: number;
  merge?: 'merged' | 'nochanges' | 'conflict' | 'failed';
  mergeNote?: string;
}

export type Role = 'orchestrator' | 'worker' | 'reviewer';

export interface RunOptions {
  /** Pause after the plan so the owner can edit and approve the tasks. */
  approval: boolean;
  /** Which agent adapter plays each role. */
  agents: Record<Role, string>;
  /** Give every worker its own git worktree and branch, merged back afterwards (git repos only). */
  worktrees: boolean;
}

export const DEFAULT_OPTIONS: RunOptions = {
  approval: true,
  worktrees: true,
  agents: { orchestrator: 'claude', worker: 'claude', reviewer: 'claude' },
};

/** Merges a partial option set over the defaults, including the nested agents map. */
export function withDefaults(o: Partial<RunOptions> | undefined): RunOptions {
  return { ...DEFAULT_OPTIONS, ...o, agents: { ...DEFAULT_OPTIONS.agents, ...o?.agents } };
}

export interface Run {
  id: string;
  options: RunOptions;
  goal: string;
  cwd: string;
  projectId?: string;
  /** Permission level every session of this run uses, fixed when the run starts. */
  trust?: string;
  status: RunStatus;
  created: number;
  updated: number;
  summary?: string;
  tasks: Task[];
  orchestratorSessionId?: string;
  reviewerSessionId?: string;
  review?: string;
  verdict?: 'pass' | 'needs_work';
  report?: string;
  error?: string;
}

const MAX_TASKS = 5;
const CONCURRENCY = 3;
const RESULT_LIMIT = 6000;
const TURN_TIMEOUT_MS = 30 * 60 * 1000;
const FILE = path.resolve(process.cwd(), 'data', 'workflow-runs.json');

const runs = new Map<string, Run>();
const stopped = new Set<string>();
/** Open approval gates: resolved with the approved tasks, or null to cancel. */
/** Live worktrees by task id, needed for merge and cleanup. */
const worktrees = new Map<string, Worktree>();
const gates = new Map<string, (tasks: Task[] | null) => void>();

// ---- persistence ------------------------------------------------------------------------------

try {
  const saved = JSON.parse(fs.readFileSync(FILE, 'utf8')) as Run[];
  for (const r of saved) {
    // A restart leaves no live child processes, so anything mid-flight is over.
    r.options = withDefaults(r.options);
    if (['planning', 'awaiting_approval', 'running', 'reviewing', 'reporting'].includes(r.status)) {
      r.status = 'stopped';
      r.error = 'Server restarted during the run';
      for (const t of r.tasks) if (t.state === 'running' || t.state === 'queued') t.state = 'error';
    }
    runs.set(r.id, r);
  }
} catch (err) {
  if (fs.existsSync(FILE)) {
    // Unreadable file: keep it for inspection instead of overwriting it on the next save.
    try {
      fs.copyFileSync(FILE, `${FILE}.corrupt-${Date.now()}`);
    } catch {
      /* best effort */
    }
    console.error('[workflows] saved runs were unreadable:', err instanceof Error ? err.message : err);
  }
}

/** Never throws: a failed save must not take down a run that is still doing real work. */
function persist() {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    const tmp = `${FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify([...runs.values()], null, 2));
    fs.renameSync(tmp, FILE);
  } catch (err) {
    console.error('[workflows] could not save runs:', err instanceof Error ? err.message : err);
  }
}

export function listRuns(): Run[] {
  return [...runs.values()].sort((a, b) => b.created - a.created);
}

export function getRun(id: string): Run | undefined {
  return runs.get(id);
}

export function deleteRun(id: string): boolean {
  if (isActive(id)) return false;
  const ok = runs.delete(id);
  if (ok) persist();
  return ok;
}

const isActive = (id: string) => {
  const s = runs.get(id)?.status;
  return s === 'planning' || s === 'awaiting_approval' || s === 'running' || s === 'reviewing' || s === 'reporting';
};

// ---- one agent turn, awaited ------------------------------------------------------------------

interface TurnResult {
  text: string;
  error?: string;
}

/** Runs one prompt on a session and resolves with its full text once the turn ends. */
function runTurn(sessionId: string, prompt: string, broadcast: Broadcast): Promise<TurnResult> {
  return new Promise<TurnResult>((resolve, reject) => {
    let text = '';
    let error: string | undefined;
    // A hung CLI must not hold a run forever: stopping the session ends the turn with an error.
    const timer = setTimeout(() => {
      error = 'Timed out after 30 minutes';
      stopSession(sessionId);
    }, TURN_TIMEOUT_MS);
    const watch: Broadcast = (data) => {
      broadcast(data);
      const m = data as { channel?: string; sessionId?: string; event?: { type: string; delta?: string; message?: string; state?: string } };
      if (m.channel !== 'agents' || m.sessionId !== sessionId || !m.event) return;
      const ev = m.event;
      if (ev.type === 'text' && ev.delta) text += ev.delta;
      else if (ev.type === 'error') error = ev.message;
      else if (ev.type === 'status' && ev.state !== 'running') {
        clearTimeout(timer);
        resolve({ text, error });
      }
    };
    sendMessage(sessionId, prompt, watch).catch((err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function newSession(agent: string, title: string, cwd: string, trust?: string): string {
  return sessions.createSession(randomUUID(), agent, title.slice(0, 120), cwd, trust ?? null).id;
}

/** Pulls the first balanced JSON object out of free text (agents often wrap it in prose or fences). */
function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  for (let s = start; s !== -1; s = text.indexOf('{', s + 1)) {
    let depth = 0;
    let inStr = false;
    for (let i = s; i < text.length; i++) {
      const c = text[i];
      if (inStr) {
        if (c === '\\') i++;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) {
        try {
          const parsed = JSON.parse(text.slice(s, i + 1));
          if (parsed && typeof parsed === 'object' && 'tasks' in parsed) return parsed;
        } catch {
          /* not this one, try the next opening brace */
        }
        break;
      }
    }
  }
  throw new Error('The orchestrator did not return a valid plan');
}

const clip = (s: string, n = RESULT_LIMIT) => (s.length > n ? `${s.slice(0, n)}\n(shortened)` : s);

// ---- prompts ----------------------------------------------------------------------------------

const planPrompt = (goal: string) => `You are the orchestrator of a small agent team working in this repository.
Do not modify any files. You may read the code to plan.

Goal from the owner:
${goal}

Split the goal into at most ${MAX_TASKS} independent tasks that sub-agents can do in parallel.
Each task must touch a different set of files so they do not conflict, and its prompt must be
self-contained (the sub-agent has no other context).

Reply with ONLY a JSON object, no prose:
{"summary": "one sentence plan", "tasks": [{"title": "short title", "prompt": "full instructions"}]}`;

const reviewPrompt = (run: Run) => `You are the reviewer. Do not implement anything and do not change files.
Owner goal: ${run.goal}

Sub-agents reported the following:
${run.tasks.map((t, i) => `## Task ${i + 1}: ${t.title}${t.state === 'error' ? ' (FAILED)' : ''}${t.merge === 'conflict' || t.merge === 'failed' ? ` (NOT MERGED: ${t.mergeNote ?? t.merge})` : ''}\n${clip([t.result, t.error && `Error: ${t.error}`].filter(Boolean).join('\n') || '(no output)')}`).join('\n\n')}

Check the actual state of the repository (for example with git status and git diff, and by running the
project's tests or type check if they exist). Do not trust the reports alone.
Finish with a line "VERDICT: PASS" or "VERDICT: NEEDS_WORK", preceded by a short list of concrete issues if any.`;

const reportPrompt = (run: Run) => `Write the final report for the owner in markdown. Sections: What was done, What the reviewer found,
What still needs attention. Be plain and specific, no filler.

Reviewer output:
${clip(run.review ?? '(none)')}`;

// ---- the run ----------------------------------------------------------------------------------

export function startRun(goal: string, cwd: string, projectId: string | undefined, options: Partial<RunOptions>, broadcast: Broadcast): Run {
  const now = Date.now();
  const run: Run = { id: randomUUID(), options: withDefaults(options), trust: trustForPath(cwd), goal, cwd, projectId, status: 'planning', created: now, updated: now, tasks: [] };
  runs.set(run.id, run);
  persist();
  void execute(run, broadcast);
  return run;
}

const toTask = (t: { title: string; prompt: string }): Task => ({ id: randomUUID(), title: t.title.trim().slice(0, 120), prompt: t.prompt.trim(), state: 'queued' });

/** Approves a run waiting at the gate. `edits` replaces the planned tasks; omit to keep them. */
export function approveRun(id: string, edits?: Array<{ title?: unknown; prompt?: unknown }>): { ok: true } | { ok: false; error: string } {
  const run = runs.get(id);
  const gate = gates.get(id);
  if (!run || !gate || run.status !== 'awaiting_approval') return { ok: false, error: 'This run is not waiting for approval' };
  let tasks = run.tasks;
  if (edits) {
    const clean = edits.filter((t): t is { title: string; prompt: string } => typeof t?.title === 'string' && typeof t?.prompt === 'string' && t.title.trim() !== '' && t.prompt.trim() !== '');
    if (clean.length === 0) return { ok: false, error: 'Keep at least one task with a title and instructions' };
    tasks = clean.slice(0, MAX_TASKS).map(toTask);
  }
  gate(tasks);
  return { ok: true };
}

export function stopRun(id: string): boolean {
  const run = runs.get(id);
  if (!run || !isActive(id)) return false;
  stopped.add(id);
  gates.get(id)?.(null);
  for (const sid of [run.orchestratorSessionId, run.reviewerSessionId, ...run.tasks.map((t) => t.sessionId)]) {
    if (sid) stopSession(sid);
  }
  return true;
}

/** Merges finished task branches sequentially, then removes the worktrees. */
async function mergeAll(run: Run, update: (p?: Partial<Run>) => void) {
  for (const task of run.tasks) {
    const wt = worktrees.get(task.id);
    if (!wt) continue;
    let dropBranch = false;
    if (task.state !== 'done') {
      task.merge = 'failed';
      task.mergeNote = `Task did not finish, work kept on branch ${wt.branch}`;
    } else if (!task.filesChanged) {
      task.merge = 'nochanges';
      dropBranch = true;
    } else {
      const outcome = await mergeBranch(wt.repoRoot, wt.branch, `zakos: merge ${task.title}`);
      task.merge = outcome.state;
      if (outcome.state === 'merged') dropBranch = true;
      else task.mergeNote = outcome.note;
    }
    await removeWorktree(wt, dropBranch);
    worktrees.delete(task.id);
    update();
  }
}

/** On stop or failure: keep whatever each worker produced on its branch, then free the checkouts. */
async function abandonWorktrees(run: Run) {
  for (const task of run.tasks) {
    const wt = worktrees.get(task.id);
    if (!wt) continue;
    try {
      task.filesChanged = await commitWorktree(wt, `zakos: ${task.title} (unfinished)`);
    } catch {
      /* best effort */
    }
    task.merge = 'failed';
    task.mergeNote = `Run ended early, work kept on branch ${wt.branch}`;
    await removeWorktree(wt, !task.filesChanged);
    worktrees.delete(task.id);
  }
}

async function execute(run: Run, broadcast: Broadcast) {
  const update = (patch: Partial<Run> = {}) => {
    Object.assign(run, patch, { updated: Date.now() });
    persist();
    broadcast({ channel: 'workflows', runId: run.id });
  };
  const halted = () => stopped.has(run.id);

  try {
    // 1. Plan
    run.orchestratorSessionId = newSession(run.options.agents.orchestrator, `Workflow: ${run.goal}`, run.cwd, run.trust);
    update();
    const plan = await runTurn(run.orchestratorSessionId, planPrompt(run.goal), broadcast);
    if (halted()) throw new Error('Stopped');
    if (plan.error && !plan.text) throw new Error(plan.error);
    const parsed = extractJson(plan.text) as { summary?: unknown; tasks?: unknown };
    const rawTasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    let tasks: Task[] = rawTasks
      .filter((t): t is { title: string; prompt: string } => typeof t?.title === 'string' && typeof t?.prompt === 'string' && t.title.trim() !== '' && t.prompt.trim() !== '')
      .slice(0, MAX_TASKS)
      .map(toTask);
    if (tasks.length === 0) throw new Error('The orchestrator produced no tasks');
    const summary = typeof parsed.summary === 'string' ? parsed.summary : undefined;

    // Approval gate: nothing edits files until the owner has seen and accepted the plan.
    if (run.options.approval) {
      update({ summary, tasks, status: 'awaiting_approval' });
      const approved = await new Promise<Task[] | null>((resolve) => gates.set(run.id, resolve));
      gates.delete(run.id);
      if (approved === null || halted()) throw new Error('Stopped');
      tasks = approved;
    }
    update({ summary, tasks, status: 'running' });

    // 2. Sub-agents, a few at a time
    const useWorktrees = run.options.worktrees && (await isGitRepo(run.cwd));
    const queue = [...tasks];
    const worker = async () => {
      for (let task = queue.shift(); task && !halted(); task = queue.shift()) {
        task.state = 'running';
        try {
          let workDir = run.cwd;
          if (useWorktrees) {
            const created = await createWorktree(run.cwd, run.id, task.id);
            worktrees.set(task.id, created);
            task.branch = created.branch;
            workDir = created.workDir;
          }
          task.sessionId = newSession(run.options.agents.worker, `Task: ${task.title}`, workDir, run.trust);
          update();
          const out = await runTurn(task.sessionId, task.prompt, broadcast);
          const wt = worktrees.get(task.id);
          if (wt) task.filesChanged = await commitWorktree(wt, `zakos: ${task.title}`);
          task.result = out.text || undefined;
          if (out.error) {
            task.state = 'error';
            task.error = out.error;
          } else task.state = 'done';
        } catch (err) {
          task.state = 'error';
          task.error = err instanceof Error ? err.message : String(err);
        }
        update();
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, worker));
    if (halted()) throw new Error('Stopped');

    // 2b. Bring each worktree's work back into the main tree, one task at a time
    if (useWorktrees) await mergeAll(run, update);

    // 3. Review
    update({ status: 'reviewing' });
    run.reviewerSessionId = newSession(run.options.agents.reviewer, `Review: ${run.goal}`, run.cwd, run.trust);
    update();
    const review = await runTurn(run.reviewerSessionId, reviewPrompt(run), broadcast);
    if (halted()) throw new Error('Stopped');
    // The reviewer may quote the keyword inside a finding, so only the last verdict line counts,
    // and a run with failed tasks can never pass.
    const verdicts = [...review.text.matchAll(/VERDICT:\s*(PASS|NEEDS_WORK)/gi)];
    const last = verdicts.at(-1)?.[1]?.toUpperCase();
    const verdict = last === 'PASS' && !review.error && run.tasks.every((t) => t.state === 'done') ? 'pass' : 'needs_work';
    update({ review: review.text || review.error, verdict });

    // 4. Final report, written by the orchestrator so it keeps the plan in context
    update({ status: 'reporting' });
    const report = await runTurn(run.orchestratorSessionId, reportPrompt(run), broadcast);
    if (halted()) throw new Error('Stopped');
    update({ report: report.text || report.error, status: 'done' });
  } catch (err) {
    const wasStopped = halted();
    for (const t of run.tasks) {
      if (t.state === 'queued' || t.state === 'running') {
        t.state = 'error';
        t.error = wasStopped ? 'Stopped' : 'Run ended before this task finished';
      }
    }
    await abandonWorktrees(run);
    update({ status: wasStopped ? 'stopped' : 'error', error: wasStopped ? undefined : err instanceof Error ? err.message : String(err) });
  } finally {
    stopped.delete(run.id);
  }
}
