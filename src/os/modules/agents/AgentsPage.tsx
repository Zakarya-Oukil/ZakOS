import { useCallback, useMemo, useState } from 'react';
import { ArrowLeft, PanelRight } from 'lucide-react';
import type { ModuleProps } from '../registry';
import { PageFrame } from '../../shell/PageFrame';
import { IconButton, StatusDot, Tabs, type TabItem } from '../../ui';
import { cx } from '../../ui/cx';
import { agentsApi } from './api';
import { Conversation } from './Conversation';
import { useAgents, useSession, useSessions } from './hooks';
import { RightRail } from './RightRail';
import { SessionList } from './SessionList';

const FALLBACK_AGENTS = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'hermes', label: 'Hermes' },
  { id: 'antigravity', label: 'Antigravity' },
];

export default function AgentsPage({ route, navigate }: ModuleProps) {
  const agentId = route[0] ?? 'claude';
  const sessionId = route[1];

  const { agents, error: agentsError } = useAgents();
  const list = useSessions(agentId);
  const current = useSession(sessionId);
  const [railOpen, setRailOpen] = useState(true);

  const agent = agents.find((a) => a.id === agentId);
  const agentLabel = agent?.label ?? FALLBACK_AGENTS.find((a) => a.id === agentId)?.label ?? agentId;
  const unavailable = agent && !agent.available ? agent.reason ?? 'Not available' : undefined;

  const tabs: TabItem[] = useMemo(
    () =>
      (agents.length ? agents : FALLBACK_AGENTS.map((a) => ({ ...a, available: true }))).map((a) => ({
        id: a.id,
        label: (
          <span className="flex items-center gap-2">
            {a.label}
            {!a.available && <StatusDot status="error" label={`${a.label} unavailable`} />}
          </span>
        ),
      })),
    [agents],
  );

  const runningCount = list.sessions.filter((s) => s.running || s.status === 'running').length;

  const create = useCallback(
    async (cwd: string) => {
      const s = await agentsApi.create(agentId, cwd || undefined);
      list.refresh();
      navigate('agents', agentId, s.id);
    },
    [agentId, list, navigate],
  );

  const remove = useCallback(
    async (id: string) => {
      await agentsApi.remove(id);
      list.refresh();
      if (id === sessionId) navigate('agents', agentId);
    },
    [agentId, list, navigate, sessionId],
  );

  const send = useCallback(
    async (prompt: string) => {
      await current.send(prompt);
      // Name a fresh session after its first prompt so the list stays readable.
      if (current.session?.title === 'New session' && sessionId) {
        await agentsApi.rename(sessionId, prompt.replace(/\s+/g, ' ').slice(0, 60)).catch(() => {});
        list.refresh();
        current.reload();
      }
    },
    [current, list, sessionId],
  );

  const sessionOpen = Boolean(sessionId);

  return (
    <PageFrame
      title="Agents"
      leading={
        <Tabs
          aria-label="Agent"
          tabs={tabs}
          value={agentId}
          onChange={(id) => navigate('agents', id)}
        />
      }
      actions={
        <>
          {runningCount > 0 && (
            <span className="hidden items-center gap-2 text-xs text-os-muted sm:flex" role="status">
              <StatusDot status="live" label="Running" />
              {runningCount} running
            </span>
          )}
          <IconButton
            aria-label={railOpen ? 'Hide session details' : 'Show session details'}
            active={railOpen}
            onClick={() => setRailOpen((v) => !v)}
            className="hidden lg:inline-flex"
          >
            <PanelRight size={16} strokeWidth={1.75} />
          </IconButton>
        </>
      }
    >
      <div className="flex h-full min-h-0">
        <aside
          aria-label="Sessions"
          className={cx('min-h-0 w-full shrink-0 border-r border-os-line bg-os-surface md:block md:w-[264px]', sessionOpen ? 'hidden' : 'block')}
        >
          <SessionList
            agent={agentId}
            sessions={list.sessions}
            loading={list.loading}
            error={list.error ?? agentsError}
            activeId={sessionId}
            disabledReason={unavailable}
            onCreate={create}
            onDelete={remove}
          />
        </aside>

        <section aria-label="Conversation" className={cx('min-h-0 min-w-0 flex-1 flex-col', sessionOpen ? 'flex' : 'hidden md:flex')}>
          {sessionId ? (
            <>
              <a
                href={`#/agents/${agentId}`}
                className="flex h-9 items-center gap-2 border-b border-os-line px-3 text-sm text-os-muted hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] md:hidden"
              >
                <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
                Sessions
              </a>
              <div className="min-h-0 flex-1">
                <Conversation
                  items={current.items}
                  running={current.running}
                  loading={current.loading}
                  error={current.error}
                  sessionKey={sessionId}
                  onSend={send}
                  onStop={current.stop}
                  agentLabel={agentLabel}
                />
              </div>
            </>
          ) : (
            <div className="grid h-full place-items-center p-6">
              <div className="max-w-sm">
                <h2 className="text-base font-semibold text-os-text">{agentLabel}</h2>
                <p className="mt-2 text-sm leading-relaxed text-os-muted">
                  {unavailable
                    ? `This agent cannot start right now: ${unavailable}`
                    : 'Pick a session on the left or create a new one. Each session is a real CLI conversation you can resume later.'}
                </p>
              </div>
            </div>
          )}
        </section>

        {railOpen && current.session && (
          <aside aria-label="Session details" className="hidden min-h-0 w-[288px] shrink-0 overflow-y-auto border-l border-os-line bg-os-surface lg:block">
            <RightRail
              session={current.session}
              actions={current.actions}
              running={current.running}
              onChanged={() => {
                current.reload();
                list.refresh();
              }}
            />
          </aside>
        )}
      </div>
    </PageFrame>
  );
}
