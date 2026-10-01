import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { killTree } from '../agents/adapters/proc';
import * as projects from '../projects/store';

/**
 * Runs a project's own dev server so it can be previewed inside Zak OS. One app per project, output
 * kept in a bounded log, and the local address is picked out of that output. Everything is stopped
 * when the server exits.
 */
const MAX_LOG = 200_000;
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
const URL_IN_LOG = /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0):(\d{2,5})(?:\/[^\s"')\]]*)?/i;

export interface AppState {
  projectId: string;
  state: 'running' | 'stopped' | 'exited';
  command: string;
  startedAt: number;
  exitCode: number | null;
  /** The local address the app printed, normalised to localhost. Only ever a localhost address. */
  url: string | null;
}

interface Proc {
  child: ChildProcess;
  state: AppState;
  log: string;
  /** Total characters ever written, so a reader can ask for "everything after this point". */
  written: number;
}

const apps = new Map<string, Proc>();

export function scriptsOf(projectPath: string): Array<{ name: string; command: string }> {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf8'));
    const all: Record<string, string> = pkg.scripts ?? {};
    const preferred = ['dev', 'start', 'serve', 'preview', 'develop'];
    const names = Object.keys(all).sort((a, b) => (preferred.indexOf(a) + 1 || 99) - (preferred.indexOf(b) + 1 || 99));
    return names.map((name) => ({ name, command: all[name] }));
  } catch {
    return [];
  }
}

export const stateOf = (projectId: string): AppState | null => apps.get(projectId)?.state ?? null;
export const allStates = (): AppState[] => [...apps.values()].map((p) => p.state);

export function readLog(projectId: string, since: number): { text: string; next: number; reset: boolean } {
  const p = apps.get(projectId);
  if (!p) return { text: '', next: 0, reset: false };
  const start = p.written - p.log.length; // offset of the first character still held
  if (since < start) return { text: p.log, next: p.written, reset: true }; // the reader fell behind the ring
  return { text: p.log.slice(since - start), next: p.written, reset: false };
}

function append(p: Proc, chunk: string) {
  const clean = chunk.replace(ANSI, '').replace(/\r(?!\n)/g, '\n');
  p.log += clean;
  p.written += clean.length;
  if (p.log.length > MAX_LOG) p.log = p.log.slice(-MAX_LOG);
  if (!p.state.url) {
    const m = URL_IN_LOG.exec(clean);
    if (m) p.state.url = `http://localhost:${m[1]}`;
  }
}

export function startApp(projectId: string, opts: { script?: string; command?: string; env?: Record<string, string> }): AppState {
  const project = projects.getProject(projectId);
  if (!project) throw new Error('Project not found');
  if (!fs.existsSync(project.path)) throw new Error('The project folder no longer exists');
  if (path.resolve(project.path).toLowerCase() === process.cwd().toLowerCase()) {
    throw new Error('This is Zak OS itself. Starting it again would clash with the copy that is already running.');
  }
  if (apps.get(projectId)?.state.state === 'running') throw new Error('This project is already running. Stop it first.');

  let command: string;
  if (opts.script) {
    if (!scriptsOf(project.path).some((s) => s.name === opts.script)) throw new Error(`There is no "${opts.script}" script in package.json`);
    command = `npm run ${opts.script}`;
  } else if (opts.command?.trim()) {
    command = opts.command.trim().slice(0, 500);
  } else {
    throw new Error('Choose a script or type a command to run');
  }

  // The app picks its own port: inheriting ours would make it collide with this server.
  const env: NodeJS.ProcessEnv = { ...process.env, ...(opts.env ?? {}), FORCE_COLOR: '0', BROWSER: 'none' };
  if (!opts.env?.PORT) delete env.PORT;
  const child = spawn(command, { cwd: project.path, shell: true, windowsHide: true, env });
  const proc: Proc = { child, log: '', written: 0, state: { projectId, state: 'running', command, startedAt: Date.now(), exitCode: null, url: null } };
  apps.set(projectId, proc);
  append(proc, `> ${command}\n`);
  child.stdout?.on('data', (d: Buffer) => append(proc, d.toString('utf8')));
  child.stderr?.on('data', (d: Buffer) => append(proc, d.toString('utf8')));
  child.on('error', (err) => {
    append(proc, `Could not start: ${err.message}\n`);
    proc.state.state = 'exited';
    proc.state.exitCode = -1;
  });
  child.on('exit', (code) => {
    if (proc.state.state === 'running') proc.state.state = 'exited';
    proc.state.exitCode = code;
    append(proc, `\n[process ended with code ${code}]\n`);
  });
  return proc.state;
}

export function stopApp(projectId: string): boolean {
  const p = apps.get(projectId);
  if (!p || p.state.state !== 'running') return false;
  p.state.state = 'stopped';
  killTree(p.child);
  return true;
}

process.on('exit', () => {
  for (const p of apps.values()) if (p.state.state === 'running') killTree(p.child);
});
