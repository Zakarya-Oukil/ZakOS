import type { Express, Request, Response } from 'express';
import { audit } from '../audit';
import { fail, handle, kvGet, kvSet, localOnly, run, str } from './common';
import { getSecret, setSecret, unlocked } from './secretStore';

/**
 * Outbound services. Tokens live in the encrypted secrets store (never in the page or the database),
 * and only non-secret settings (like a chat id) are kept in the key-value table.
 */
type ServiceId = 'github' | 'telegram' | 'discord' | 'slack';

interface Service {
  id: ServiceId;
  label: string;
  blurb: string;
  fields: Array<{ key: string; label: string; secret: boolean; placeholder: string }>;
}

export const SERVICES: Service[] = [
  { id: 'github', label: 'GitHub', blurb: 'Uses the GitHub CLI you already signed in to. Issues and pull requests flow through it.', fields: [] },
  {
    id: 'telegram',
    label: 'Telegram',
    blurb: 'A bot you create with BotFather messages you when runs finish or need approval.',
    fields: [
      { key: 'token', label: 'Bot token', secret: true, placeholder: '123456:ABC...' },
      { key: 'chatId', label: 'Chat id', secret: false, placeholder: 'Your chat id' },
    ],
  },
  { id: 'discord', label: 'Discord', blurb: 'A channel webhook posts run results to a server you own.', fields: [{ key: 'webhook', label: 'Webhook URL', secret: true, placeholder: 'https://discord.com/api/webhooks/...' }] },
  { id: 'slack', label: 'Slack', blurb: 'An incoming webhook posts run results to a channel.', fields: [{ key: 'webhook', label: 'Webhook URL', secret: true, placeholder: 'https://hooks.slack.com/services/...' }] },
];

const HOSTS: Partial<Record<ServiceId, RegExp>> = {
  discord: /^https:\/\/(discord(app)?\.com)\/api\/webhooks\//,
  slack: /^https:\/\/hooks\.slack\.com\/services\//,
};

const secretName = (id: ServiceId, key: string) => `integration.${id}.${key}`;
const settingsKey = (id: ServiceId) => `integration.${id}`;

async function githubStatus(): Promise<{ connected: boolean; detail: string }> {
  const out = await run('gh', ['auth', 'status'], { timeout: 10_000 });
  const text = `${out.stdout}\n${out.stderr}`;
  if (out.ok) {
    const who = /Logged in to [^\s]+ account ([^\s]+)/.exec(text)?.[1] ?? /account ([^\s]+)/.exec(text)?.[1];
    return { connected: true, detail: who ? `Signed in as ${who}` : 'Signed in' };
  }
  return { connected: false, detail: /not found|ENOENT|not recognized/i.test(text) ? 'The GitHub CLI (gh) is not installed' : 'Not signed in. Run gh auth login in a terminal.' };
}

function configured(id: ServiceId): boolean {
  const s = SERVICES.find((x) => x.id === id)!;
  const plain = kvGet<Record<string, string>>(settingsKey(id), {});
  return s.fields.every((f) => (f.secret ? kvGet<boolean>(`${settingsKey(id)}.has.${f.key}`, false) : !!plain[f.key]));
}

/** Sends a message through a configured service. Throws a plain Error the page can show. */
export async function sendMessage(id: ServiceId, text: string): Promise<void> {
  if (!unlocked()) throw new Error('Unlock the secrets store first');
  const body = text.slice(0, 1800);
  const plain = kvGet<Record<string, string>>(settingsKey(id), {});
  if (id === 'telegram') {
    const token = getSecret(secretName('telegram', 'token'));
    if (!token || !plain.chatId) throw new Error('Telegram is not set up');
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: plain.chatId, text: body }) });
    if (!r.ok) throw new Error(`Telegram answered ${r.status}`);
    return;
  }
  if (id === 'discord' || id === 'slack') {
    const url = getSecret(secretName(id, 'webhook'));
    if (!url || !HOSTS[id]!.test(url)) throw new Error(`${id} is not set up`);
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(id === 'discord' ? { content: body } : { text: body }) });
    if (!r.ok) throw new Error(`${id} answered ${r.status}`);
    return;
  }
  throw new Error('That service cannot send messages');
}

export function mountIntegrationRoutes(app: Express) {
  app.use('/api/integrations', localOnly);

  app.get('/api/integrations', handle(async (_req: Request, res: Response) => {
    const gh = await githubStatus();
    const list = SERVICES.map((s) => ({
      id: s.id,
      label: s.label,
      blurb: s.blurb,
      fields: s.fields,
      connected: s.id === 'github' ? gh.connected : configured(s.id),
      detail: s.id === 'github' ? gh.detail : configured(s.id) ? 'Saved' : 'Not set up',
      values: Object.fromEntries(s.fields.filter((f) => !f.secret).map((f) => [f.key, kvGet<Record<string, string>>(settingsKey(s.id), {})[f.key] ?? ''])),
    }));
    res.json({ success: true, services: list, unlocked: unlocked(), notYet: ['Email and calendar', 'Notion'] });
  }));

  app.put('/api/integrations/:id', handle((req, res) => {
    const svc = SERVICES.find((s) => s.id === req.params.id);
    if (!svc || svc.id === 'github') return fail(res, 404, 'Unknown service');
    if (!unlocked()) return fail(res, 423, 'Unlock the secrets store first');
    const plain = kvGet<Record<string, string>>(settingsKey(svc.id), {});
    for (const f of svc.fields) {
      const v = str(req.body?.[f.key], 2000)?.trim();
      if (v === undefined || v === '') continue;
      if (f.secret) {
        if (HOSTS[svc.id] && !HOSTS[svc.id]!.test(v)) throw new Error(`That does not look like a ${svc.label} webhook URL`);
        setSecret(secretName(svc.id, f.key), v);
        kvSet(`${settingsKey(svc.id)}.has.${f.key}`, true);
      } else plain[f.key] = v;
    }
    kvSet(settingsKey(svc.id), plain);
    audit('integration-save', 'owner', `Saved ${svc.label} settings`);
    res.json({ success: true });
  }));

  app.post('/api/integrations/:id/test', handle(async (req, res) => {
    const id = req.params.id as ServiceId;
    if (id === 'github') {
      const gh = await githubStatus();
      return res.json({ success: gh.connected, error: gh.connected ? undefined : gh.detail, detail: gh.detail });
    }
    await sendMessage(id, 'Zak OS test message: the connection works.');
    audit('integration-test', 'owner', `Sent a test message through ${id}`);
    res.json({ success: true, detail: 'Test message sent' });
  }));
}
