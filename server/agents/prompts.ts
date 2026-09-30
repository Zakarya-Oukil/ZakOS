import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** The prompt library: prompts the owner saved to reuse, inserted with `/` in the prompt box. */
export interface SavedPrompt {
  id: string;
  name: string;
  text: string;
  created: number;
}

const FILE = path.resolve(process.cwd(), 'data', 'prompts.json');
const MAX = 200;

function read(): SavedPrompt[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list: SavedPrompt[]) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
  fs.renameSync(tmp, FILE);
}

export const listPrompts = (): SavedPrompt[] => read().sort((a, b) => a.name.localeCompare(b.name));

export function savePrompt(name: string, text: string): SavedPrompt {
  const list = read();
  if (list.length >= MAX) throw new Error(`The library is full (${MAX} prompts). Delete some first.`);
  const clean = name.trim().slice(0, 60);
  const existing = list.find((p) => p.name.toLowerCase() === clean.toLowerCase());
  if (existing) {
    existing.text = text.slice(0, 20_000); // saving under an existing name updates it
    write(list);
    return existing;
  }
  const prompt: SavedPrompt = { id: randomUUID(), name: clean, text: text.slice(0, 20_000), created: Date.now() };
  write([...list, prompt]);
  return prompt;
}

export function deletePrompt(id: string): boolean {
  const list = read();
  const next = list.filter((p) => p.id !== id);
  if (next.length === list.length) return false;
  write(next);
  return true;
}
