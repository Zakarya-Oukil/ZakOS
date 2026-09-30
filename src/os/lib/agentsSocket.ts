import { useEffect, useState } from 'react';

export type AgentEvent =
  | { type: 'user'; text: string }
  | { type: 'text'; delta: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; id: string; output: string; isError: boolean }
  | { type: 'status'; state: string }
  | { type: 'permission_denied'; denials: Array<{ tool: string; input: Record<string, unknown> }> }
  | { type: 'done'; cliSessionId?: string }
  | { type: 'error'; message: string };

export interface AgentSocketMessage {
  channel: 'agents';
  sessionId: string;
  event: AgentEvent;
}

type Listener = (msg: AgentSocketMessage) => void;
type WorkflowListener = (runId: string) => void;
type NotificationListener = (n: unknown) => void;
type StateListener = (connected: boolean) => void;
type ApprovalListener = () => void;

/** One shared WebSocket to the server (proxied at /ws), with backoff reconnect. */
class AgentsSocket {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private workflowListeners = new Set<WorkflowListener>();
  private notificationListeners = new Set<NotificationListener>();
  private stateListeners = new Set<StateListener>();
  private approvalListeners = new Set<ApprovalListener>();
  private retry = 0;
  private timer: number | undefined;
  connected = false;

  private open() {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${window.location.host}/ws`);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.setConnected(true);
    };
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data?.channel === 'agents') this.listeners.forEach((l) => l(data as AgentSocketMessage));
        else if (data?.channel === 'notifications') this.notificationListeners.forEach((l) => l(data.notification));
        else if (data?.channel === 'approvals') this.approvalListeners.forEach((l) => l());
        else if (data?.channel === 'workflows') this.workflowListeners.forEach((l) => l(String(data.runId)));
      } catch {
        /* ignore non-JSON frames */
      }
    };
    ws.onclose = () => {
      this.setConnected(false);
      this.ws = null;
      if (this.listeners.size === 0 && this.stateListeners.size === 0 && this.workflowListeners.size === 0 && this.notificationListeners.size === 0 && this.approvalListeners.size === 0) return;
      const delay = Math.min(10_000, 500 * 2 ** this.retry++);
      this.timer = window.setTimeout(() => this.open(), delay);
    };
    ws.onerror = () => ws.close();
  }

  private setConnected(v: boolean) {
    this.connected = v;
    this.stateListeners.forEach((l) => l(v));
  }

  private ensure() {
    if (!this.ws) this.open();
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    this.ensure();
    return () => {
      this.listeners.delete(l);
    };
  }

  subscribeWorkflows(l: WorkflowListener): () => void {
    this.workflowListeners.add(l);
    this.ensure();
    return () => {
      this.workflowListeners.delete(l);
    };
  }

  subscribeNotifications(l: NotificationListener): () => void {
    this.notificationListeners.add(l);
    this.ensure();
    return () => {
      this.notificationListeners.delete(l);
    };
  }

  subscribeApprovals(l: ApprovalListener): () => void {
    this.approvalListeners.add(l);
    this.ensure();
    return () => {
      this.approvalListeners.delete(l);
    };
  }

  onState(l: StateListener): () => void {
    this.stateListeners.add(l);
    this.ensure();
    return () => {
      this.stateListeners.delete(l);
    };
  }
}

export const agentsSocket = new AgentsSocket();

export function useAgentsConnection(): boolean {
  const [connected, setConnected] = useState(agentsSocket.connected);
  useEffect(() => agentsSocket.onState(setConnected), []);
  return connected;
}
