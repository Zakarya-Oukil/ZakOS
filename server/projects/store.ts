import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { globalTrust, isTrust, type Trust } from '../agents/settings';

export interface Project {
  id: string;
  name: string;
  path: string;
  color: string;
  source: 'folder' | 'github';
  remoteUrl?: string;
  addedAt: number;
  /** Agent permission level for this project; unset means the global setting applies. */
  trust?: Trust;
}

const FILE = path.resolve(process.cwd(), 'data', 'projects.json');

// Distinct on a dark ground and used one per project so each reads as its own star colour.
export const PALETTE = [
  '#5fe3f0', '#f2b544', '#7fd6a0', '#ff8fa3', '#7aa7ff',
  '#e879c9', '#c4e457', '#ff8a4c', '#2dd4bf', '#60c8ff',
];

function read(): Project[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list: Project[]) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2));
}

export function listProjects(): Project[] {
  return read();
}

export function getProject(id: string): Project | undefined {
  return read().find((p) => p.id === id);
}

export function findByPath(p: string): Project | undefined {
  const norm = path.resolve(p).toLowerCase();
  return read().find((x) => path.resolve(x.path).toLowerCase() === norm);
}

export function addProject(input: { path: string; name?: string; source: Project['source']; remoteUrl?: string }): Project {
  const list = read();
  const used = new Set(list.map((p) => p.color));
  const color = PALETTE.find((c) => !used.has(c)) ?? PALETTE[list.length % PALETTE.length];
  const resolved = path.resolve(input.path);
  const project: Project = {
    id: randomUUID(),
    name: (input.name?.trim() || path.basename(resolved) || resolved).slice(0, 80),
    path: resolved,
    color,
    source: input.source,
    remoteUrl: input.remoteUrl,
    addedAt: Date.now(),
  };
  write([...list, project]);
  return project;
}

export function updateProject(id: string, patch: { name?: string; color?: string; trust?: Trust | null }): Project | undefined {
  const list = read();
  const i = list.findIndex((p) => p.id === id);
  if (i < 0) return undefined;
  if (patch.name?.trim()) list[i].name = patch.name.trim().slice(0, 80);
  if (patch.color && /^#[0-9a-f]{6}$/i.test(patch.color)) list[i].color = patch.color;
  if (patch.trust === null) delete list[i].trust;
  else if (isTrust(patch.trust)) list[i].trust = patch.trust;
  write(list);
  return list[i];
}

/** Removes the project from the list only. Files on disk are never touched. */
export function removeProject(id: string): boolean {
  const list = read();
  const next = list.filter((p) => p.id !== id);
  if (next.length === list.length) return false;
  write(next);
  return true;
}

/**
 * The trust level for a working directory: the closest registered project that contains it,
 * else the global setting. Worktrees live elsewhere, so workflows pass trust explicitly instead.
 */
export function trustForPath(cwd: string): Trust {
  const target = path.resolve(cwd).toLowerCase();
  const match = read()
    .filter((p) => {
      const root = path.resolve(p.path).toLowerCase();
      return target === root || target.startsWith(root + path.sep);
    })
    .sort((a, b) => b.path.length - a.path.length)[0];
  return match?.trust ?? globalTrust();
}
