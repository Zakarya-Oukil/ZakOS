import { execFile } from 'node:child_process';
import type { Express, NextFunction, Request, Response } from 'express';
import { isTrustedLocalRequest } from '../terminal/pty';
import { registerPicked, resolveOne, searchFiles, searchGraph, searchNotes, type AttachKind, type Candidate } from './context';
import { deletePrompt, listPrompts, savePrompt } from './prompts';
import * as store from './store';

/** These read files and fetch URLs on the owner's behalf, so they are local-only like the terminal. */
function localOnly(req: Request, res: Response, next: NextFunction) {
  if (!isTrustedLocalRequest(req)) {
    res.status(403).json({ success: false, error: 'Local access only' });
    return;
  }
  next();
}

const fail = (res: Response, status: number, error: string) => res.status(status).json({ success: false, error });
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

const FILE_PICKER = `
Add-Type -AssemblyName System.Windows.Forms
$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
$owner.ShowInTaskbar = $false
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = $args[0]
if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dialog.FileName) }
`;
const FOLDER_PICKER = `
Add-Type -AssemblyName System.Windows.Forms
$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
$owner.ShowInTaskbar = $false
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = $args[0]
if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dialog.SelectedPath) }
`;

export function mountContextRoutes(app: Express) {
  app.use(['/api/context', '/api/prompts'], localOnly);

  /** Candidates to attach. `kind` narrows to files, notes or graph; omitted searches all three for @-mentions. */
  app.get('/api/context/search', async (req: Request, res: Response) => {
    const session = store.getSession(String(req.query.sessionId ?? ''));
    if (!session) return fail(res, 404, 'Session not found');
    const q = String(req.query.q ?? '').slice(0, 100);
    const kind = str(req.query.kind);
    try {
      let results: Candidate[];
      if (kind === 'file') results = await searchFiles(session.cwd, q, 30);
      else if (kind === 'note') results = searchNotes(q, 30);
      else if (kind === 'graph') results = searchGraph(session.cwd, q, 30);
      else results = [...(await searchFiles(session.cwd, q, 6)), ...searchNotes(q, 4), ...searchGraph(session.cwd, q, 4)];
      res.json({ success: true, results });
    } catch (err) {
      fail(res, 500, err instanceof Error ? err.message : String(err));
    }
  });

  /** Checks one attachment now (so a bad URL fails when added, not when sending) and reports its size. */
  app.post('/api/context/check', async (req: Request, res: Response) => {
    const session = store.getSession(String(req.body?.sessionId ?? ''));
    if (!session) return fail(res, 404, 'Session not found');
    const kind = str(req.body?.kind) as AttachKind | undefined;
    const ref = str(req.body?.ref);
    if (!kind || !ref) return fail(res, 400, 'kind and ref are required');
    try {
      const r = await resolveOne(session.cwd, { kind, ref });
      res.json({ success: true, label: r.label, size: r.text.length, truncated: r.truncated });
    } catch (err) {
      fail(res, 400, err instanceof Error ? err.message : String(err));
    }
  });

  // Native Windows dialog; the chosen path is registered so only a path the owner picked can be attached.
  app.post('/api/context/pick', (req: Request, res: Response) => {
    if (process.platform !== 'win32') return fail(res, 501, 'The picker is only available on Windows.');
    const folder = req.body?.type === 'folder';
    execFile(
      'powershell.exe',
      ['-NoProfile', '-STA', '-Command', `& { ${folder ? FOLDER_PICKER : FILE_PICKER} } '${folder ? 'Choose a folder to attach' : 'Choose a file to attach'}'`],
      { windowsHide: false, timeout: 5 * 60_000 },
      (err, stdout) => {
        if (err) return fail(res, 500, 'The dialog could not be opened');
        const chosen = stdout.trim();
        if (!chosen) return res.json({ success: true, picked: null });
        try {
          const p = registerPicked(chosen);
          res.json({ success: true, picked: { kind: 'picked', ref: p.ref, label: p.isDir ? `${p.label}/` : p.label } });
        } catch (e) {
          fail(res, 400, e instanceof Error ? e.message : String(e));
        }
      },
    );
  });

  app.get('/api/prompts', (_req: Request, res: Response) => {
    res.json({ success: true, prompts: listPrompts() });
  });

  app.post('/api/prompts', (req: Request, res: Response) => {
    const name = str(req.body?.name);
    const text = str(req.body?.text);
    if (!name || !text) return fail(res, 400, 'name and text are required');
    try {
      res.status(201).json({ success: true, prompt: savePrompt(name, text) });
    } catch (err) {
      fail(res, 400, err instanceof Error ? err.message : String(err));
    }
  });

  app.delete('/api/prompts/:id', (req: Request, res: Response) => {
    if (!deletePrompt(String(req.params.id))) return fail(res, 404, 'Prompt not found');
    res.json({ success: true });
  });
}
