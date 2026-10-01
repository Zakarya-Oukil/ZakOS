import fs from 'node:fs';
import path from 'node:path';
import type { Express, Request, Response } from 'express';
import { audit } from '../audit';
import { getProject } from '../projects/store';
import { fail, handle, localOnly, str } from './common';

/**
 * Deploy recipes: the files needed to run a project on a small VPS with Docker. Zak OS writes them into the project
 * and explains each step. It never connects to a server, so nothing here can reach production by itself.
 */
type Stack = 'node' | 'python' | 'static';

function detect(root: string): { stack: Stack; reason: string } {
  const has = (f: string) => fs.existsSync(path.join(root, f));
  if (has('package.json')) return { stack: 'node', reason: 'Found package.json' };
  if (has('requirements.txt') || has('pyproject.toml')) return { stack: 'python', reason: 'Found Python requirements' };
  if (has('index.html')) return { stack: 'static', reason: 'Found index.html' };
  return { stack: 'static', reason: 'No known project files, so a static site recipe is offered' };
}

interface Recipe {
  files: Record<string, string>;
  notes: string[];
}

function recipe(stack: Stack, name: string, port: number, domain: string, root: string): Recipe {
  const slug = name.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'app';
  const compose = (internal: number) =>
    `services:\n  ${slug}:\n    build: .\n    container_name: ${slug}\n    restart: unless-stopped\n    env_file:\n      - .env.production\n    ports:\n      - "127.0.0.1:${port}:${internal}"\n`;

  let dockerfile: string;
  let internal = port;
  if (stack === 'node') {
    let start = 'npm start';
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { scripts?: Record<string, string> };
      if (!pkg.scripts?.start) start = pkg.scripts?.['server:start'] ? 'npm run server:start' : 'node .';
    } catch {
      /* unreadable package.json: keep the default */
    }
    dockerfile = `FROM node:22-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --omit=dev\nCOPY . .\nENV NODE_ENV=production PORT=${port}\nEXPOSE ${port}\nUSER node\nCMD [${start.split(' ').map((p) => JSON.stringify(p)).join(', ')}]\n`;
  } else if (stack === 'python') {
    dockerfile = `FROM python:3.12-slim\nWORKDIR /app\nCOPY requirements.txt ./\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY . .\nENV PORT=${port}\nEXPOSE ${port}\nRUN useradd -m app\nUSER app\nCMD ["python", "main.py"]\n`;
  } else {
    internal = 80;
    dockerfile = `FROM nginx:1.27-alpine\nCOPY . /usr/share/nginx/html\nEXPOSE 80\n`;
  }

  const caddy = domain ? `${domain} {\n  reverse_proxy 127.0.0.1:${port}\n}\n` : '';
  const files: Record<string, string> = {
    Dockerfile: dockerfile,
    'docker-compose.yml': compose(internal),
    '.dockerignore': 'node_modules\n.git\n.env\n.env.*\n*.log\ndist\n',
    '.env.production': '# Put production settings here. This file is not copied into the image or committed.\n',
    'deploy.sh': `#!/usr/bin/env sh\n# Usage: ./deploy.sh user@your-server /srv/${slug}\nset -eu\nHOST="\${1:?server, for example deploy@203.0.113.10}"\nDIR="\${2:-/srv/${slug}}"\nssh "$HOST" "mkdir -p $DIR"\nrsync -az --delete --exclude node_modules --exclude .git --exclude .env ./ "$HOST:$DIR/"\nssh "$HOST" "cd $DIR && docker compose up -d --build"\necho "Deployed ${slug} to $HOST"\n`,
    'DEPLOY.md': `# Deploying ${name}\n\nStack detected: ${stack}.\n\n## One-time server setup\n1. A small Linux VPS with Docker and the Compose plugin installed.\n2. SSH access with a key (no passwords).\n3. Create \`${'/srv/' + slug}\` or choose another folder.\n4. Copy your production settings to \`.env.production\` on the server.\n\n## Deploy\n\`\`\`sh\nchmod +x deploy.sh\n./deploy.sh deploy@your-server /srv/${slug}\n\`\`\`\n\nThe app listens on 127.0.0.1:${port} on the server, so it is not exposed until you put a reverse proxy in front.\n\n## HTTPS${domain ? `\nA Caddyfile for ${domain} is included. On the server: install Caddy, copy it to /etc/caddy/Caddyfile and run \`systemctl reload caddy\`. Caddy gets the certificate for you.` : '\nPoint a domain at the server, then use Caddy or nginx as a reverse proxy to 127.0.0.1:' + port + '.'}\n\n## Roll back\n\`docker compose logs --tail 100\` shows what happened. \`git checkout <previous commit>\` then deploy again.\n`,
  };
  if (caddy) files.Caddyfile = caddy;
  return {
    files,
    notes: [
      'Nothing is uploaded by Zak OS. deploy.sh runs on your machine when you choose to run it.',
      'Secrets belong in .env.production on the server, never in the image.',
      'The container binds to 127.0.0.1 only, so you decide how it is published.',
    ],
  };
}

export function mountDeployRoutes(app: Express) {
  app.use('/api/deploy', localOnly);

  const projectRoot = (req: Request, res: Response) => {
    const p = getProject(str(req.query.project ?? req.body?.project, 80) ?? '');
    if (!p) {
      fail(res, 404, 'Project not found');
      return null;
    }
    if (!fs.existsSync(p.path)) {
      fail(res, 410, 'The project folder no longer exists');
      return null;
    }
    return p;
  };

  const inputs = (req: Request, root: string, name: string) => {
    const port = Math.min(65535, Math.max(1024, Number(req.query.port ?? req.body?.port) || 3000));
    const domain = (str(req.query.domain ?? req.body?.domain, 120) ?? '').trim().toLowerCase();
    if (domain && !/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(domain)) throw new Error('That does not look like a domain name');
    const stackParam = str(req.query.stack ?? req.body?.stack, 10);
    const found = detect(root);
    const stack = (['node', 'python', 'static'] as const).find((s) => s === stackParam) ?? found.stack;
    return { port, domain, stack, reason: found.reason, recipe: recipe(stack, name, port, domain, root) };
  };

  app.get('/api/deploy/preview', handle((req: Request, res: Response) => {
    const p = projectRoot(req, res);
    if (!p) return;
    const r = inputs(req, p.path, p.name);
    const existing = Object.keys(r.recipe.files).filter((f) => fs.existsSync(path.join(p.path, f)));
    res.json({ success: true, stack: r.stack, reason: r.reason, port: r.port, files: r.recipe.files, existing, notes: r.recipe.notes });
  }));

  app.post('/api/deploy/write', handle((req: Request, res: Response) => {
    const p = projectRoot(req, res);
    if (!p) return;
    const r = inputs(req, p.path, p.name);
    const overwrite = req.body?.overwrite === true;
    const existing = Object.keys(r.recipe.files).filter((f) => fs.existsSync(path.join(p.path, f)));
    if (existing.length && !overwrite) return fail(res, 409, `These files already exist and were left alone: ${existing.join(', ')}. Tick overwrite to replace them.`);
    for (const [rel, content] of Object.entries(r.recipe.files)) {
      const full = path.resolve(p.path, rel);
      if (path.relative(p.path, full).startsWith('..')) continue;
      fs.writeFileSync(full, content, { mode: rel === 'deploy.sh' ? 0o755 : 0o644 });
    }
    audit('deploy-recipe', 'owner', `Wrote a ${r.stack} Docker deploy recipe`, { project: p.name });
    res.json({ success: true, written: Object.keys(r.recipe.files) });
  }));
}
