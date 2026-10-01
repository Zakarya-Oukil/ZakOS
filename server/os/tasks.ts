import { randomUUID } from 'node:crypto';
import type { Express, Request, Response } from 'express';
import { audit } from '../audit';
import { getProject } from '../projects/store';
import { fail, handle, localOnly, osdb, run, str } from './common';

export const COLUMNS = ['backlog', 'doing', 'waiting', 'review', 'done'] as const;
export type Column = (typeof COLUMNS)[number];
const PRIORITIES = ['low', 'normal', 'high'] as const;

export interface Task {
  id: string;
  title: string;
  body: string;
  column: Column;
  priority: (typeof PRIORITIES)[number];
  due: number | null;
  project: string | null;
  source: string;
  sourceRef: string | null;
  sessionId: string | null;
  position: number;
  created: number;
  updated: number;
}

osdb.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    col TEXT NOT NULL DEFAULT 'backlog',
    priority TEXT NOT NULL DEFAULT 'normal',
    due INTEGER,
    project TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    source_ref TEXT,
    session_id TEXT,
    position REAL NOT NULL DEFAULT 0,
    created INTEGER NOT NULL,
    updated INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_tasks_col ON tasks(col, position);
`);

interface Row {
  id: string;
  title: string;
  body: string;
  col: Column;
  priority: Task['priority'];
  due: number | null;
  project: string | null;
  source: string;
  source_ref: string | null;
  session_id: string | null;
  position: number;
  created: number;
  updated: number;
}

const toTask = (r: Row): Task => ({
  id: r.id,
  title: r.title,
  body: r.body,
  column: r.col,
  priority: r.priority,
  due: r.due,
  project: r.project,
  source: r.source,
  sourceRef: r.source_ref,
  sessionId: r.session_id,
  position: r.position,
  created: r.created,
  updated: r.updated,
});

export const listTasks = (): Task[] => (osdb.prepare('SELECT * FROM tasks ORDER BY position, created').all() as unknown as Row[]).map(toTask);
const getTask = (id: string): Task | undefined => {
  const r = osdb.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Row | undefined;
  return r ? toTask(r) : undefined;
};

export function createTask(input: { title: string; body?: string; column?: Column; priority?: Task['priority']; due?: number | null; project?: string | null; source?: string; sourceRef?: string | null }): Task {
  const title = input.title.trim().slice(0, 200);
  if (!title) throw new Error('A task needs a title');
  const column = input.column && COLUMNS.includes(input.column) ? input.column : 'backlog';
  const priority = input.priority && PRIORITIES.includes(input.priority) ? input.priority : 'normal';
  const now = Date.now();
  const id = randomUUID();
  const max = (osdb.prepare('SELECT COALESCE(MAX(position), 0) AS m FROM tasks WHERE col = ?').get(column) as { m: number }).m;
  osdb
    .prepare('INSERT INTO tasks(id, title, body, col, priority, due, project, source, source_ref, position, created, updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, title, (input.body ?? '').slice(0, 8000), column, priority, input.due ?? null, input.project ?? null, input.source ?? 'manual', input.sourceRef ?? null, max + 1, now, now);
  return getTask(id)!;
}

export function mountTaskRoutes(app: Express) {
  app.use('/api/tasks', localOnly);

  app.get('/api/tasks', (_req: Request, res: Response) => res.json({ success: true, tasks: listTasks(), columns: COLUMNS }));

  app.post('/api/tasks', handle((req, res) => {
    const b = req.body ?? {};
    const task = createTask({
      title: str(b.title) ?? '',
      body: str(b.body, 8000),
      column: b.column,
      priority: b.priority,
      due: typeof b.due === 'number' ? b.due : null,
      project: str(b.project, 80) ?? null,
    });
    audit('task-create', 'owner', `Created task: ${task.title}`);
    res.status(201).json({ success: true, task });
  }));

  app.patch('/api/tasks/:id', handle((req, res) => {
    const cur = getTask(String(req.params.id));
    if (!cur) return fail(res, 404, 'Task not found');
    const b = req.body ?? {};
    const column = COLUMNS.includes(b.column) ? (b.column as Column) : cur.column;
    const priority = PRIORITIES.includes(b.priority) ? (b.priority as Task['priority']) : cur.priority;
    const title = (str(b.title, 200) ?? cur.title).trim() || cur.title;
    let position = typeof b.position === 'number' ? b.position : cur.position;
    if (column !== cur.column && typeof b.position !== 'number') {
      position = (osdb.prepare('SELECT COALESCE(MAX(position), 0) AS m FROM tasks WHERE col = ?').get(column) as { m: number }).m + 1;
    }
    osdb
      .prepare('UPDATE tasks SET title=?, body=?, col=?, priority=?, due=?, project=?, session_id=?, position=?, updated=? WHERE id=?')
      .run(
        title,
        str(b.body, 8000) ?? cur.body,
        column,
        priority,
        'due' in b ? (typeof b.due === 'number' ? b.due : null) : cur.due,
        'project' in b ? (str(b.project, 80) ?? null) : cur.project,
        'sessionId' in b ? (str(b.sessionId, 80) ?? null) : cur.sessionId,
        position,
        Date.now(),
        cur.id,
      );
    if (column !== cur.column) audit('task-move', 'owner', `Moved "${title}" to ${column}`);
    res.json({ success: true, task: getTask(cur.id) });
  }));

  app.delete('/api/tasks/:id', handle((req, res) => {
    const cur = getTask(String(req.params.id));
    if (!cur) return fail(res, 404, 'Task not found');
    osdb.prepare('DELETE FROM tasks WHERE id = ?').run(cur.id);
    audit('task-delete', 'owner', `Deleted task: ${cur.title}`);
    res.json({ success: true });
  }));

  /** Pulls open GitHub issues for a project through the gh CLI the owner already signed in to. */
  app.post('/api/tasks/import-github', handle(async (req, res) => {
    const project = getProject(str(req.body?.projectId, 80) ?? '');
    if (!project) return fail(res, 404, 'Project not found');
    const out = await run('gh', ['issue', 'list', '--state', 'open', '--limit', '30', '--json', 'number,title,body,url'], { cwd: project.path, timeout: 25_000 });
    if (!out.ok) return fail(res, 400, out.stderr.trim().slice(0, 300) || 'gh could not list issues. Is the GitHub CLI signed in?');
    const issues = JSON.parse(out.stdout) as Array<{ number: number; title: string; body: string; url: string }>;
    const known = new Set((osdb.prepare("SELECT source_ref FROM tasks WHERE source = 'github'").all() as Array<{ source_ref: string }>).map((r) => r.source_ref));
    let added = 0;
    for (const i of issues) {
      if (known.has(i.url)) continue;
      createTask({ title: i.title, body: `${(i.body ?? '').slice(0, 1500)}\n\n${i.url}`, project: project.id, source: 'github', sourceRef: i.url });
      added++;
    }
    audit('task-import', 'owner', `Imported ${added} GitHub issue${added === 1 ? '' : 's'} for ${project.name}`);
    res.json({ success: true, added, seen: issues.length });
  }));
}
