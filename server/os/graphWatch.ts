import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { audit } from '../audit';
import { listProjects } from '../projects/store';
import { kvGet, kvSet, run } from './common';
import { metaOf } from './projectMeta';

/**
 * Keeps project graphs fresh: for projects with auto-update on, a new commit rebuilds the graph. The rebuild is
 * graphify's own code-only pass (no model calls, no cost). Each build leaves its snapshot in the graph history.
 */
function head(cwd: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('git', ['rev-parse', 'HEAD'], { cwd, windowsHide: true, timeout: 5000 }, (err, out) => resolve(err ? null : out.trim() || null));
  });
}

let busy = false;

async function tick() {
  if (busy) return;
  busy = true;
  try {
    for (const p of listProjects()) {
      if (!metaOf(p.id).autoGraph || !fs.existsSync(p.path)) continue;
      const h = await head(p.path);
      if (!h) continue;
      const key = `graphwatch.${p.id}`;
      const seen = kvGet<string | null>(key, null);
      if (seen === null) {
        kvSet(key, h); // the first look is a baseline
        continue;
      }
      if (seen === h) continue;
      kvSet(key, h);
      const out = await run('python', ['-m', 'graphify', 'update', '.'], { cwd: p.path, timeout: 300_000 });
      audit('graph-auto', 'scheduler', out.ok ? `Rebuilt the graph after commit ${h.slice(0, 7)}` : `Graph rebuild failed: ${out.stderr.trim().split('\n')[0]?.slice(0, 160)}`, { project: p.name });
    }
  } finally {
    busy = false;
  }
}

export function startGraphWatch() {
  const t = setInterval(() => void tick(), 90_000);
  t.unref();
}
