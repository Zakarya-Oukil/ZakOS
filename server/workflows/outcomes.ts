import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { notify } from '../notifications';
import { scrubSecrets } from '../secrets';
import { vaultService } from '../vault';
import type { Broadcast } from '../agents/runner';
import type { Run } from './engine';
import { SERVICES, sendMessage } from '../os/integrations';
import { kvGet } from '../os/common';
import { unlocked } from '../os/secretStore';

const exec = promisify(execFile);

export type OutcomeKey = 'obsidian' | 'pr' | 'notify' | 'graphify' | 'channel';
export interface OutcomeResult {
  state: 'done' | 'error' | 'skipped';
  detail: string;
}

const two = (n: number) => String(n).padStart(2, '0');
const stamp = (d: Date) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}-${two(d.getMinutes())}`;
const slug = (s: string) => s.replace(/[\\/:*?"<>|#^[\]\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Workflow';
const run = (cmd: string, args: string[], cwd: string, timeout = 120_000) =>
  exec(cmd, args, { cwd, windowsHide: true, timeout, maxBuffer: 10 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
const errText = (e: unknown) => {
  const x = e as { stderr?: string; message?: string };
  return (x.stderr?.trim() || x.message || String(e)).split('\n').slice(0, 3).join(' ').slice(0, 300);
};

// ---- Obsidian ---------------------------------------------------------------------------------

const REPORTS_DIR = '02 Coding Projects/Workflow Reports';

function reportMarkdown(r: Run, projectName: string, created: string): string {
  const tasks = r.tasks
    .map((t) => `- **${t.title}**: ${t.state}${t.merge ? `, ${t.merge}` : ''}${t.branch && t.merge !== 'merged' && t.merge !== 'nochanges' ? ` (branch \`${t.branch}\`)` : ''}`)
    .join('\n');
  return `---
title: "Workflow report - ${slug(r.goal)}"
type: report
category: coding
tier: 3
status: ${r.verdict === 'pass' ? 'done' : 'needs-review'}
language: typescript
path: "${r.cwd.replace(/\\/g, '/')}"
tags:
  - workflow
  - report
  - coding
created: ${created.slice(0, 10)}
updated: ${created.slice(0, 10)}
parent: "[[Workflow Reports - Index]]"
---

# Workflow report - ${slug(r.goal)}
**⬆️ Parent:** [[Workflow Reports - Index]]

**Project:** ${projectName}
**Verdict:** ${r.verdict === 'pass' ? 'Passed review' : 'Needs work'}

## Goal
${r.goal}

## Tasks
${tasks}

## Report
${r.report ?? '(no report was written)'}

## Reviewer notes
${r.review ?? '(no review)'}
`;
}

function ensureIndex(vault: string) {
  const dir = path.join(vault, REPORTS_DIR);
  fs.mkdirSync(dir, { recursive: true });
  const index = path.join(dir, 'Workflow Reports - Index.md');
  if (!fs.existsSync(index)) {
    fs.writeFileSync(
      index,
      `---
title: "Workflow Reports - Index"
type: hub
category: coding
tier: 2
status: active
tags:
  - workflow
  - hub
created: ${new Date().toISOString().slice(0, 10)}
updated: ${new Date().toISOString().slice(0, 10)}
parent: "[[💻 Coding Projects — Root]]"
---

# Workflow Reports - Index
**⬆️ Parent:** [[💻 Coding Projects — Root]]

Reports written by Zak OS workflow runs, newest last.

`,
    );
  }
  return index;
}

async function toObsidian(r: Run, projectName: string): Promise<OutcomeResult> {
  const vault = vaultService.getVaultPath();
  if (!fs.existsSync(vault)) return { state: 'error', detail: `Vault not found at ${vault}` };
  const now = new Date();
  const dir = path.join(vault, REPORTS_DIR, slug(projectName));
  fs.mkdirSync(dir, { recursive: true });
  const name = `${stamp(now)} ${slug(r.goal)}`;
  const file = path.join(dir, `${name}.md`);
  // Notes must never hold credentials, and agent output sometimes quotes them.
  fs.writeFileSync(file, scrubSecrets(reportMarkdown(r, projectName, now.toISOString())));
  const index = ensureIndex(vault);
  fs.appendFileSync(index, `- [[${REPORTS_DIR}/${slug(projectName)}/${name}|${name}]] (${r.verdict === 'pass' ? 'passed' : 'needs work'})\n`);
  return { state: 'done', detail: `${REPORTS_DIR}/${slug(projectName)}/${name}.md` };
}

// ---- graphify ---------------------------------------------------------------------------------

async function toGraphify(r: Run): Promise<OutcomeResult> {
  try {
    // AST extraction only: no model calls, no cost.
    await run('python', ['-m', 'graphify', 'update', '.'], r.cwd, 300_000);
    return { state: 'done', detail: 'Project graph updated' };
  } catch (e) {
    return { state: 'error', detail: errText(e) };
  }
}

// ---- pull request -----------------------------------------------------------------------------

async function toPullRequest(r: Run): Promise<OutcomeResult> {
  try {
    await run('gh', ['auth', 'status'], r.cwd, 20_000);
  } catch {
    return { state: 'error', detail: 'GitHub CLI is not logged in. Run "gh auth login" in a terminal, then try again.' };
  }
  try {
    const branch = (await run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], r.cwd)).stdout.trim();
    const base = (await run('gh', ['repo', 'view', '--json', 'defaultBranchRef', '-q', '.defaultBranchRef.name'], r.cwd, 30_000)).stdout.trim();
    if (!base) return { state: 'error', detail: 'Could not find the default branch of the GitHub repository' };
    if (branch === base) return { state: 'error', detail: `You are on ${base}. Switch to a feature branch so the PR has something to compare.` };
    const ahead = Number((await run('git', ['rev-list', '--count', `origin/${base}..HEAD`], r.cwd)).stdout.trim());
    if (!ahead) return { state: 'error', detail: `${branch} has no commits beyond ${base}. Commit the changes first.` };
    await run('git', ['push', '-u', 'origin', branch], r.cwd, 180_000);
    const rows = r.tasks.map((t) => `| ${t.title.replace(/\|/g, '/')} | ${t.state}${t.merge ? `, ${t.merge}` : ''} | ${t.filesChanged ?? 0} |`).join('\n');
    const body = scrubSecrets(
      `## Summary\n${r.report ?? r.goal}\n\n## Tasks\n| Task | Result | Files |\n| --- | --- | --- |\n${rows}\n\n## Review\nVerdict: ${r.verdict === 'pass' ? 'passed' : 'needs work'}\n\n${(r.review ?? '').slice(0, 2500)}\n\n(Opened by a Zak OS workflow run.)`,
    );
    const out = await run('gh', ['pr', 'create', '--base', base, '--head', branch, '--title', `Zak OS: ${slug(r.goal)}`, '--body', body], r.cwd, 60_000);
    return { state: 'done', detail: out.stdout.trim().split('\n').pop() ?? 'Pull request opened' };
  } catch (e) {
    return { state: 'error', detail: errText(e) };
  }
}


// ---- channel (Telegram, Discord, Slack) ---------------------------------------------------------

async function toChannel(r: Run, projectName: string): Promise<OutcomeResult> {
  if (!unlocked()) return { state: 'skipped', detail: 'The secrets store is locked, so nothing was posted. Unlock it in Integrations.' };
  const sent: string[] = [];
  const failed: string[] = [];
  const text = `${r.verdict === 'pass' ? 'Workflow passed' : 'Workflow needs review'}: ${slug(r.goal)}\nProject: ${projectName}\n${r.tasks.filter((t) => t.state === 'done').length} of ${r.tasks.length} tasks done.`;
  for (const svc of SERVICES.filter((x) => x.id !== 'github')) {
    const has = svc.fields.every((f) => (f.secret ? kvGet<boolean>(`integration.${svc.id}.has.${f.key}`, false) : !!kvGet<Record<string, string>>(`integration.${svc.id}`, {})[f.key]));
    if (!has) continue;
    try {
      await sendMessage(svc.id as 'telegram' | 'discord' | 'slack', scrubSecrets(text));
      sent.push(svc.label);
    } catch (e) {
      failed.push(`${svc.label}: ${errText(e)}`);
    }
  }
  if (sent.length === 0 && failed.length === 0) return { state: 'skipped', detail: 'No channel is set up. Add one in Integrations.' };
  return { state: failed.length ? 'error' : 'done', detail: [sent.length ? `Posted to ${sent.join(', ')}` : '', ...failed].filter(Boolean).join('. ') };
}

// ---- entry point ------------------------------------------------------------------------------

export interface OutcomeOptions {
  obsidian: boolean;
  pr: boolean;
  notify: boolean;
  graphify: boolean;
  channel: boolean;
}

/** Runs every outcome the owner switched on. One failing never blocks the others. */
export async function runOutcomes(r: Run, projectName: string, broadcast: Broadcast): Promise<Partial<Record<OutcomeKey, OutcomeResult>>> {
  const o = r.options.outcomes;
  const results: Partial<Record<OutcomeKey, OutcomeResult>> = {};
  const attempt = async (key: OutcomeKey, fn: () => Promise<OutcomeResult>) => {
    if (!o[key]) return;
    try {
      results[key] = await fn();
    } catch (e) {
      results[key] = { state: 'error', detail: errText(e) };
    }
  };
  await attempt('obsidian', () => toObsidian(r, projectName));
  await attempt('graphify', () => toGraphify(r));
  await attempt('pr', () => toPullRequest(r));
  await attempt('channel', () => toChannel(r, projectName));
  await attempt('notify', async () => {
    const failed = Object.values(results).filter((x) => x?.state === 'error').length;
    notify(
      r.verdict === 'pass' ? 'Workflow finished' : 'Workflow finished, needs review',
      `${slug(r.goal)}${failed ? ` (${failed} outcome${failed > 1 ? 's' : ''} failed)` : ''}`,
      broadcast,
      { module: 'workflows', route: [r.id] },
    );
    return { state: 'done', detail: 'Notification sent' };
  });
  return results;
}
