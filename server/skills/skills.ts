import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as projects from '../projects/store';

/**
 * Claude Code skills on disk: `<root>/<name>/SKILL.md`. The roots are the owner's user folder and
 * each registered project's `.claude/skills`. A skill folder that is a symlink belongs to whoever
 * it points at, so it is listed but never written to.
 */
export const NAME = /^[a-z0-9][a-z0-9-]{0,62}$/;
const MAX_SKILL = 200_000;

export interface Scope {
  id: string;
  label: string;
  root: string;
}

export function scopes(): Scope[] {
  const out: Scope[] = [{ id: 'user', label: 'Personal', root: path.join(os.homedir(), '.claude', 'skills') }];
  for (const p of projects.listProjects()) out.push({ id: p.id, label: p.name, root: path.join(p.path, '.claude', 'skills') });
  return out;
}

export const scopeOf = (id: string): Scope | undefined => scopes().find((s) => s.id === id);

const FILE = 'SKILL.md';
const OFF = 'SKILL.md.disabled';

/** Reads `key: value` pairs from a leading `---` block, including quoted and folded (`>`) values. */
export function frontmatter(text: string): Record<string, string> {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return {};
  const out: Record<string, string> = {};
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(lines[i]);
    if (!kv) continue;
    let value = kv[2].trim();
    if (value === '>' || value === '|' || value === '>-' || value === '|-') {
      const parts: string[] = [];
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) parts.push(lines[++i].trim());
      value = parts.join(' ');
    } else if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[kv[1]] = value;
  }
  return out;
}

export interface SkillInfo {
  scope: string;
  scopeLabel: string;
  name: string;
  title: string;
  description: string;
  enabled: boolean;
  /** A symlinked folder: shown, but read-only. */
  linked: boolean;
  size: number;
  updated: number;
}

function fileOf(dir: string): { file: string; enabled: boolean } | undefined {
  if (fs.existsSync(path.join(dir, FILE))) return { file: path.join(dir, FILE), enabled: true };
  if (fs.existsSync(path.join(dir, OFF))) return { file: path.join(dir, OFF), enabled: false };
  return undefined;
}

export function listSkills(): SkillInfo[] {
  const all: SkillInfo[] = [];
  for (const scope of scopes()) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(scope.root, { withFileTypes: true });
    } catch {
      continue; // no skills folder for this scope yet
    }
    for (const e of entries) {
      if (!NAME.test(e.name)) continue;
      const dir = path.join(scope.root, e.name);
      const found = fileOf(dir);
      if (!found) continue; // a folder without SKILL.md is not a skill (for example a group of them)
      try {
        const st = fs.statSync(found.file);
        const fm = frontmatter(fs.readFileSync(found.file, 'utf8').slice(0, 8000));
        all.push({
          scope: scope.id,
          scopeLabel: scope.label,
          name: e.name,
          title: fm.name || e.name,
          description: fm.description ?? '',
          enabled: found.enabled,
          linked: fs.lstatSync(dir).isSymbolicLink(),
          size: st.size,
          updated: st.mtimeMs,
        });
      } catch {
        /* unreadable skill: leave it out rather than fail the list */
      }
    }
  }
  return all.sort((a, b) => a.scopeLabel.localeCompare(b.scopeLabel) || a.name.localeCompare(b.name));
}

function locate(scopeId: string, name: string): { dir: string; scope: Scope } {
  const scope = scopeOf(scopeId);
  if (!scope) throw new Error('Unknown scope');
  if (!NAME.test(name)) throw new Error('Invalid skill name');
  return { dir: path.join(scope.root, name), scope };
}

const isLinked = (dir: string) => {
  try {
    return fs.lstatSync(dir).isSymbolicLink();
  } catch {
    return false;
  }
};

export function readSkill(scopeId: string, name: string) {
  const { dir } = locate(scopeId, name);
  const found = fileOf(dir);
  if (!found) throw new Error('Skill not found');
  const files: Array<{ path: string; size: number }> = [];
  const walk = (d: string, rel: string, depth: number) => {
    if (files.length >= 100 || depth > 3) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(path.join(d, e.name), r, depth + 1);
      else files.push({ path: r, size: fs.statSync(path.join(d, e.name)).size });
    }
  };
  try {
    walk(dir, '', 0);
  } catch {
    /* list what could be read */
  }
  return { content: fs.readFileSync(found.file, 'utf8'), enabled: found.enabled, linked: isLinked(dir), files };
}

function checkContent(content: string) {
  if (content.length > MAX_SKILL) throw new Error('A skill file can be at most 200 KB');
  const fm = frontmatter(content);
  if (!fm.description) throw new Error('SKILL.md needs a block at the top with a description, so Claude knows when to use it');
}

export function writeSkill(scopeId: string, name: string, content: string) {
  const { dir } = locate(scopeId, name);
  if (isLinked(dir)) throw new Error('This skill is a link to another folder. Edit it where it lives.');
  const found = fileOf(dir);
  if (!found) throw new Error('Skill not found');
  checkContent(content);
  fs.writeFileSync(found.file, content, 'utf8');
}

export function createSkill(scopeId: string, name: string, description: string, body: string) {
  const { dir } = locate(scopeId, name);
  if (fs.existsSync(dir)) throw new Error(`A skill named ${name} already exists here`);
  const desc = description.replace(/\r?\n/g, ' ').trim();
  if (!desc) throw new Error('Describe when this skill should be used');
  const content = `---\nname: ${name}\ndescription: ${JSON.stringify(desc)}\n---\n\n${body.trim() || `# ${name}\n\nWrite the steps Claude should follow here.`}\n`;
  checkContent(content);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, FILE), content, 'utf8');
}

/** Turning a skill off renames its file so Claude no longer sees it; turning it on restores the name. */
export function setEnabled(scopeId: string, name: string, enabled: boolean) {
  const { dir } = locate(scopeId, name);
  if (isLinked(dir)) throw new Error('This skill is a link to another folder. Change it where it lives.');
  const found = fileOf(dir);
  if (!found) throw new Error('Skill not found');
  if (found.enabled === enabled) return;
  fs.renameSync(found.file, path.join(dir, enabled ? FILE : OFF));
}

export function deleteSkill(scopeId: string, name: string) {
  const { dir } = locate(scopeId, name);
  if (isLinked(dir)) throw new Error('This skill is a link to another folder. It was not deleted.');
  if (!fileOf(dir)) throw new Error('Skill not found');
  fs.rmSync(dir, { recursive: true, force: true });
}
