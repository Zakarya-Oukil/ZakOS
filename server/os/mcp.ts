import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Express, Request, Response } from 'express';
import { audit } from '../audit';
import { getProject, listProjects } from '../projects/store';
import { fail, handle, localOnly, run, str } from './common';

/**
 * Manages Claude Code's own MCP configuration. Reading goes straight to the config files; changes go through
 * the `claude mcp` command so Claude Code stays the only writer of its settings.
 */
export interface McpServer {
  name: string;
  scope: 'user' | 'project';
  project?: string;
  type: string;
  command?: string;
  url?: string;
  args: string[];
}

export interface CatalogueEntry {
  id: string;
  label: string;
  blurb: string;
  command: string;
  args: string[];
  needs?: string;
}

/** A short list of well-known, official or widely used servers. The exact command is shown before install. */
export const CATALOGUE: CatalogueEntry[] = [
  { id: 'filesystem', label: 'Filesystem', blurb: 'Read and write files inside a folder you choose.', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '<folder>'], needs: 'A folder path' },
  { id: 'memory', label: 'Memory', blurb: 'A small knowledge graph the agent can remember things in.', command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'] },
  { id: 'fetch', label: 'Fetch', blurb: 'Fetch a web page and hand it to the agent as text.', command: 'uvx', args: ['mcp-server-fetch'], needs: 'uv installed' },
  { id: 'context7', label: 'Context7', blurb: 'Up-to-date library documentation for the agent.', command: 'npx', args: ['-y', '@upstash/context7-mcp'] },
  { id: 'playwright', label: 'Playwright', blurb: 'Drive a real browser to test pages.', command: 'npx', args: ['-y', '@playwright/mcp@latest'] },
  { id: 'sequential-thinking', label: 'Sequential thinking', blurb: 'Helps the agent break a hard problem into steps.', command: 'npx', args: ['-y', '@modelcontextprotocol/server-sequential-thinking'] },
];

const NAME = /^[a-zA-Z0-9_-]{1,40}$/;

function readJson(file: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function fromMap(map: unknown, scope: McpServer['scope'], project?: string): McpServer[] {
  if (!map || typeof map !== 'object') return [];
  return Object.entries(map as Record<string, Record<string, unknown>>).map(([name, c]) => ({
    name,
    scope,
    project,
    type: typeof c.type === 'string' ? c.type : c.url ? 'http' : 'stdio',
    command: typeof c.command === 'string' ? c.command : undefined,
    url: typeof c.url === 'string' ? c.url : undefined,
    args: Array.isArray(c.args) ? c.args.map(String) : [],
  }));
}

export function listServers(): McpServer[] {
  const out: McpServer[] = [];
  const user = readJson(path.join(os.homedir(), '.claude.json'));
  out.push(...fromMap(user?.mcpServers, 'user'));
  for (const p of listProjects()) {
    const mcp = readJson(path.join(p.path, '.mcp.json'));
    out.push(...fromMap(mcp?.mcpServers, 'project', p.id));
  }
  return out;
}

export function mountMcpRoutes(app: Express) {
  app.use('/api/mcp', localOnly);

  app.get('/api/mcp', handle((_req: Request, res: Response) => {
    res.json({ success: true, servers: listServers(), catalogue: CATALOGUE, projects: listProjects().map((p) => ({ id: p.id, name: p.name })) });
  }));

  app.post('/api/mcp', handle(async (req, res) => {
    const name = str(req.body?.name, 40) ?? '';
    const command = str(req.body?.command, 200) ?? '';
    const args = Array.isArray(req.body?.args) ? req.body.args.map((a: unknown) => String(a).slice(0, 300)).slice(0, 12) : [];
    if (!NAME.test(name)) throw new Error('Use letters, numbers, dash or underscore for the name');
    if (!command || /[\r\n]/.test(command)) throw new Error('A command is required');
    if (args.some((a: string) => a.includes('<') && a.includes('>'))) throw new Error('Replace the placeholder in the arguments first');
    const scope = req.body?.scope === 'project' ? 'project' : 'user';
    let cwd: string | undefined;
    if (scope === 'project') {
      const p = getProject(str(req.body?.project, 80) ?? '');
      if (!p) throw new Error('Pick a project for a project-level server');
      cwd = p.path;
    }
    const out = await run('claude', ['mcp', 'add', '--scope', scope, name, '--', command, ...args], { cwd, timeout: 30_000 });
    if (!out.ok) return fail(res, 400, (out.stderr || out.stdout).trim().slice(0, 400) || 'claude mcp add failed');
    audit('mcp-add', 'owner', `Added MCP server ${name} (${scope}): ${command} ${args.join(' ')}`);
    res.status(201).json({ success: true });
  }));

  app.delete('/api/mcp/:name', handle(async (req, res) => {
    const name = String(req.params.name);
    if (!NAME.test(name)) throw new Error('Invalid name');
    const scope = req.query.scope === 'project' ? 'project' : 'user';
    let cwd: string | undefined;
    if (scope === 'project') {
      const p = getProject(str(req.query.project, 80) ?? '');
      if (!p) throw new Error('Project not found');
      cwd = p.path;
    }
    const out = await run('claude', ['mcp', 'remove', '--scope', scope, name], { cwd, timeout: 20_000 });
    if (!out.ok) return fail(res, 400, (out.stderr || out.stdout).trim().slice(0, 400) || 'claude mcp remove failed');
    audit('mcp-remove', 'owner', `Removed MCP server ${name} (${scope})`);
    res.json({ success: true });
  }));

  /** Asks Claude Code to connect to the server and report whether it came up. */
  app.post('/api/mcp/:name/test', handle(async (req, res) => {
    const name = String(req.params.name);
    if (!NAME.test(name)) throw new Error('Invalid name');
    const p = req.body?.project ? getProject(str(req.body.project, 80) ?? '') : undefined;
    const out = await run('claude', ['mcp', 'get', name], { cwd: p?.path, timeout: 40_000 });
    const text = `${out.stdout}\n${out.stderr}`.trim();
    const connected = /✓\s*Connected|Status:\s*.*Connected/i.test(text);
    res.json({ success: out.ok, connected, output: text.slice(0, 1200) });
  }));
}
