import type { Express, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve(process.cwd(), 'data', 'os-modules.json');
const ID = /^[a-z0-9-]{1,40}$/;

function read(): string[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Array.isArray(parsed.disabled) ? parsed.disabled.filter((x: unknown) => typeof x === 'string' && ID.test(x)) : [];
  } catch {
    return [];
  }
}

/** Which OS modules the owner has switched off. Stored beside the session database. */
export function mountOsSettingsRoutes(app: Express) {
  app.get('/api/os/modules', (_req: Request, res: Response) => {
    res.json({ success: true, disabled: read() });
  });

  app.put('/api/os/modules', (req: Request, res: Response) => {
    const disabled = req.body?.disabled;
    if (!Array.isArray(disabled) || disabled.length > 50 || !disabled.every((x) => typeof x === 'string' && ID.test(x))) {
      res.status(400).json({ success: false, error: 'disabled must be a list of module ids' });
      return;
    }
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify({ disabled: [...new Set(disabled)] }, null, 2));
    res.json({ success: true, disabled });
  });
}
