import { useEffect, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Panel } from '../../ui';
import { agentsApi, type ActionInfo, type SessionInfo } from './api';
import { ago, resumeCommand } from './format';
import { Changes } from './Changes';

interface RightRailProps {
  session: SessionInfo;
  actions: ActionInfo[];
  running: boolean;
  onChanged: () => void;
}

export function RightRail({ session, actions, running, onChanged }: RightRailProps) {
  const [title, setTitle] = useState(session.title);
  const [copied, setCopied] = useState(false);
  const [confirmRef, setConfirmRef] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => setTitle(session.title), [session.id, session.title]);
  useEffect(() => setNotice(null), [session.id]);

  const saveTitle = async () => {
    const next = title.trim();
    if (!next || next === session.title) return setTitle(session.title);
    try {
      await agentsApi.rename(session.id, next);
      onChanged();
    } catch (e) {
      setNotice({ tone: 'error', text: (e as Error).message });
    }
  };

  const copy = async () => {
    if (!session.cli_session_id) return;
    try {
      await navigator.clipboard.writeText(resumeCommand(session.agent, session.cli_session_id));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setNotice({ tone: 'error', text: 'Clipboard is not available in this browser context.' });
    }
  };

  const restore = async (ref: string) => {
    setConfirmRef(null);
    try {
      await agentsApi.restore(session.id, ref);
      setNotice({ tone: 'ok', text: 'Tracked files restored to that checkpoint.' });
      onChanged();
    } catch (e) {
      setNotice({ tone: 'error', text: (e as Error).message });
    }
  };

  const prompts = actions.filter((a) => a.kind === 'prompt');

  return (
    <div className="grid content-start gap-4 p-3">
      <Panel title="Session">
        <div className="grid gap-3 text-sm">
          <div className="grid gap-1">
            <label htmlFor="session-title" className="text-xs text-os-muted">
              Title
            </label>
            <input
              id="session-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => void saveTitle()}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              maxLength={120}
              className="h-8 rounded-[var(--os-radius)] border border-os-line bg-os-bg px-2 text-sm text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
            />
          </div>
          <div className="grid gap-1">
            <span className="text-xs text-os-muted">Working folder</span>
            <span className="break-all font-os-mono text-xs text-os-text">{session.cwd}</span>
          </div>
          <div className="grid gap-1">
            <span className="text-xs text-os-muted">Resume in a terminal</span>
            {session.cli_session_id ? (
              <button
                type="button"
                onClick={() => void copy()}
                className="flex items-start gap-2 rounded-[var(--os-radius)] border border-os-line bg-os-bg px-2 py-1.5 text-left hover:border-os-cyan focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
              >
                <span className="min-w-0 flex-1 break-all font-os-mono text-xs text-os-text">
                  {resumeCommand(session.agent, session.cli_session_id)}
                </span>
                {copied ? (
                  <Check size={14} strokeWidth={1.75} className="mt-0.5 shrink-0 text-os-cyan" aria-label="Copied" />
                ) : (
                  <Copy size={14} strokeWidth={1.75} className="mt-0.5 shrink-0 text-os-muted" aria-label="Copy command" />
                )}
              </button>
            ) : (
              <span className="text-xs text-os-muted">Available after the first reply.</span>
            )}
          </div>
        </div>
      </Panel>

      <Changes session={session} actions={actions} running={running} />

      <Panel title="Checkpoints" padded={false}>
        {notice && (
          <p role={notice.tone === 'error' ? 'alert' : 'status'} className={notice.tone === 'error' ? 'px-3 pt-3 text-xs text-os-danger' : 'px-3 pt-3 text-xs text-os-cyan'}>
            {notice.text}
          </p>
        )}
        {prompts.length === 0 ? (
          <p className="p-3 text-xs leading-relaxed text-os-muted">
            Before each prompt in a git folder, a snapshot of tracked files is saved here so you can roll a run back.
          </p>
        ) : (
          <ul className="divide-y divide-os-line">
            {prompts.map((a) => (
              <li key={a.id} className="grid gap-1 px-3 py-2.5">
                <span className="line-clamp-2 break-words text-[13px] text-os-text">{a.detail}</span>
                <span className="flex items-center justify-between gap-2 text-xs text-os-muted">
                  <span>{ago(a.ts)}</span>
                  {a.checkpoint_ref ? (
                    confirmRef === a.checkpoint_ref ? (
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void restore(a.checkpoint_ref!)}
                          className="rounded-[var(--os-radius-sm)] px-1.5 py-0.5 text-os-amber hover:bg-os-surface-2 focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
                        >
                          Restore files
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRef(null)}
                          className="rounded-[var(--os-radius-sm)] px-1.5 py-0.5 hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={running}
                        title={running ? 'Stop the run first' : undefined}
                        onClick={() => setConfirmRef(a.checkpoint_ref)}
                        className="rounded-[var(--os-radius-sm)] px-1.5 py-0.5 hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Restore
                      </button>
                    )
                  ) : (
                    <span>No git snapshot</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
