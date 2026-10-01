import type { Express, Request, Response } from 'express';
import { audit } from '../audit';
import { handle, localOnly, osdb, str } from './common';

const DAY = 86_400_000;
const RETENTION_DAYS = 90;

osdb.exec(`
  CREATE TABLE IF NOT EXISTS audit_archive (
    id INTEGER PRIMARY KEY,
    ts INTEGER NOT NULL,
    kind TEXT NOT NULL,
    actor TEXT NOT NULL,
    detail TEXT NOT NULL,
    session_id TEXT,
    run_id TEXT,
    project TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_audit_archive_ts ON audit_archive(ts DESC);
`);

const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** Charts, archive and export helpers for the Audit page. */
export function mountAuditExtras(app: Express) {
  app.use(['/api/audit-stats', '/api/audit-archive'], localOnly);

  app.get('/api/audit-stats', handle((req: Request, res: Response) => {
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 14));
    const since = new Date(Date.now() - (days - 1) * DAY);
    since.setHours(0, 0, 0, 0);
    const perDay = osdb.prepare("SELECT date(ts/1000, 'unixepoch', 'localtime') AS day, COUNT(*) AS n FROM audit WHERE ts >= ? GROUP BY day ORDER BY day").all(since.getTime());
    const topKinds = osdb.prepare('SELECT kind, COUNT(*) AS n FROM audit WHERE ts >= ? GROUP BY kind ORDER BY n DESC LIMIT 6').all(since.getTime());
    const old = (osdb.prepare('SELECT COUNT(*) AS n FROM audit WHERE ts < ?').get(Date.now() - RETENTION_DAYS * DAY) as { n: number }).n;
    const archived = (osdb.prepare('SELECT COUNT(*) AS n FROM audit_archive').get() as { n: number }).n;
    res.json({ success: true, days, perDay, topKinds, archivable: old, archived, retentionDays: RETENTION_DAYS });
  }));

  /** Moves entries older than the retention window into the archive table. They stay searchable, just out of the live log. */
  app.post('/api/audit-archive/run', handle((_req, res) => {
    const cutoff = Date.now() - RETENTION_DAYS * DAY;
    osdb.exec('BEGIN');
    try {
      osdb.prepare('INSERT OR IGNORE INTO audit_archive SELECT * FROM audit WHERE ts < ?').run(cutoff);
      const moved = osdb.prepare('DELETE FROM audit WHERE ts < ?').run(cutoff);
      osdb.exec('COMMIT');
      audit('audit-archive', 'owner', `Archived ${moved.changes} entries older than ${RETENTION_DAYS} days`);
      res.json({ success: true, moved: Number(moved.changes) });
    } catch (e) {
      osdb.exec('ROLLBACK');
      throw e;
    }
  }));

  app.get('/api/audit-archive', handle((req, res) => {
    const q = str(req.query.q, 100)?.trim();
    const before = Number(req.query.before);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const where: string[] = [];
    const args: Array<string | number> = [];
    if (q) {
      where.push("(detail LIKE ? ESCAPE '\\' OR actor LIKE ? ESCAPE '\\' OR project LIKE ? ESCAPE '\\')");
      args.push(like(q), like(q), like(q));
    }
    if (Number.isFinite(before) && before > 0) {
      where.push('id < ?');
      args.push(before);
    }
    const entries = osdb.prepare(`SELECT * FROM audit_archive ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC LIMIT ?`).all(...args, limit);
    res.json({ success: true, entries });
  }));
}
