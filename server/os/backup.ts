import fs from 'node:fs';
import path from 'node:path';
import type { Express, Request, Response } from 'express';
import { audit } from '../audit';
import { addProject } from '../projects/store';
import { dataDir, fail, handle, kvSet, localOnly, osdb, str } from './common';

/**
 * Backup and restore of the owner's configuration: templates, prompts, schedules, module switches, tasks and
 * settings. Sessions, the audit log, the secrets store, licence keys and API key hashes are deliberately left out.
 */
const FILES = ['workflow-templates.json', 'prompts.json', 'schedules.json', 'os-modules.json', 'workflow-limits.json', 'agent-settings.json'];
const KV_SKIP = /^(licence\.key|apikey\.|integration\..*\.has\.)/;

interface Bundle {
  app: 'zak-os';
  version: 1;
  exported: number;
  files: Record<string, unknown>;
  kv: Record<string, string>;
  tasks: unknown[];
}

export function mountBackupRoutes(app: Express) {
  app.use('/api/backup', localOnly);

  app.get('/api/backup/export', handle((_req: Request, res: Response) => {
    const files: Record<string, unknown> = {};
    for (const f of FILES) {
      try {
        files[f] = JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));
      } catch {
        /* the file does not exist yet */
      }
    }
    const kv: Record<string, string> = {};
    for (const r of osdb.prepare('SELECT key, value FROM kv').all() as Array<{ key: string; value: string }>) if (!KV_SKIP.test(r.key)) kv[r.key] = r.value;
    const bundle: Bundle = { app: 'zak-os', version: 1, exported: Date.now(), files, kv, tasks: osdb.prepare('SELECT * FROM tasks').all() };
    audit('backup-export', 'owner', 'Exported a configuration backup');
    res.setHeader('Content-Disposition', `attachment; filename="zak-os-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(bundle);
  }));

  app.post('/api/backup/import', handle((req, res) => {
    const b = req.body as Partial<Bundle>;
    if (!b || b.app !== 'zak-os' || b.version !== 1 || typeof b.files !== 'object' || typeof b.kv !== 'object') return fail(res, 400, 'That file is not a Zak OS backup');
    let files = 0;
    for (const [name, value] of Object.entries(b.files ?? {})) {
      if (!FILES.includes(name)) continue;
      fs.writeFileSync(path.join(dataDir, name), JSON.stringify(value, null, 2));
      files++;
    }
    let settings = 0;
    for (const [key, value] of Object.entries(b.kv ?? {})) {
      if (KV_SKIP.test(key) || typeof value !== 'string' || key.length > 100) continue;
      try {
        kvSet(key, JSON.parse(value));
        settings++;
      } catch {
        /* skip unreadable setting */
      }
    }
    let tasks = 0;
    const insert = osdb.prepare('INSERT OR IGNORE INTO tasks(id, title, body, col, priority, due, project, source, source_ref, session_id, position, created, updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)');
    for (const t of (Array.isArray(b.tasks) ? b.tasks : []) as Array<Record<string, unknown>>) {
      if (typeof t.id !== 'string' || typeof t.title !== 'string') continue;
      const r = insert.run(t.id, String(t.title).slice(0, 200), String(t.body ?? '').slice(0, 8000), String(t.col ?? 'backlog'), String(t.priority ?? 'normal'), (t.due as number) ?? null, (t.project as string) ?? null, String(t.source ?? 'manual'), (t.source_ref as string) ?? null, null, Number(t.position) || 0, Number(t.created) || Date.now(), Number(t.updated) || Date.now());
      tasks += Number(r.changes);
    }
    audit('backup-import', 'owner', `Restored a backup: ${files} files, ${settings} settings, ${tasks} tasks`);
    res.json({ success: true, files, settings, tasks });
  }));
}

// ---- project starters ----------------------------------------------------------------------------

const STARTERS: Record<string, { label: string; files: (name: string) => Record<string, string> }> = {
  'node-ts': {
    label: 'Node and TypeScript',
    files: (name) => ({
      'package.json': JSON.stringify({ name, version: '0.1.0', private: true, type: 'module', scripts: { dev: 'tsx watch src/index.ts', start: 'tsx src/index.ts' }, devDependencies: { tsx: '^4.19.0', typescript: '^5.6.0', '@types/node': '^22.0.0' } }, null, 2) + '\n',
      'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true, esModuleInterop: true, skipLibCheck: true, outDir: 'dist' }, include: ['src'] }, null, 2) + '\n',
      'src/index.ts': `console.log('Hello from ${name}');\n`,
      '.gitignore': 'node_modules/\ndist/\n.env\n',
      'README.md': `# ${name}\n\nRun \`npm install\` then \`npm run dev\`.\n`,
    }),
  },
  'static-site': {
    label: 'Static website',
    files: (name) => ({
      'index.html': `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <title>${name}</title>\n    <link rel="stylesheet" href="styles.css" />\n  </head>\n  <body>\n    <main>\n      <h1>${name}</h1>\n      <p>Edit index.html and styles.css, then open the file in a browser.</p>\n    </main>\n  </body>\n</html>\n`,
      'styles.css': 'body {\n  margin: 0;\n  font-family: system-ui, sans-serif;\n  line-height: 1.5;\n}\nmain {\n  max-width: 40rem;\n  margin: 4rem auto;\n  padding: 0 1rem;\n}\n',
      '.gitignore': '.env\n',
      'README.md': `# ${name}\n\nA static site. Open index.html in a browser.\n`,
    }),
  },
  'python-cli': {
    label: 'Python command line tool',
    files: (name) => ({
      'main.py': `import argparse\n\n\ndef main() -> None:\n    parser = argparse.ArgumentParser(description="${name}")\n    parser.add_argument("name", nargs="?", default="world")\n    args = parser.parse_args()\n    print(f"Hello, {args.name}")\n\n\nif __name__ == "__main__":\n    main()\n`,
      '.gitignore': '__pycache__/\n.venv/\n.env\n',
      'README.md': `# ${name}\n\nRun \`python main.py\`.\n`,
    }),
  },
};

export const starterList = () => Object.entries(STARTERS).map(([id, s]) => ({ id, label: s.label }));

export function mountScaffoldRoutes(app: Express) {
  app.use('/api/scaffold', localOnly);

  app.get('/api/scaffold', (_req: Request, res: Response) => res.json({ success: true, starters: starterList() }));

  app.post('/api/scaffold', handle((req, res) => {
    const starter = STARTERS[str(req.body?.starter, 40) ?? ''];
    if (!starter) return fail(res, 400, 'Unknown starter');
    const name = (str(req.body?.name, 60) ?? '').trim();
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,59}$/.test(name)) return fail(res, 400, 'Use letters, numbers, dash or underscore for the project name');
    const parent = str(req.body?.parent, 500) ?? '';
    if (!path.isAbsolute(parent) || !fs.existsSync(parent) || !fs.statSync(parent).isDirectory()) return fail(res, 400, 'The parent folder must be an existing absolute path');
    const root = path.join(parent, name);
    if (fs.existsSync(root)) return fail(res, 409, 'A folder with that name already exists there');
    for (const [rel, content] of Object.entries(starter.files(name))) {
      const full = path.join(root, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content);
    }
    const project = addProject({ path: root, name, source: 'folder' });
    audit('scaffold', 'owner', `Created ${starter.label} project ${name}`, { project: name });
    res.status(201).json({ success: true, project });
  }));
}
