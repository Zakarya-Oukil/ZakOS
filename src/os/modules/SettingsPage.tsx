import { useEffect, useRef, useState } from 'react';
import { useModules } from '../lib/moduleContext';
import { useAgentsConnection } from '../lib/agentsSocket';
import { PageFrame } from '../shell/PageFrame';
import { Button, ErrorNote, Panel, Segmented, StatusDot, SuccessNote, Tabs } from '../ui';
import { ACCENTS, useAppearance, type Appearance } from '../theme/appearance';
import { useTheme } from '../theme/useTheme';
import { ACTIONS, bindingFor, comboFromEvent, prettyCombo, setShortcut, useShortcutBindings } from '../lib/shortcuts';
import { api } from '../lib/api';
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

const PRESETS: Array<{ id: string; label: string; blurb: string; on: (id: string) => boolean }> = [
  { id: 'developer', label: 'Developer', blurb: 'Everything switched on.', on: () => true },
  { id: 'personal', label: 'Personal', blurb: 'Notes, tasks and agents without the build tools.', on: (id) => !['git', 'dev', 'terminal', 'files', 'mcp', 'webhooks'].includes(id) },
  { id: 'minimal', label: 'Minimal', blurb: 'Home, agents, projects, approvals and settings.', on: (id) => ['home', 'agents', 'projects', 'approvals', 'settings', 'licence'].includes(id) },
];

function AppearanceStudio() {
  const { appearance, update } = useAppearance();
  const { theme, toggle } = useTheme();
  return (
    <div className="grid gap-5">
      <Panel title="Theme and colour">
        <div className="grid gap-5">
          <div className="grid gap-2">
            <span className="text-[13px] font-medium text-os-text">Theme</span>
            <Segmented<'dark' | 'light'> label="Theme" value={theme} onChange={(t) => t !== theme && toggle()} options={[{ id: 'dark', label: 'Dark' }, { id: 'light', label: 'Light' }]} />
          </div>
          <div className="grid gap-2">
            <span className="text-[13px] font-medium text-os-text">Accent</span>
            <div className="flex flex-wrap gap-3">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  aria-label={a.label}
                  aria-pressed={appearance.accent === a.id}
                  onClick={() => update({ accent: a.id })}
                  className="grid justify-items-center gap-1.5 rounded-[var(--os-radius)] p-1 focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
                >
                  <span style={{ backgroundColor: theme === 'dark' ? a.dark : a.light }} className={cx('h-9 w-9 rounded-full', appearance.accent === a.id && 'ring-2 ring-[var(--os-text)] ring-offset-2 ring-offset-[var(--os-bg)]')} />
                  <span className="text-xs text-os-muted">{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Panel>
      <Panel title="Motion and background">
        <div className="grid gap-5">
          <div className="grid gap-2">
            <span className="text-[13px] font-medium text-os-text">Motion</span>
            <Segmented<Appearance['motion']> label="Motion" value={appearance.motion} onChange={(motion) => update({ motion })} options={[{ id: 'full', label: 'Full' }, { id: 'calm', label: 'Calm' }, { id: 'off', label: 'Off' }]} />
            <p className="text-xs text-os-muted">Your system's reduced motion setting is always respected on top of this.</p>
          </div>
          <div className="grid gap-2">
            <span className="text-[13px] font-medium text-os-text">Background</span>
            <Segmented<Appearance['backdrop']> label="Background" value={appearance.backdrop} onChange={(backdrop) => update({ backdrop })} options={[{ id: 'contours', label: 'Moving contours' }, { id: 'still', label: 'Still contours' }, { id: 'none', label: 'Plain' }]} />
          </div>
          <div className="grid gap-2">
            <span className="text-[13px] font-medium text-os-text">Density</span>
            <Segmented<Appearance['density']> label="Density" value={appearance.density} onChange={(density) => update({ density })} options={[{ id: 'comfortable', label: 'Comfortable' }, { id: 'compact', label: 'Compact' }]} />
          </div>
        </div>
      </Panel>
    </div>
  );
}

function Shortcuts() {
  const bindings = useShortcutBindings();
  const [listening, setListening] = useState<string | null>(null);

  useEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') return setListening(null);
      const combo = comboFromEvent(e);
      if (!combo || combo === 'ctrl+k') return;
      setShortcut(listening, combo);
      setListening(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [listening]);

  return (
    <Panel title="Keyboard shortcuts" padded={false}>
      <ul>
        <li className="flex items-center justify-between gap-3 border-b border-os-line px-4 py-3">
          <span className="text-sm text-os-text">Open the command palette</span>
          <kbd className="rounded-[var(--os-radius-sm)] bg-os-surface-2 px-2 py-1 font-os-mono text-xs text-os-muted">Ctrl + K (fixed)</kbd>
        </li>
        {ACTIONS.map((a) => {
          const combo = bindingFor(a.id, bindings);
          const clash = ACTIONS.some((o) => o.id !== a.id && bindingFor(o.id, bindings) === combo);
          return (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-os-line px-4 py-3 last:border-b-0">
              <span className="text-sm text-os-text">{a.label}</span>
              <span className="flex items-center gap-2">
                {clash && <span className="text-xs text-os-danger">Also used elsewhere</span>}
                <kbd className="rounded-[var(--os-radius-sm)] bg-os-surface-2 px-2 py-1 font-os-mono text-xs text-os-text">{listening === a.id ? 'Press the keys' : prettyCombo(combo)}</kbd>
                <Button size="sm" onClick={() => setListening(listening === a.id ? null : a.id)}>{listening === a.id ? 'Cancel' : 'Change'}</Button>
                {bindings[a.id] && <Button size="sm" variant="ghost" onClick={() => setShortcut(a.id, null)}>Reset</Button>}
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function Backup() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const exportNow = async () => {
    try {
      const res = await fetch('/api/backup/export');
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `zak-os-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setMsg({ ok: true, text: 'Backup downloaded.' });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  const restore = async (file: File) => {
    try {
      const bundle = JSON.parse(await file.text());
      if (!window.confirm('Restore this backup? Saved templates, prompts, schedules and settings in the file replace the current ones. Tasks are added.')) return;
      const d = await api<{ files: number; settings: number; tasks: number }>('/api/backup/import', { method: 'POST', body: bundle });
      setMsg({ ok: true, text: `Restored ${d.files} files, ${d.settings} settings and ${d.tasks} tasks. Reload the page to see everything.` });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  return (
    <Panel title="Backup and restore">
      <div className="grid gap-4">
        <p className="max-w-[68ch] text-sm leading-relaxed text-os-muted">
          A backup holds your workflow templates, saved prompts, schedules, module switches, tasks and settings. It leaves out sessions, the audit log, encrypted secrets, licence keys and API keys, so the file is safe to keep in a drive.
        </p>
        {msg && (msg.ok ? <SuccessNote>{msg.text}</SuccessNote> : <ErrorNote>{msg.text}</ErrorNote>)}
        <input ref={fileRef} type="file" accept="application/json" className="hidden" aria-label="Choose a backup file" onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" onClick={exportNow}>Download a backup</Button>
          <Button size="sm" onClick={() => fileRef.current?.click()}>Restore from a file</Button>
        </div>
      </div>
    </Panel>
  );
}

type Tab = 'general' | 'appearance' | 'agents' | 'shortcuts' | 'backup';

export default function SettingsPage() {
  const { isEnabled, setEnabled } = useModules();
  const { agents, error, refresh } = useAgents();
  const connected = useAgentsConnection();
  const [tab, setTab] = useState<Tab>('general');

  const applyPreset = (on: (id: string) => boolean) => MODULES.forEach((m) => !m.required && setEnabled(m.id, on(m.id)));

  return (
    <PageFrame
      title="Settings"
      leading={
        <Tabs
          aria-label="Settings sections"
          tabs={[{ id: 'general', label: 'Modules' }, { id: 'appearance', label: 'Appearance' }, { id: 'agents', label: 'Agents' }, { id: 'shortcuts', label: 'Shortcuts' }, { id: 'backup', label: 'Backup' }]}
          value={tab}
          onChange={(t) => setTab(t as Tab)}
          className="border-b-0"
        />
      }
    >
      <div className="h-full overflow-y-auto p-6">
        <div className="mx-auto grid max-w-3xl gap-5">
          {tab === 'general' && (
            <>
              <Panel title="Presets">
                <ul className="grid gap-3 sm:grid-cols-3">
                  {PRESETS.map((p) => (
                    <li key={p.id} className="grid content-between gap-3 rounded-[var(--os-radius)] border border-os-line p-3">
                      <div>
                        <p className="text-sm font-medium text-os-text">{p.label}</p>
                        <p className="text-xs text-os-muted">{p.blurb}</p>
                      </div>
                      <Button size="sm" onClick={() => applyPreset(p.on)}>Apply</Button>
                    </li>
                  ))}
                </ul>
              </Panel>
              <Panel title="Modules" padded={false}>
                <ul className="divide-y divide-os-line">
                  {MODULES.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-4 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-os-text">{m.label}</p>
                        <p className="text-[13px] text-os-muted">{m.description}</p>
                      </div>
                      <Switch label={`${m.label} module`} checked={isEnabled(m.id)} disabled={m.required} onChange={(v) => setEnabled(m.id, v)} />
                    </li>
                  ))}
                </ul>
              </Panel>
            </>
          )}

          {tab === 'appearance' && <AppearanceStudio />}
          {tab === 'shortcuts' && <Shortcuts />}
          {tab === 'backup' && <Backup />}

          {tab === 'agents' && (
            <>
              <Panel
                title="Agents"
                header={
                  <button type="button" onClick={refresh} className="rounded-[var(--os-radius-sm)] px-2 py-0.5 text-xs text-os-muted hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]">
                    Recheck
                  </button>
                }
                padded={false}
              >
                {error && <p className="px-3 py-3 text-sm text-os-danger">Server unreachable: {error}</p>}
                <ul className="divide-y divide-os-line">
                  {agents.map((a) => (
                    <li key={a.id} className="flex items-start gap-3 px-4 py-3">
                      <StatusDot status={a.available ? 'idle' : 'error'} label={a.available ? 'Available' : 'Unavailable'} className="mt-1.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-os-text">{a.label}</p>
                        <p className="break-words text-[13px] text-os-muted">{a.available ? (a.version ?? 'Installed') : (a.reason ?? 'Not available')}</p>
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
            </>
          )}
        </div>
      </div>
    </PageFrame>
  );
}
