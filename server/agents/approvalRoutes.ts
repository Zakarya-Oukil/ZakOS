import type { Express, NextFunction, Request, Response } from 'express';
import { audit } from '../audit';
import { trustForPath } from '../projects/store';
import { isTrustedLocalRequest } from '../terminal/pty';
import { getAdapter } from './adapters';
import { clearResolved, getApproval, listApprovals, resolveApproval } from './approvals';
import { isRunning, SessionBusyError, sendMessage, type Broadcast } from './runner';
import { isTrust } from './settings';
import * as store from './store';

/** Approving lets an agent run a command or edit a file, so these routes are local-only like the terminal. */
function localOnly(req: Request, res: Response, next: NextFunction) {
  if (!isTrustedLocalRequest(req)) {
    res.status(403).json({ success: false, error: 'Local access only' });
    return;
  }
  next();
}

const fail = (res: Response, status: number, error: string) => res.status(status).json({ success: false, error });
const pid = (req: Request) => String(req.params.id);

export function mountApprovalRoutes(app: Express, broadcast: Broadcast) {
  app.use('/api/approvals', localOnly);

  app.get('/api/approvals', (_req: Request, res: Response) => {
    const approvals = listApprovals().map((a) => ({ ...a, sessionTitle: store.getSession(a.sessionId)?.title }));
    res.json({ success: true, approvals });
  });

  app.post('/api/approvals/clear', (_req: Request, res: Response) => {
    clearResolved();
    res.json({ success: true });
  });

  app.post('/api/approvals/:id/approve', async (req: Request, res: Response) => {
    const a = getApproval(pid(req));
    if (!a) return fail(res, 404, 'Approval not found');
    if (a.state !== 'pending') return fail(res, 409, `Already ${a.state}`);
    const session = store.getSession(a.sessionId);
    if (!session) return fail(res, 410, 'The session this came from no longer exists');
    if (session.agent !== 'claude') return fail(res, 409, `${getAdapter(session.agent)?.label ?? session.agent} cannot take per-action approvals`);
    const trust = isTrust(session.trust) ? session.trust : trustForPath(session.cwd);
    if (trust === 'read-only') return fail(res, 409, 'This project is read-only. Raise its trust level first, since read-only blocks changes even when approved.');
    if (isRunning(a.sessionId)) return fail(res, 409, 'The session is busy. Approve again when it finishes.');
    try {
      await sendMessage(
        a.sessionId,
        `Permission was refused for this action, and the owner has now approved it: ${a.summary}\nGo ahead and retry it, then continue with the original task.`,
        broadcast,
        { allowedTools: [a.rule] },
      );
    } catch (err) {
      if (err instanceof SessionBusyError) return fail(res, 409, err.message);
      return fail(res, 500, err instanceof Error ? err.message : String(err));
    }
    resolveApproval(a.id, 'approved');
    audit('approval', 'owner', `Approved ${a.rule}`, { sessionId: a.sessionId, project: a.project });
    res.json({ success: true });
  });

  app.post('/api/approvals/:id/dismiss', (req: Request, res: Response) => {
    const a = getApproval(pid(req));
    if (!a) return fail(res, 404, 'Approval not found');
    if (a.state !== 'pending') return fail(res, 409, `Already ${a.state}`);
    resolveApproval(a.id, 'dismissed');
    audit('approval', 'owner', `Dismissed ${a.rule}`, { sessionId: a.sessionId, project: a.project });
    res.json({ success: true });
  });
}
