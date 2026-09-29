import { useCallback, useEffect, useRef, useState } from 'react';
import { agentsSocket } from '../../lib/agentsSocket';
import { agentsApi, type ActionInfo, type AgentInfo, type SessionInfo } from './api';
import { applyEvent, buildItems, type Item } from './items';

export function useAgents() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    agentsApi
      .agents()
      .then((a) => {
        setAgents(a);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(refresh, [refresh]);
  return { agents, error, refresh };
}

export function useSessions(agent: string | undefined) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!agent) return;
    agentsApi
      .sessions(agent)
      .then((s) => {
        setSessions(s);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [agent]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  // Any run starting or finishing changes the list (status, ordering, auto-title).
  useEffect(
    () =>
      agentsSocket.subscribe((m) => {
        if (m.event.type === 'status') refresh();
      }),
    [refresh],
  );

  return { sessions, loading, error, refresh };
}

export function useSession(sessionId: string | undefined) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actions, setActions] = useState<ActionInfo[]>([]);
  const activeId = useRef<string | undefined>(sessionId);
  activeId.current = sessionId;

  const load = useCallback(async (id: string) => {
    try {
      const [{ session: s, messages }, acts] = await Promise.all([agentsApi.get(id), agentsApi.actions(id)]);
      if (activeId.current !== id) return;
      setSession(s);
      setItems(buildItems(messages.map((m) => m.event)));
      setRunning(Boolean(s.running));
      setActions(acts);
      setError(null);
    } catch (e) {
      if (activeId.current === id) setError((e as Error).message);
    } finally {
      if (activeId.current === id) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setItems([]);
    setSession(null);
    setActions([]);
    setError(null);
    setRunning(false);
    if (!sessionId) return;
    setLoading(true);
    void load(sessionId);
  }, [sessionId, load]);

  useEffect(() => {
    if (!sessionId) return;
    return agentsSocket.subscribe((m) => {
      if (m.sessionId !== sessionId) return;
      const ev = m.event;
      if (ev.type === 'status') {
        const isRunning = ev.state === 'running';
        setRunning(isRunning);
        // The server copy is authoritative once a run ends (merged text, checkpoints, title).
        if (!isRunning) void load(sessionId);
        return;
      }
      setItems((prev) => applyEvent(prev, ev));
    });
  }, [sessionId, load]);

  const send = useCallback(
    async (prompt: string) => {
      if (!sessionId) return;
      await agentsApi.send(sessionId, prompt);
    },
    [sessionId],
  );

  const stop = useCallback(async () => {
    if (sessionId) await agentsApi.stop(sessionId);
  }, [sessionId]);

  const reload = useCallback(() => {
    if (sessionId) void load(sessionId);
  }, [sessionId, load]);

  return { session, items, running, loading, error, actions, send, stop, reload };
}
