import fs from 'node:fs';
import path from 'node:path';
import { scrubSecrets } from '../secrets';
import { vaultService } from '../vault';

/**
 * Auto-capture memory: after an agent run, a short record of it is appended to that day's note in
 * the vault, so what agents did becomes part of the Brain. Off by default, because it writes into
 * the owner's notes. Credentials are scrubbed before anything is written.
 */
export interface BrainSettings {
  autoCapture: boolean;
}

const FILE = path.resolve(process.cwd(), 'data', 'brain-settings.json');
const FOLDER = '00 Zak OS Captures';

export function getBrainSettings(): BrainSettings {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return { autoCapture: raw.autoCapture === true };
  } catch {
    return { autoCapture: false };
  }
}

export function updateBrainSettings(patch: Partial<BrainSettings>): BrainSettings {
  const next = { ...getBrainSettings(), ...(typeof patch.autoCapture === 'boolean' ? { autoCapture: patch.autoCapture } : {}) };
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2));
  return next;
}

export interface Capture {
  agent: string;
  project: string;
  title: string;
  prompt: string;
  answer: string;
  ts: number;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);
const fence = (s: string) => s.replace(/\r/g, '').trim();

/** Appends one entry to `<vault>/00 Zak OS Captures/<date>.md`, creating the day's note on first use. */
export async function capture(c: Capture): Promise<string> {
  const d = new Date(c.ts);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const rel = `${FOLDER}/${date}`;
  const fullPath = path.join(vaultService.getVaultPath(), `${rel}.md`);

  const entry =
    `\n## ${time} ${c.title.replace(/[\r\n#]+/g, ' ').slice(0, 80)}\n` +
    `**Agent:** ${c.agent} | **Project:** ${c.project}\n\n` +
    `**Asked:** ${scrubSecrets(clip(fence(c.prompt), 600))}\n\n` +
    `**Result:**\n${scrubSecrets(clip(fence(c.answer), 1200))}\n`;

  let body: string;
  try {
    body = fs.existsSync(fullPath) ? (vaultService.getNoteByRelativePath(rel)?.content ?? '') : `# Agent captures ${date}\n`;
  } catch {
    body = `# Agent captures ${date}\n`;
  }
  await vaultService.saveNote(rel, `${body.trimEnd()}\n${entry}`, { title: `Agent captures ${date}`, type: 'capture', category: 'zak-os', tags: ['zak-os', 'capture'] });
  return rel;
}
