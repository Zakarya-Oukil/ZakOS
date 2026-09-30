import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import * as g from '../git/git';

/**
 * Project health. Quick checks read the folder and git and finish at once. Heavy checks (type check,
 * tests, dependency audit) only run when asked, since they can take minutes or need the network.
 */
export type Level = 'pass' | 'warn' | 'fail' | 'info';

export interface Check {
  id: string;
  label: string;
  level: Level;
  detail: string;
}

const exists = (p: string) => fs.existsSync(p);

export async function quickChecks(root: string): Promise<Check[]> {
  const out: Check[] = [];
  const add = (id: string, label: string, level: Level, detail: string) => out.push({ id, label, level, detail });
  const has = (name: string) => exists(path.join(root, name));

  if (!exists(root)) return [{ id: 'folder', label: 'Folder', level: 'fail', detail: 'The project folder no longer exists.' }];

  // ---- git ----
  const repo = await g.isRepo(root);
  if (repo) {
    try {
      const st = await g.status(root);
      const changed = st.files.length;
      add('git-clean', 'Uncommitted work', changed === 0 ? 'pass' : 'warn', changed === 0 ? 'The working tree is clean.' : `${changed} file${changed > 1 ? 's have' : ' has'} uncommitted changes.`);
      if (st.detached) add('git-branch', 'Branch', 'warn', 'Not on a branch (detached HEAD), so new commits could get lost.');
      else if (!st.upstream) add('git-upstream', 'Remote', 'info', `Branch ${st.branch} has no upstream yet, so it has not been pushed.`);
      else add('git-sync', 'In sync with remote', st.ahead || st.behind ? 'warn' : 'pass', st.ahead || st.behind ? `${st.ahead} commit${st.ahead === 1 ? '' : 's'} to push, ${st.behind} to pull.` : `Up to date with ${st.upstream}.`);
    } catch (e) {
      add('git', 'Git', 'warn', (e as Error).message);
    }
    try {
      const tracked = (await g.run(root, ['ls-files', '-z'])).split('\0');
      const secrets = tracked.filter((f) => /(^|\/)(\.env(\.[\w-]+)?|.*\.pem|id_rsa[\w.]*|.*\.pfx)$/i.test(f) && !/\.(example|sample|template)$/i.test(f));
      add('secrets-tracked', 'Secret files in git', secrets.length ? 'fail' : 'pass', secrets.length ? `Tracked by git: ${secrets.slice(0, 4).join(', ')}. Remove them from git and rotate anything they hold.` : 'No .env, key or certificate files are tracked.');
    } catch {
      /* no commits yet */
    }
  } else {
    add('git', 'Git', 'warn', 'This folder is not a git repository, so changes cannot be checkpointed or undone.');
  }

  // ---- ignore rules ----
  if (repo && has('.env')) {
    let ignored = false;
    try {
      await g.run(root, ['check-ignore', '-q', '.env']);
      ignored = true;
    } catch {
      /* not ignored, or not a repo */
    }
    add('env-ignored', '.env is ignored', ignored ? 'pass' : 'warn', ignored ? 'A .env file exists and git ignores it.' : 'A .env file exists but git would commit it. Add it to .gitignore.');
  }

  // ---- dependencies ----
  if (has('package.json')) {
    add('node-modules', 'Dependencies installed', has('node_modules') ? 'pass' : 'fail', has('node_modules') ? 'node_modules is present.' : 'node_modules is missing. Run npm install.');
    const lock = has('package-lock.json') || has('yarn.lock') || has('pnpm-lock.yaml') || has('bun.lockb');
    add('lockfile', 'Lockfile', lock ? 'pass' : 'warn', lock ? 'A lockfile pins exact versions.' : 'No lockfile, so installs can differ between machines.');
  } else if (has('requirements.txt') || has('pyproject.toml')) {
    add('python-deps', 'Python dependencies', 'info', has('requirements.txt') ? 'requirements.txt found.' : 'pyproject.toml found.');
  }

  // ---- project hygiene ----
  add('readme', 'README', has('README.md') || has('readme.md') ? 'pass' : 'warn', has('README.md') || has('readme.md') ? 'A README explains the project.' : 'No README. Anyone opening this folder has nothing to start from.');
  add('agent-notes', 'Agent instructions', has('CLAUDE.md') ? 'pass' : 'info', has('CLAUDE.md') ? 'CLAUDE.md tells agents how this project works.' : 'No CLAUDE.md. Agents start without project-specific guidance.');

  // ---- graph ----
  const graphFile = path.join(root, 'graphify-out', 'graph.json');
  if (exists(graphFile)) {
    try {
      const built = JSON.parse(fs.readFileSync(graphFile, 'utf8')).built_at_commit as string | undefined;
      const head = (await g.run(root, ['rev-parse', 'HEAD'])).trim();
      const stale = Boolean(built && built !== head);
      add('graph', 'Code graph', stale ? 'warn' : 'pass', stale ? 'The graph is older than the latest commit. Rebuild it on the Projects page.' : 'The graph matches the latest commit.');
    } catch {
      add('graph', 'Code graph', 'info', 'A graph exists.');
    }
  } else {
    add('graph', 'Code graph', 'info', 'No graph yet. Build one on the Projects page so agents and the Brain can use it.');
  }

  return out;
}

export type HeavyCheck = 'typecheck' | 'tests' | 'audit';

export interface HeavyResult {
  check: HeavyCheck;
  level: Level;
  summary: string;
  output: string;
  ms: number;
}

const tail = (s: string, n = 6000) => (s.length > n ? `…${s.slice(-n)}` : s);

/** Runs one heavy check and reports a summary plus the end of its output. */
export function runHeavy(root: string, check: HeavyCheck): Promise<HeavyResult> {
  const started = Date.now();
  let cmd: string;
  let args: string[];
  if (check === 'typecheck') {
    if (!has(root, 'tsconfig.json')) return Promise.resolve({ check, level: 'info', summary: 'No tsconfig.json, so there is nothing to type check.', output: '', ms: 0 });
    [cmd, args] = ['npx', ['--no-install', 'tsc', '--noEmit']];
  } else if (check === 'tests') {
    if (!hasScript(root, 'test')) return Promise.resolve({ check, level: 'info', summary: 'No "test" script in package.json.', output: '', ms: 0 });
    [cmd, args] = ['npm', ['test', '--silent']];
  } else {
    if (!has(root, 'package.json')) return Promise.resolve({ check, level: 'info', summary: 'No package.json to audit.', output: '', ms: 0 });
    [cmd, args] = ['npm', ['audit', '--omit=dev']];
  }
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd: root, shell: true, windowsHide: true, timeout: 5 * 60_000, maxBuffer: 10 * 1024 * 1024, env: { ...process.env, CI: '1', FORCE_COLOR: '0' } }, (err, stdout, stderr) => {
      const output = tail(`${stdout}${stderr}`.replace(/\u001b\[[0-9;]*m/g, '').trim());
      const ms = Date.now() - started;
      if (!err) return resolve({ check, level: 'pass', summary: { typecheck: 'Type check passed.', tests: 'Tests passed.', audit: 'No known vulnerabilities in production dependencies.' }[check], output, ms });
      if ((err as { killed?: boolean }).killed) return resolve({ check, level: 'fail', summary: 'Stopped after 5 minutes.', output, ms });
      const errors = check === 'typecheck' ? (output.match(/error TS\d+/g) ?? []).length : 0;
      resolve({ check, level: 'fail', summary: { typecheck: `Type check found ${errors || 'some'} error${errors === 1 ? '' : 's'}.`, tests: 'Tests failed.', audit: 'The audit found vulnerabilities, or could not run (it needs the network).' }[check], output, ms });
    });
  });
}

function has(root: string, name: string) {
  return exists(path.join(root, name));
}

function hasScript(root: string, name: string) {
  try {
    return Boolean(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts?.[name]);
  } catch {
    return false;
  }
}
