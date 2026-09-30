import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { LaunchInput } from './launch';

export interface Template {
  id: string;
  name: string;
  input: LaunchInput;
  created: number;
  lastRunAt?: number;
}

const FILE = path.resolve(process.cwd(), 'data', 'workflow-templates.json');

function read(): Template[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list: Template[]) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
  fs.renameSync(tmp, FILE);
}

export const listTemplates = (): Template[] => read().sort((a, b) => b.created - a.created);
export const getTemplate = (id: string): Template | undefined => read().find((t) => t.id === id);

export function createTemplate(name: string, input: LaunchInput): Template {
  const list = read();
  const template: Template = { id: randomUUID(), name: name.trim().slice(0, 80), input, created: Date.now() };
  write([...list, template]);
  return template;
}

export function updateTemplate(id: string, patch: { name?: string; input?: LaunchInput }): Template | undefined {
  const list = read();
  const t = list.find((x) => x.id === id);
  if (!t) return undefined;
  if (patch.name) t.name = patch.name.trim().slice(0, 80);
  if (patch.input) t.input = patch.input;
  write(list);
  return t;
}

export function markTemplateRun(id: string) {
  const list = read();
  const t = list.find((x) => x.id === id);
  if (!t) return;
  t.lastRunAt = Date.now();
  write(list);
}

export function deleteTemplate(id: string): boolean {
  const list = read();
  const next = list.filter((t) => t.id !== id);
  if (next.length === list.length) return false;
  write(next);
  return true;
}
