import { randomUUID } from 'node:crypto';
import { getAdapter } from './adapters';
import type { AgentEvent } from './adapters/types';
import { createCheckpoint } from './checkpoint';
import path from 'node:path';
import { audit } from '../audit';
import * as store from './store';
import { trustForPath } from '../projects/store';
import { isTrust } from './settings';
import { addApprovals } from './approvals';
import { recordUsage, recordWindows } from './usage';
import { capture, getBrainSettings } from '../brain/capture';
import { notify } from '../notifications';

export type Broadcast = (data: unknown) => void;

export class SessionBusyError extends Error {}

const active = new Map<string, AbortController>();

export function isRunning(sessionId: string): boolean {
  return active.has(sessionId);
}

export function stop(sessionId: string): boolean {
  const ctl = active.get(sessionId);
  if (!ctl) return false;
  ctl.abort();
  return true;
}

function emit(broadcast: Broadcast, sessionId: string, event: AgentEvent | { type: 'user'; text: string; attachments?: unknown[] }) {
  broadcast({ channel: 'agents', sessionId, event });
}

/**
 * Start one agent turn. Resolves once the run has been accepted; the actual
 * streaming continues in the background and is delivered over the WebSocket.
 */
export async function sendMessage(sessionId: string, prompt: string, broadcast: Broadcast, grant: { allowedTools?: string[] } = {}, extra: { agentPrompt?: string; attachments?: Array<{ kind: string; label: string; truncated: boolean }> } = {}): Promise<void> {
  const session = store.getSession(sessionId);
  if (!session) throw new Error('Session not found');
  if (active.has(sessionId)) throw new SessionBusyError('Session already has a run in progress');

  const adapter = getAdapter(session.agent);
  if (!adapter) throw new Error(`Unknown agent: ${session.agent}`);

  const ctl = new AbortController();
  active.set(sessionId, ctl);

  const resume = session.cli_session_id !== null;
  // Claude accepts a caller-chosen id; other CLIs (Hermes) assign one and report it on `done`.
  const cliSessionId = session.cli_session_id ?? (session.agent === 'claude' ? randomUUID() : undefined);
  if (!resume && cliSessionId) store.setCliSessionId(sessionId, cliSessionId);

  const checkpoint = await createCheckpoint(session.cwd);
  store.logAction(sessionId, 'prompt', prompt.slice(0, 500), checkpoint);
  const project = path.basename(session.cwd);
  audit('prompt', session.agent, extra.attachments?.length ? `${prompt} [+${extra.attachments.length} attached: ${extra.attachments.map((a) => a.label).join(', ')}]` : prompt, { sessionId, project });
  const userEvent = { type: 'user' as const, text: prompt, ...(extra.attachments?.length ? { attachments: extra.attachments } : {}) };
  store.appendMessage(sessionId, 'user', userEvent);
  store.setSessionStatus(sessionId, 'running');
  emit(broadcast, sessionId, userEvent);
  emit(broadcast, sessionId, { type: 'status', state: 'running' });

  void (async () => {
    let failed = false;
    let answer = '';
    try {
      for await (const event of adapter.run({
        prompt: extra.agentPrompt ?? prompt,
        cwd: session.cwd,
        trust: isTrust(session.trust) ? session.trust : trustForPath(session.cwd),
        cliSessionId,
        resume,
        allowedTools: grant.allowedTools,
        signal: ctl.signal,
      })) {
        // Accounting events feed the usage tracker and never appear in the conversation.
        if (event.type === 'usage') {
          recordUsage(session.agent, sessionId, event.usage);
          continue;
        }
        if (event.type === 'rate_limit') {
          recordWindows(session.agent, event.windows);
          continue;
        }
        if (event.type === 'error') {
          failed = true;
          audit('error', session.agent, event.message, { sessionId, project });
        }
        if (event.type === 'tool_use') audit('tool', session.agent, `${event.name} ${JSON.stringify(event.input)}`, { sessionId, project });
        if (event.type === 'permission_denied') {
          const added = addApprovals(sessionId, session.cwd, event.denials);
          if (added.length) {
            audit('permission-denied', session.agent, added.map((a) => a.summary).join('; '), { sessionId, project });
            broadcast({ channel: 'approvals' });
            notify(`Approval needed: ${project}`, added[0].summary, broadcast, { module: 'approvals', route: [] }, { native: false });
          }
        }
        if (event.type === 'done' && event.cliSessionId) store.setCliSessionId(sessionId, event.cliSessionId);
        // Text deltas are high-volume; persist them merged when the run ends.
        if (event.type === 'text') {
          answer += event.delta;
          bufferText(sessionId, event.delta);
        } else {
          flushText(sessionId); // keep persisted order: buffered text first, then this event
          store.appendMessage(sessionId, 'agent', event);
        }
        emit(broadcast, sessionId, event);
      }
    } catch (err) {
      failed = true;
      flushText(sessionId);
      const message = ctl.signal.aborted ? 'Stopped' : err instanceof Error ? err.message : String(err);
      const event: AgentEvent = { type: 'error', message };
      store.appendMessage(sessionId, 'agent', event);
      emit(broadcast, sessionId, event);
    } finally {
      flushText(sessionId);
      active.delete(sessionId);
      // Auto-capture: interactive sessions only (workflow workers have a fixed trust and would flood the vault).
      if (!failed && !ctl.signal.aborted && session.trust === null && answer.trim() && getBrainSettings().autoCapture) {
        capture({ agent: session.agent, project, title: session.title, prompt, answer, ts: Date.now() }).catch((err) => console.error('[brain] capture failed:', err instanceof Error ? err.message : err));
      }
      const status = failed && !ctl.signal.aborted ? 'error' : 'idle';
      store.setSessionStatus(sessionId, status);
      emit(broadcast, sessionId, { type: 'status', state: status });
    }
  })();
}

const textBuffers = new Map<string, string>();

function bufferText(sessionId: string, delta: string) {
  textBuffers.set(sessionId, (textBuffers.get(sessionId) ?? '') + delta);
}

function flushText(sessionId: string) {
  const text = textBuffers.get(sessionId);
  if (!text) return;
  textBuffers.delete(sessionId);
  store.appendMessage(sessionId, 'agent', { type: 'text', delta: text });
}
