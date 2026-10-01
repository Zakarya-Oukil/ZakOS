import type { Express, NextFunction, Request, Response } from 'express';
import { auditKinds, insertAudit, queryAudit } from './agents/store';
import { scrubSecrets } from './secrets';
import { isTrustedLocalRequest } from './terminal/pty';
import { checkAlerts } from './os/alerts';

export interface AuditRefs {
  sessionId?: string;
  runId?: string;
  project?: string;
}

/**
 * Appends one entry to the audit log. Never throws: logging must not break the action it records.
 * Details are scrubbed of credentials and capped, since prompts and tool input can quote anything.
 */
export function audit(kind: string, actor: string, detail: string, refs: AuditRefs = {}): void {
  try {
    insertAudit({
      kind,
      actor: actor.slice(0, 60),
      detail: scrubSecrets(detail).slice(0, 600),
      session_id: refs.sessionId ?? null,
      run_id: refs.runId ?? null,
      project: refs.project?.slice(0, 120) ?? null,
    });
    checkAlerts(kind, actor, scrubSecrets(detail).slice(0, 600));
  } catch (err) {
    console.error('[audit] could not write:', err instanceof Error ? err.message : err);
  }
}

function localOnly(req: Request, res: Response, next: NextFunction) {
  if (!isTrustedLocalRequest(req)) {
    res.status(403).json({ success: false, error: 'Local access only' });
    return;
  }
  next();
}

export function mountAuditRoutes(app: Express) {
  app.use('/api/audit', localOnly);

  app.get('/api/audit', (req: Request, res: Response) => {
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
    const before = Number(req.query.before);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    res.json({
      success: true,
      entries: queryAudit({ kind: str(req.query.kind), q: str(req.query.q)?.slice(0, 100), before: Number.isFinite(before) && before > 0 ? before : undefined, limit }),
      kinds: auditKinds(),
    });
  });
}
