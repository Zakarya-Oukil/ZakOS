import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Denial } from './adapters/types';

/**
 * The approval inbox. Agent sessions run headless, so an action that needs permission is refused
 * rather than paused. Each refusal lands here; approving one resumes the session with only that
 * action allowed, for that one turn.
 */
export interface Approval {
  id: string;
  sessionId: string;
  project: string;
  tool: string;
  input: Record<string, unknown>;
  /** One line describing the action, for the list. */
  summary: string;
  /** The Claude permission rule approving this grants, shown to the owner before they approve. */
  rule: string;
  state: 'pending' | 'approved' | 'dismissed';
  created: number;
  resolved?: number;
}

const FILE = path.resolve(process.cwd(), 'data', 'approvals.json');
const KEEP = 200;

function read(): Approval[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list: Approval[]) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(list.slice(0, KEEP), null, 2));
  fs.renameSync(tmp, FILE);
}

const text = (v: unknown) => (typeof v === 'string' ? v : '');

/** The narrowest rule that allows exactly this action: the exact command, or the exact file. */
export function ruleFor(d: Denial): string {
  const command = text(d.input.command);
  const file = text(d.input.file_path) || text(d.input.path);
  if (d.tool === 'Bash' && command) return `Bash(${command})`;
  if (file) return `${d.tool}(${file})`;
  return d.tool;
}

function summarize(d: Denial): string {
  const detail = text(d.input.command) || text(d.input.file_path) || text(d.input.path) || text(d.input.url) || text(d.input.pattern);
  return `${d.tool}${detail ? `: ${detail}` : ''}`.slice(0, 300);
}

export const listApprovals = (): Approval[] => read();
export const getApproval = (id: string): Approval | undefined => read().find((a) => a.id === id);

/** Adds refusals from one turn, skipping any identical action already waiting in the same session. */
export function addApprovals(sessionId: string, cwd: string, denials: Denial[]): Approval[] {
  const list = read();
  const added: Approval[] = [];
  for (const d of denials) {
    const rule = ruleFor(d);
    if (list.some((a) => a.state === 'pending' && a.sessionId === sessionId && a.rule === rule)) continue;
    const a: Approval = {
      id: randomUUID(),
      sessionId,
      project: path.basename(cwd),
      tool: d.tool,
      input: d.input,
      summary: summarize(d),
      rule,
      state: 'pending',
      created: Date.now(),
    };
    list.unshift(a);
    added.push(a);
  }
  if (added.length) write(list);
  return added;
}

export function resolveApproval(id: string, state: 'approved' | 'dismissed'): Approval | undefined {
  const list = read();
  const a = list.find((x) => x.id === id);
  if (!a) return undefined;
  a.state = state;
  a.resolved = Date.now();
  write(list);
  return a;
}

export function clearResolved() {
  write(read().filter((a) => a.state === 'pending'));
}

/** A session that no longer exists cannot be resumed, so its items are dropped. */
export function dropForSession(sessionId: string) {
  const list = read();
  const next = list.filter((a) => a.sessionId !== sessionId);
  if (next.length !== list.length) write(next);
}
