import { useEffect, useState } from 'react';
import { useModules } from '../lib/moduleContext';
import { useAgentsConnection } from '../lib/agentsSocket';
import { PageFrame } from '../shell/PageFrame';
import { Panel, StatusDot } from '../ui';
import { cx } from '../ui/cx';
import { useAgents } from './agents/hooks';
import { MODULES } from './registry';

function Switch({ checked, disabled, label, onChange }: { checked: boolean; disabled?: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative h-5 w-9 shrink-0 rounded-full border transition-colors',
        'focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'border-os-cyan bg-os-surface-2' : 'border-os-line bg-os-surface-2',
      )}
    >
      <span
        className={cx(
          'absolute top-0.5 h-3.5 w-3.5 rounded-full transition-[left,background-color] duration-150',
          checked ? 'left-[18px] bg-os-cyan' : 'left-0.5 bg-os-muted',
        )}
      />
    </button>
  );
}

interface AgentSettings {
  permissionMode: 'acceptEdits' | 'default';
  hermesModel: string;
}

function AgentBehaviour() {
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [model, setModel] = useState('');
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/agents/settings')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setSettings(d.settings);
          setModel(d.settings.hermesModel);
        }
      })
      .catch(() => setStatus({ tone: 'error', text: 'Could not load agent settings.' }));
  }, []);

  const save = async (patch: Partial<AgentSettings>) => {
    setStatus(null);
    try {
      const res = await fetch('/api/agents/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || 'Save failed');
      setSettings(d.settings);
      setModel(d.settings.hermesModel);
      setStatus({ tone: 'ok', text: 'Saved. New runs use this.' });
    } catch (e) {
      setStatus({ tone: 'error', text: (e as Error).message });
    }
  };

  const input =
    'h-8 rounded-[var(--os-input-radius)] border border-os-line bg-os-bg px-3 text-sm text-os-text placeholder:text-os-muted focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]';

  return (
    <Panel title="Agent behaviour">
      {!settings ? (
        <p className="text-sm text-os-muted">Loading</p>
      ) : (
        <div className="grid gap-4 text-sm">
          <div className="grid gap-1">
            <label htmlFor="perm-mode" className="text-xs text-os-muted">
              Permissions for Claude Code and Antigravity
            </label>
            <select
              id="perm-mode"
              value={settings.permissionMode}
              onChange={(e) => void save({ permissionMode: e.target.value as AgentSettings['permissionMode'] })}
              className={input}
            >
              <option value="acceptEdits">Auto-approve file edits</option>
              <option value="default">Ask for everything</option>
            </select>
            <p className="text-xs text-os-muted">Every prompt still takes a git checkpoint first, so a run can be rolled back.</p>
          </div>

          <div className="grid gap-1">
            <label htmlFor="hermes-model" className="text-xs text-os-muted">
              Hermes model
            </label>
            <div className="flex gap-2">
              <input
                id="hermes-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Blank uses Hermes's own default"
                spellCheck={false}
                className={`${input} min-w-0 flex-1 font-os-mono text-xs`}
              />
              <button
                type="button"
                onClick={() => void save({ hermesModel: model })}
                className="h-8 rounded-[var(--os-radius)] border border-os-line bg-os-surface-2 px-3 text-sm text-os-text hover:border-os-cyan focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
              >
                Save
              </button>
            </div>
            <p className="text-xs leading-relaxed text-os-muted">
              Hermes's free plan needs a one-time login. Run <span className="font-os-mono">hermes portal</span> in a terminal, pick a model
              there, then enter the same model name here.
            </p>
          </div>

          {status && (
            <p role={status.tone === 'error' ? 'alert' : 'status'} className={status.tone === 'error' ? 'text-os-danger' : 'text-os-cyan'}>
              {status.text}
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}

export default function SettingsPage() {
  const { isEnabled, setEnabled } = useModules();
  const { agents, error, refresh } = useAgents();
  const connected = useAgentsConnection();

  return (
    <PageFrame title="Settings">
      <div className="h-full overflow-y-auto p-6">
        <div className="mx-auto grid max-w-3xl gap-5">
          <Panel title="Modules" padded={false}>
            <ul className="divide-y divide-os-line">
              {MODULES.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-4 px-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-os-text">{m.label}</p>
                    <p className="text-[13px] text-os-muted">{m.description}</p>
                  </div>
                  <Switch
                    label={`${m.label} module`}
                    checked={isEnabled(m.id)}
                    disabled={m.required}
                    onChange={(v) => setEnabled(m.id, v)}
                  />
                </li>
              ))}
            </ul>
          </Panel>

          <Panel
            title="Agents"
            header={
              <button
                type="button"
                onClick={refresh}
                className="rounded-[var(--os-radius-sm)] px-2 py-0.5 text-xs text-os-muted hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
              >
                Recheck
              </button>
            }
            padded={false}
          >
            {error && <p className="px-3 py-3 text-sm text-os-danger">Server unreachable: {error}</p>}
            <ul className="divide-y divide-os-line">
              {agents.map((a) => (
                <li key={a.id} className="flex items-start gap-3 px-3 py-3">
                  <StatusDot status={a.available ? 'idle' : 'error'} label={a.available ? 'Available' : 'Unavailable'} className="mt-1.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-os-text">{a.label}</p>
                    <p className="break-words text-[13px] text-os-muted">
                      {a.available ? (a.version ?? 'Installed') : (a.reason ?? 'Not available')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <AgentBehaviour />

          <Panel title="Session bridge">
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-os-muted">Live stream</dt>
              <dd className="text-os-text">{connected ? 'Connected' : 'Reconnecting'}</dd>
              <dt className="text-os-muted">Checkpoints</dt>
              <dd className="text-os-text">A git snapshot is taken before every prompt in a git repository.</dd>
            </dl>
          </Panel>
        </div>
      </div>
    </PageFrame>
  );
}
