import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowsLeftRight, SidebarSimple, X } from '@phosphor-icons/react';
import type { ModuleProps } from '../registry';
import { PageFrame } from '../../shell/PageFrame';
import { IconButton, StatusDot, Tabs, type TabItem } from '../../ui';
import { cx } from '../../ui/cx';
import { agentsApi } from './api';
import { projectsApi, type ProjectInfo } from '../../lib/projectsApi';
import { Conversation } from './Conversation';
import { useAgents, useSession, useSessions } from './hooks';
import { RightRail } from './RightRail';
import { SessionList } from './SessionList';

const FALLBACK_AGENTS = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'hermes', label: 'Hermes' },
  { id: 'antigravity', label: 'Antigravity' },
];

type Attachments = Array<{ kind: string; ref: string }>;

/**
 * Routes: `#/agents/<agent>/<session>` for one pane, and
 * `#/agents/<agent>/<session>/beside/<agent>/<session>` for two side by side.
 */
export default function AgentsPage({ route, navigate }: ModuleProps) {
  const agentId = route[0] ?? 'claude';
  const sessionId = route[1];
  const split = route[2] === 'beside' && route[3] && route[4] && route[4] !== sessionId ? { agent: route[3], id: route[4] } : undefined;

  const { agents, error: agentsError } = useAgents();
  const list = useSessions(agentId);
  const current = useSession(sessionId);
  const beside = useSession(split?.id);
  const [railOpen, setRailOpen] = useState(true);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);

  useEffect(() => {
    projectsApi.list().then(setProjects).catch(() => setProjects([]));
  }, []);

  const labelOf = useCallback(
    (id: string) => agents.find((a) => a.id === id)?.label ?? FALLBACK_AGENTS.find((a) => a.id === id)?.label ?? id,
    [agents],
  );
  const agent = agents.find((a) => a.id === agentId);
  const agentLabel = labelOf(agentId);
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

  /** Navigates to a primary session, keeping the second pane unless told otherwise. */
  const go = useCallback(
    (agent: string, id?: string, next?: typeof split | null) => {
      // `null` closes the second pane; leaving it out keeps whatever is open.
      const second = next === undefined ? split : next;
      if (!id) return navigate('agents', agent);
      if (second) navigate('agents', agent, id, 'beside', second.agent, second.id);
      else navigate('agents', agent, id);
    },
    [navigate, split],
  );

  const create = useCallback(
    async (cwd: string, title?: string) => {
      const s = await agentsApi.create(agentId, cwd || undefined, title);
      list.refresh();
      go(agentId, s.id);
    },
    [agentId, list, go],
  );

  const remove = useCallback(
    async (id: string) => {
      await agentsApi.remove(id);
      list.refresh();
      if (id === sessionId) go(agentId);
      else if (id === split?.id) go(agentId, sessionId, null);
    },
    [agentId, list, go, sessionId, split],
  );

  /** One sender for either pane; a fresh session is named after its first prompt so the list stays readable. */
  const senderFor = (pane: ReturnType<typeof useSession>, id: string | undefined) => async (prompt: string, attachments: Attachments = []) => {
    await pane.send(prompt, attachments);
    if (pane.session?.title === 'New session' && id) {
      await agentsApi.rename(id, prompt.replace(/\s+/g, ' ').slice(0, 60)).catch(() => {});
      list.refresh();
      pane.reload();
    }
  };

  const sessionOpen = Boolean(sessionId);

  return (
    <PageFrame
      title="Agents"
      leading={<Tabs aria-label="Agent" tabs={tabs} value={agentId} onChange={(id) => navigate('agents', id)} />}
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
            <SidebarSimple size={16} />
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
            projects={projects}
            onCreate={create}
            onDelete={remove}
            onOpenBeside={sessionId ? (id) => go(agentId, sessionId, { agent: agentId, id }) : undefined}
            besideId={split?.id}
            linkSuffix={split ? `/beside/${split.agent}/${split.id}` : ''}
          />
        </aside>

        <section aria-label="Conversation" className={cx('min-h-0 min-w-0 flex-1 flex-col', sessionOpen ? 'flex' : 'hidden md:flex')}>
          {sessionId ? (
            <>
              <a
                href={`#/agents/${agentId}`}
                className="flex h-9 items-center gap-2 border-b border-os-line px-3 text-sm text-os-muted hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] md:hidden"
              >
                <ArrowLeft size={14} aria-hidden />
                Sessions
              </a>
              {split && (
                <PaneHeader
                  title={current.session?.title ?? 'Session'}
                  agent={agentLabel}
                  running={current.running}
                  className="hidden lg:flex"
                />
              )}
              <div className="min-h-0 flex-1">
                <Conversation
                  items={current.items}
                  running={current.running}
                  loading={current.loading}
                  error={current.error}
                  sessionKey={sessionId}
                  sessionId={sessionId}
                  onSend={senderFor(current, sessionId)}
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

        {split && sessionId && (
          <section aria-label="Second conversation" className="hidden min-h-0 min-w-0 flex-1 flex-col border-l border-os-line lg:flex">
            <PaneHeader
              title={beside.session?.title ?? 'Session'}
              agent={labelOf(split.agent)}
              running={beside.running}
              actions={
                <>
                  <IconButton aria-label="Swap the two sessions" onClick={() => go(split.agent, split.id, { agent: agentId, id: sessionId })}>
                    <ArrowsLeftRight size={14} />
                  </IconButton>
                  <IconButton aria-label="Close the second session" onClick={() => go(agentId, sessionId, null)}>
                    <X size={14} />
                  </IconButton>
                </>
              }
            />
            <div className="min-h-0 flex-1">
              <Conversation
                items={beside.items}
                running={beside.running}
                loading={beside.loading}
                error={beside.error}
                sessionKey={split.id}
                sessionId={split.id}
                onSend={senderFor(beside, split.id)}
                onStop={beside.stop}
                agentLabel={labelOf(split.agent)}
              />
            </div>
          </section>
        )}

        {railOpen && current.session && (
          <aside
            aria-label="Session details"
            className={cx('hidden min-h-0 w-[288px] shrink-0 overflow-y-auto border-l border-os-line bg-os-surface', split ? '2xl:block' : 'lg:block')}
          >
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

function PaneHeader({ title, agent, running, actions, className }: { title: string; agent: string; running: boolean; actions?: ReactNode; className?: string }) {
  return (
    <div className={cx('h-9 shrink-0 items-center gap-2 border-b border-os-line px-3 text-sm', className ?? 'flex')}>
      <StatusDot status={running ? 'live' : 'idle'} label={running ? 'Running' : 'Idle'} />
      <span className="min-w-0 flex-1 truncate text-os-text">{title}</span>
      <span className="shrink-0 text-xs text-os-muted">{agent}</span>
      {actions}
    </div>
  );
}
