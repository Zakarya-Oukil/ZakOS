import { useState } from 'react';
import { Copy } from '@phosphor-icons/react';
import type { ModuleProps } from '../registry';
import { PageFrame } from '../../shell/PageFrame';
import { Button, ErrorNote, Panel, Segmented, SuccessNote } from '../../ui';
import { api, useResource } from '../../lib/api';

interface Status {
  settings: { enabled: boolean; method: 'tailscale' | 'cloudflare' };
  listening: string;
  signIn: boolean;
  tailscale: { installed: boolean; running: boolean; host: string | null };
  cloudflared: boolean;
  terminalRemote: boolean;
}

function Cmd({ children }: { children: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-[var(--os-radius)] bg-os-surface-2 px-3 py-2">
      <code className="min-w-0 flex-1 break-all font-os-mono text-xs text-os-text">{children}</code>
      <button
        type="button"
        aria-label="Copy command"
        onClick={() => navigator.clipboard.writeText(children).then(() => setDone(true)).catch(() => undefined)}
        className="shrink-0 rounded-full p-1.5 text-os-muted hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
      >
        <Copy size={15} aria-hidden />
        {done && <span className="sr-only">Copied</span>}
      </button>
    </div>
  );
}

export default function RemotePage(_props: ModuleProps) {
  const { data, error, reload } = useResource<Status>('/api/remote/status');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const apply = async (patch: Partial<Status['settings']>) => {
    if (!data) return;
    setMsg(null);
    try {
      await api('/api/remote/settings', { method: 'PUT', body: { ...data.settings, ...patch } });
      reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  const method = data?.settings.method ?? 'tailscale';

  return (
    <PageFrame title="Remote access">
      <div className="h-full overflow-y-auto p-5">
        <div className="mx-auto grid max-w-[1000px] gap-5">
          {error && <ErrorNote>{error}</ErrorNote>}
          {msg && (msg.ok ? <SuccessNote>{msg.text}</SuccessNote> : <ErrorNote>{msg.text}</ErrorNote>)}
          <p className="max-w-[68ch] text-[15px] leading-relaxed text-os-muted">
            Zak OS listens on {data?.listening ?? '127.0.0.1:4000'} only. To approve agent actions from your phone you publish that address through a private tunnel, and Zak OS lets in
            only signed-in owners and operators. The terminal, files, secrets and settings stay on this machine whatever you do here.
          </p>

          <Panel title="Remote approvals">
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-os-text">{data?.settings.enabled ? 'On. Signed-in people on other devices can approve or dismiss agent actions.' : 'Off. Requests from other devices are refused.'}</p>
                <Button variant={data?.settings.enabled ? 'outline' : 'primary'} size="sm" onClick={() => apply({ enabled: !data?.settings.enabled })} disabled={!data}>
                  {data?.settings.enabled ? 'Switch off' : 'Switch on'}
                </Button>
              </div>
              {!data?.signIn && (
                <p className="rounded-[var(--os-radius)] border border-os-amber px-3 py-2 text-sm text-os-text">
                  Sign-in is not on yet. Create the owner account in <a className="underline underline-offset-2" href="#/team">Team</a> first, otherwise anyone with the link could reach this.
                </p>
              )}
              <p className="text-sm text-os-muted">Terminal over remote is off and cannot be switched on. A remote shell is remote code execution.</p>
            </div>
          </Panel>

          <Panel title="Publish through a tunnel">
            <div className="grid gap-4">
              <Segmented<'tailscale' | 'cloudflare'> label="Method" value={method} onChange={(m) => apply({ method: m })} options={[{ id: 'tailscale', label: 'Tailscale' }, { id: 'cloudflare', label: 'Cloudflare Tunnel' }]} />
              {method === 'tailscale' ? (
                <>
                  <p className="text-sm text-os-muted">
                    {!data ? 'Checking' : !data.tailscale.installed ? 'Tailscale is not installed on this machine.' : data.tailscale.running ? `Tailscale is running${data.tailscale.host ? ` as ${data.tailscale.host}` : ''}.` : 'Tailscale is installed but not connected.'}
                  </p>
                  <p className="text-sm text-os-text">Only devices on your own tailnet can reach it. Build the app, start the server, then publish it:</p>
                  <Cmd>npm run build</Cmd>
                  <Cmd>npm run server:start</Cmd>
                  <Cmd>tailscale serve --bg 4000</Cmd>
                  <p className="text-sm text-os-muted">Open the address Tailscale prints on your phone, then sign in with a Zak OS account.</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-os-muted">{!data ? 'Checking' : data.cloudflared ? 'cloudflared is installed.' : 'cloudflared is not installed. Get it from Cloudflare.'}</p>
                  <p className="text-sm text-os-text">A quick tunnel gives a temporary public address. Protect it with Cloudflare Access if you keep it:</p>
                  <Cmd>npm run build</Cmd>
                  <Cmd>npm run server:start</Cmd>
                  <Cmd>cloudflared tunnel --url http://127.0.0.1:4000</Cmd>
                </>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </PageFrame>
  );
}
