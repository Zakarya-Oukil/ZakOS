import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { Express, Request } from 'express';
import { audit } from '../audit';
import { dataDir, fail, handle, kvGet, kvSet, localOnly, osdb, str } from './common';
import { getSecret, unlocked } from './secretStore';
import { cleanDomain, cleanEmail, cleanIp, cleanUrl, cleanUsername, findRunner, RUNNERS, type Edge, type Entity, type InputKind, type RunResult, type Runner } from './cyberlab/runners';

/**
 * CyberLab: investigation cases, tool runs with provenance, and an audit trail.
 * Every run is stored with a SHA-256 of its output, and every run is written to the audit log, so a finding
 * in a report can be traced back to the tool, the target, the time and the exact output it came from.
 */
osdb.exec(`
  CREATE TABLE IF NOT EXISTS cl_cases (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, scope TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open', created INTEGER NOT NULL, updated INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS cl_runs (
    id TEXT PRIMARY KEY, case_id TEXT, tool TEXT NOT NULL, input TEXT NOT NULL, mode TEXT NOT NULL, ts INTEGER NOT NULL,
    ms INTEGER NOT NULL, ok INTEGER NOT NULL, summary TEXT NOT NULL DEFAULT '', output TEXT, sha256 TEXT, error TEXT
  );
  CREATE INDEX IF NOT EXISTS cl_runs_case ON cl_runs(case_id, ts);
  CREATE TABLE IF NOT EXISTS cl_entities (
    id INTEGER PRIMARY KEY AUTOINCREMENT, case_id TEXT NOT NULL, type TEXT NOT NULL, value TEXT NOT NULL,
    confidence TEXT NOT NULL DEFAULT 'medium', note TEXT NOT NULL DEFAULT '', first_run TEXT, first_seen INTEGER NOT NULL,
    UNIQUE(case_id, type, value)
  );
  CREATE TABLE IF NOT EXISTS cl_edges (
    case_id TEXT NOT NULL, a TEXT NOT NULL, b TEXT NOT NULL, rel TEXT NOT NULL, run_id TEXT,
    UNIQUE(case_id, a, b, rel)
  );
`);

const PLUGIN_DIR = path.join(dataDir, 'cyberlab-tools');
const CATALOGUE = path.resolve(process.cwd(), 'server/os/cyberlab/catalogue.json');
const rid = (p: string) => `${p}_${crypto.randomBytes(5).toString('hex')}`;

// ---------------------------------------------------------------------------------------------- plugins

interface Manifest {
  id: string;
  name: string;
  blurb: string;
  mode: 'passive' | 'active';
  input: { kind: InputKind; label: string; placeholder: string };
  command: string;
  args: string[];
  timeoutSec?: number;
  sendsTo?: string;
}

/**
 * Drop-in tools: data/cyberlab-tools/<id>/manifest.json plus whatever script it names. The tool runs as you,
 * with no shell, a timeout, the tool folder as its working directory and a minimal environment, so your
 * API keys and other secrets are never passed to it. There is no operating system sandbox: read a script before you run it.
 */
function loadPlugins(): Array<Manifest & { dir: string }> {
  if (!fs.existsSync(PLUGIN_DIR)) return [];
  const out: Array<Manifest & { dir: string }> = [];
  for (const d of fs.readdirSync(PLUGIN_DIR, { withFileTypes: true })) {
    if (!d.isDirectory() || !/^[a-z0-9-]{1,40}$/.test(d.name)) continue;
    try {
      const m = JSON.parse(fs.readFileSync(path.join(PLUGIN_DIR, d.name, 'manifest.json'), 'utf8')) as Manifest;
      if (m.id !== d.name || !m.name || !m.command || !Array.isArray(m.args) || !m.input?.kind) continue;
      out.push({ ...m, mode: m.mode === 'active' ? 'active' : 'passive', dir: path.join(PLUGIN_DIR, d.name) });
    } catch {
      /* a broken manifest is skipped, not fatal */
    }
  }
  return out;
}

function cleanFor(kind: InputKind, v: string): string {
  switch (kind) {
    case 'domain': return cleanDomain(v);
    case 'ip': return cleanIp(v);
    case 'email': return cleanEmail(v);
    case 'username': return cleanUsername(v);
    case 'url': return cleanUrl(v).href;
    default: return v.trim().slice(0, 500);
  }
}

function runPlugin(m: Manifest & { dir: string }, input: string): Promise<RunResult> {
  const args = m.args.map((a) => a.replace(/\{input\}/g, input));
  const env: Record<string, string> = {};
  for (const k of ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'LANG']) if (process.env[k]) env[k] = process.env[k]!;
  return new Promise((resolve, reject) => {
    execFile(m.command, args, { cwd: m.dir, env, timeout: Math.min(300, m.timeoutSec ?? 60) * 1000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error((String(stderr).trim() || err.message).slice(0, 600)));
      const text = String(stdout).trim();
      try {
        const j = JSON.parse(text) as Partial<RunResult>;
        const entities = Array.isArray(j.entities) ? (j.entities.filter((e) => e && typeof e.type === 'string' && typeof e.value === 'string').slice(0, 500) as Entity[]) : [];
        const edges = Array.isArray(j.edges) ? (j.edges.filter((e) => e && typeof e.a === 'string' && typeof e.b === 'string').slice(0, 1000) as Edge[]) : [];
        resolve({ summary: typeof j.summary === 'string' ? j.summary.slice(0, 300) : `${m.name} finished`, data: j.data ?? j, entities, edges });
      } catch {
        resolve({ summary: `${m.name} finished (plain text output)`, data: { stdout: text.slice(0, 200_000) }, entities: [], edges: [] });
      }
    });
  });
}

// ---------------------------------------------------------------------------------------------- running

type Row = Record<string, string | number | null>;

async function execute(tool: string, input: string, opts: { caseId?: string; file?: Buffer; fileName?: string; confirmActive?: boolean; actor: string }) {
  let runner: Pick<Runner, 'id' | 'name' | 'mode' | 'input' | 'needsKey'> & { go: (key?: string) => Promise<RunResult> };
  if (tool.startsWith('plugin:')) {
    const m = loadPlugins().find((p) => p.id === tool.slice(7));
    if (!m) throw new Error('Unknown tool');
    const clean = cleanFor(m.input.kind, input);
    runner = { id: tool, name: m.name, mode: m.mode, input: m.input, go: () => runPlugin(m, clean) };
    input = clean;
  } else {
    const r = findRunner(tool);
    if (!r) throw new Error('Unknown tool');
    runner = { id: r.id, name: r.name, mode: r.mode, input: r.input, needsKey: r.needsKey, go: (key) => r.run(input, { key, file: opts.file, fileName: opts.fileName }) };
  }
  if (runner.mode === 'active' && !opts.confirmActive) throw new Error('This tool sends requests to the target. Confirm you are allowed to test it, then run it again.');
  let key: string | undefined;
  if (runner.needsKey) {
    if (!unlocked()) throw new Error('Unlock the secrets store first (Settings, Secrets) so the tool can use your API key');
    key = getSecret(runner.needsKey);
    if (!key) throw new Error(`Add your key to the secrets store under the name “${runner.needsKey}”`);
  }
  if (opts.caseId && !osdb.prepare('SELECT 1 FROM cl_cases WHERE id = ?').get(opts.caseId)) throw new Error('That case no longer exists');

  const id = rid('run');
  const label = runner.input.kind === 'file' ? `${opts.fileName ?? 'file'} (${opts.file?.length ?? 0} bytes)` : input.slice(0, 300);
  const started = Date.now();
  let result: RunResult | null = null;
  let error: string | null = null;
  try {
    result = await runner.go(key);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const ms = Date.now() - started;
  const output = result ? JSON.stringify(result) : null;
  const sha = output ? crypto.createHash('sha256').update(output).digest('hex') : null;
  osdb
    .prepare('INSERT INTO cl_runs(id, case_id, tool, input, mode, ts, ms, ok, summary, output, sha256, error) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, opts.caseId ?? null, runner.id, label, runner.mode, started, ms, result ? 1 : 0, result?.summary ?? '', output, sha, error);
  audit('cyberlab.run', opts.actor, `${runner.name} (${runner.mode}) on ${label}${opts.caseId ? ` in case ${opts.caseId}` : ''}: ${error ? `failed, ${error}` : result!.summary}${sha ? ` [sha256 ${sha.slice(0, 16)}]` : ''}`);

  if (result && opts.caseId) {
    const ins = osdb.prepare('INSERT OR IGNORE INTO cl_entities(case_id, type, value, first_run, first_seen) VALUES(?,?,?,?,?)');
    for (const e of result.entities.filter((x) => String(x.value).replace(/\./g, '').trim()).slice(0, 500)) ins.run(opts.caseId, e.type, String(e.value).slice(0, 500), id, started);
    const ie = osdb.prepare('INSERT OR IGNORE INTO cl_edges(case_id, a, b, rel, run_id) VALUES(?,?,?,?,?)');
    for (const e of result.edges.filter((x) => !/:\.?$/.test(x.a) && !/:\.?$/.test(x.b)).slice(0, 1000)) ie.run(opts.caseId, String(e.a).slice(0, 600), String(e.b).slice(0, 600), String(e.rel).slice(0, 80), id);
    osdb.prepare('UPDATE cl_cases SET updated = ? WHERE id = ?').run(Date.now(), opts.caseId);
  }
  if (error) throw new Error(error);
  return { id, ms, sha256: sha, ...result! };
}

// ---------------------------------------------------------------------------------------------- report

function report(caseId: string): string {
  const c = osdb.prepare('SELECT * FROM cl_cases WHERE id = ?').get(caseId) as Row | undefined;
  if (!c) throw new Error('Case not found');
  const runs = osdb.prepare('SELECT id, tool, input, mode, ts, ok, summary, sha256, error FROM cl_runs WHERE case_id = ? ORDER BY ts').all(caseId) as Row[];
  const ents = osdb.prepare('SELECT * FROM cl_entities WHERE case_id = ? ORDER BY type, value').all(caseId) as Row[];
  const edges = osdb.prepare('SELECT * FROM cl_edges WHERE case_id = ?').all(caseId) as Row[];
  const iso = (t: unknown) => new Date(Number(t)).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const L: string[] = [];
  L.push(`# ${c.name}`, '', `Status: ${c.status}  `, `Opened: ${iso(c.created)}  `, `Last updated: ${iso(c.updated)}  `, `Generated: ${iso(Date.now())}`, '');
  L.push('## Scope and authorisation', '', String(c.scope).trim() || '_No scope was written for this case._', '');
  if (String(c.notes).trim()) L.push('## Analyst notes', '', String(c.notes).trim(), '');
  L.push('## Summary', '', `${runs.filter((r) => r.ok).length} tool runs succeeded and ${runs.filter((r) => !r.ok).length} failed. ${ents.length} entities and ${edges.length} relationships were recorded.`, '');
  const byType = new Map<string, Row[]>();
  for (const e of ents) (byType.get(String(e.type)) ?? byType.set(String(e.type), []).get(String(e.type))!).push(e);
  L.push('## Findings by entity type', '');
  for (const [type, list] of byType) {
    L.push(`### ${type} (${list.length})`, '', '| Value | Confidence | Source run | Note |', '| --- | --- | --- | --- |');
    for (const e of list) L.push(`| \`${String(e.value).replace(/\|/g, '\\|')}\` | ${e.confidence} | ${e.first_run ?? ''} | ${String(e.note).replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`);
    L.push('');
  }
  L.push('## Relationships', '', '| From | Relationship | To | Run |', '| --- | --- | --- | --- |');
  for (const e of edges.slice(0, 500)) L.push(`| \`${e.a}\` | ${e.rel} | \`${e.b}\` | ${e.run_id ?? ''} |`);
  L.push('', '## Evidence log', '', 'Every row is one tool run. The SHA-256 is of the stored output so it can be re-checked.', '', '| Time | Run | Tool | Mode | Target | Result | SHA-256 |', '| --- | --- | --- | --- | --- | --- | --- |');
  for (const r of runs) L.push(`| ${iso(r.ts)} | ${r.id} | ${r.tool} | ${r.mode} | \`${String(r.input).replace(/\|/g, '\\|')}\` | ${r.ok ? String(r.summary).replace(/\|/g, '\\|') : `failed: ${String(r.error).replace(/\|/g, '\\|')}`} | ${r.sha256 ? String(r.sha256).slice(0, 16) : ''} |`);
  L.push('', '---', 'Collected with Zak OS CyberLab. Findings come from public sources and read-only lookups unless a run is marked active.');
  return L.join('\n');
}

// ---------------------------------------------------------------------------------------------- study tracker

/** The official exam domains. Progress starts at zero and is only ever what you enter. */
const STUDY_TRACKS = [
  { id: 'ejpt', name: 'eJPT (INE Security)', status: 'earned', domains: [] as Array<{ id: string; name: string; weight?: number }> },
  {
    id: 'btl1',
    name: 'BTL1 (Security Blue Team)',
    status: 'in progress',
    domains: [
      { id: 'phishing', name: 'Phishing Analysis' },
      { id: 'threat-intel', name: 'Threat Intelligence' },
      { id: 'dfir', name: 'Digital Forensics' },
      { id: 'siem', name: 'SIEM' },
      { id: 'ir', name: 'Incident Response' },
    ],
  },
  {
    id: 'secplus',
    name: 'CompTIA Security+ (SY0-701)',
    status: 'in progress',
    domains: [
      { id: 'general', name: 'General Security Concepts', weight: 12 },
      { id: 'threats', name: 'Threats, Vulnerabilities and Mitigations', weight: 22 },
      { id: 'architecture', name: 'Security Architecture', weight: 18 },
      { id: 'operations', name: 'Security Operations', weight: 28 },
      { id: 'program', name: 'Security Program Management and Oversight', weight: 20 },
    ],
  },
];

// ---------------------------------------------------------------------------------------------- routes

export function mountCyberlabRoutes(app: Express) {
  app.use('/api/cyberlab', localOnly);
  const actor = (req: Request) => ((req as Request & { user?: { name?: string } }).user?.name ?? 'owner');

  app.get('/api/cyberlab/tools', handle((_req, res) => {
    const keyed = (name?: string) => (name ? unlocked() && getSecret(name) !== undefined : true);
    res.json({
      success: true,
      vaultUnlocked: unlocked(),
      tools: [
        ...RUNNERS.map((r) => ({ id: r.id, name: r.name, group: r.group, blurb: r.blurb, mode: r.mode, input: r.input, needsKey: r.needsKey, keyReady: keyed(r.needsKey), sendsTo: r.sendsTo, plugin: false })),
        ...loadPlugins().map((p) => ({ id: `plugin:${p.id}`, name: p.name, group: 'Your tools', blurb: p.blurb ?? '', mode: p.mode, input: p.input, keyReady: true, sendsTo: p.sendsTo ?? 'whatever your script contacts', plugin: true })),
      ],
      pluginDir: PLUGIN_DIR,
    });
  }));

  app.get('/api/cyberlab/catalogue', handle((_req, res) => {
    res.type('json').send(fs.readFileSync(CATALOGUE, 'utf8'));
  }));

  app.post('/api/cyberlab/run', handle(async (req, res) => {
    const out = await execute(String(req.body?.tool ?? ''), str(req.body?.input, 600) ?? '', { caseId: str(req.body?.caseId, 40) || undefined, confirmActive: req.body?.confirmActive === true, actor: actor(req) });
    res.json({ success: true, run: out });
  }));

  app.post('/api/cyberlab/run-file', express.raw({ type: '*/*', limit: '25mb' }), handle(async (req, res) => {
    const file = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const name = decodeURIComponent(String(req.headers['x-filename'] ?? 'file')).replace(/[\\/]/g, '_').slice(0, 200);
    const out = await execute('file-forensics', '', { caseId: String(req.headers['x-case'] ?? '') || undefined, file, fileName: name, actor: actor(req) });
    res.json({ success: true, run: out });
  }));

  app.get('/api/cyberlab/cases', handle((_req, res) => {
    const rows = osdb.prepare(`SELECT c.*, (SELECT COUNT(*) FROM cl_runs r WHERE r.case_id = c.id) AS runs, (SELECT COUNT(*) FROM cl_entities e WHERE e.case_id = c.id) AS entities FROM cl_cases c ORDER BY updated DESC`).all();
    res.json({ success: true, cases: rows });
  }));

  app.post('/api/cyberlab/cases', handle((req, res) => {
    const name = str(req.body?.name, 120)?.trim();
    if (!name) throw new Error('Give the case a name');
    const id = rid('case');
    const now = Date.now();
    osdb.prepare('INSERT INTO cl_cases(id, name, scope, notes, created, updated) VALUES(?,?,?,?,?,?)').run(id, name, str(req.body?.scope, 4000) ?? '', str(req.body?.notes, 20000) ?? '', now, now);
    audit('cyberlab.case', actor(req), `Opened case ${name}`);
    res.json({ success: true, id });
  }));

  app.get('/api/cyberlab/cases/:id', handle((req, res) => {
    const id = String(req.params.id);
    const c = osdb.prepare('SELECT * FROM cl_cases WHERE id = ?').get(id);
    if (!c) return fail(res, 404, 'Case not found');
    res.json({
      success: true,
      case: c,
      runs: osdb.prepare('SELECT id, tool, input, mode, ts, ms, ok, summary, sha256, error FROM cl_runs WHERE case_id = ? ORDER BY ts DESC LIMIT 500').all(id),
      entities: osdb.prepare('SELECT * FROM cl_entities WHERE case_id = ? ORDER BY first_seen').all(id),
      edges: osdb.prepare('SELECT a, b, rel, run_id FROM cl_edges WHERE case_id = ?').all(id),
    });
  }));

  app.patch('/api/cyberlab/cases/:id', handle((req, res) => {
    const id = String(req.params.id);
    const cur = osdb.prepare('SELECT * FROM cl_cases WHERE id = ?').get(id) as Row | undefined;
    if (!cur) return fail(res, 404, 'Case not found');
    const status = ['open', 'closed'].includes(req.body?.status) ? req.body.status : cur.status;
    osdb.prepare('UPDATE cl_cases SET name = ?, scope = ?, notes = ?, status = ?, updated = ? WHERE id = ?').run(str(req.body?.name, 120)?.trim() || cur.name, str(req.body?.scope, 4000) ?? cur.scope, str(req.body?.notes, 20000) ?? cur.notes, status, Date.now(), id);
    res.json({ success: true });
  }));

  app.delete('/api/cyberlab/cases/:id', handle((req, res) => {
    const id = String(req.params.id);
    for (const t of ['cl_edges', 'cl_entities', 'cl_runs']) osdb.prepare(`DELETE FROM ${t} WHERE case_id = ?`).run(id);
    osdb.prepare('DELETE FROM cl_cases WHERE id = ?').run(id);
    audit('cyberlab.case', actor(req), `Deleted case ${id}`);
    res.json({ success: true });
  }));

  app.patch('/api/cyberlab/entities/:id', handle((req, res) => {
    const conf = ['low', 'medium', 'high'].includes(req.body?.confidence) ? req.body.confidence : undefined;
    const cur = osdb.prepare('SELECT * FROM cl_entities WHERE id = ?').get(Number(req.params.id)) as Row | undefined;
    if (!cur) return fail(res, 404, 'Not found');
    osdb.prepare('UPDATE cl_entities SET confidence = ?, note = ? WHERE id = ?').run(conf ?? cur.confidence, str(req.body?.note, 2000) ?? cur.note, Number(req.params.id));
    res.json({ success: true });
  }));

  app.delete('/api/cyberlab/entities/:id', handle((req, res) => {
    const e = osdb.prepare('SELECT * FROM cl_entities WHERE id = ?').get(Number(req.params.id)) as Row | undefined;
    if (e) {
      const k = `${e.type}:${e.value}`;
      osdb.prepare('DELETE FROM cl_edges WHERE case_id = ? AND (a = ? OR b = ?)').run(e.case_id, k, k);
      osdb.prepare('DELETE FROM cl_entities WHERE id = ?').run(e.id);
    }
    res.json({ success: true });
  }));

  app.get('/api/cyberlab/runs/:id', handle((req, res) => {
    const r = osdb.prepare('SELECT * FROM cl_runs WHERE id = ?').get(String(req.params.id)) as Row | undefined;
    if (!r) return fail(res, 404, 'Run not found');
    res.json({ success: true, run: { ...r, output: r.output ? JSON.parse(String(r.output)) : null } });
  }));

  app.get('/api/cyberlab/runs', handle((_req, res) => {
    res.json({ success: true, runs: osdb.prepare('SELECT id, case_id, tool, input, mode, ts, ms, ok, summary, sha256, error FROM cl_runs ORDER BY ts DESC LIMIT 200').all() });
  }));

  app.get('/api/cyberlab/cases/:id/report', handle((req, res) => {
    const md = report(String(req.params.id));
    audit('cyberlab.report', actor(req), `Exported the report for case ${req.params.id}`);
    res.type('text/markdown').send(md);
  }));

  app.get('/api/cyberlab/study', handle((_req, res) => {
    res.json({ success: true, tracks: STUDY_TRACKS, progress: kvGet<Record<string, { percent: number; notes: string }>>('cyberlab.study', {}), exams: kvGet<Record<string, string>>('cyberlab.exams', {}) });
  }));

  app.put('/api/cyberlab/study', handle((req, res) => {
    const prog = req.body?.progress as Record<string, { percent: number; notes: string }> | undefined;
    if (prog && typeof prog === 'object') {
      const clean: Record<string, { percent: number; notes: string }> = {};
      for (const [k, v] of Object.entries(prog).slice(0, 60)) clean[k.slice(0, 60)] = { percent: Math.max(0, Math.min(100, Math.round(Number(v?.percent) || 0))), notes: String(v?.notes ?? '').slice(0, 2000) };
      kvSet('cyberlab.study', clean);
    }
    const ex = req.body?.exams as Record<string, string> | undefined;
    if (ex && typeof ex === 'object') kvSet('cyberlab.exams', Object.fromEntries(Object.entries(ex).slice(0, 10).map(([k, v]) => [k.slice(0, 20), String(v).slice(0, 10)])));
    res.json({ success: true });
  }));

}
