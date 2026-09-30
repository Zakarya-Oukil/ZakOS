import { randomUUID } from 'node:crypto';
import { getAdapter } from './adapters';
import type { AgentEvent } from './adapters/types';
import { createCheckpoint } from './checkpoint';
import path from 'node:path';
import { audit } from '../audit';
import * as store from './store';
import { trustForPath } from '../projects/store';
import { isTrust } from './settings';

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

function emit(broadcast: Broadcast, sessionId: string, event: AgentEvent | { type: 'user'; text: string }) {
  broadcast({ channel: 'agents', sessionId, event });
}

/**
 * Start one agent turn. Resolves once the run has been accepted; the actual
 * streaming continues in the background and is delivered over the WebSocket.
 */
export async function sendMessage(sessionId: string, prompt: string, broadcast: Broadcast): Promise<void> {
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
  audit('prompt', session.agent, prompt, { sessionId, project });
  store.appendMessage(sessionId, 'user', { type: 'user', text: prompt });
  store.setSessionStatus(sessionId, 'running');
  emit(broadcast, sessionId, { type: 'user', text: prompt });
  emit(broadcast, sessionId, { type: 'status', state: 'running' });

  void (async () => {
    let failed = false;
    try {
      for await (const event of adapter.run({
        prompt,
        cwd: session.cwd,
        trust: isTrust(session.trust) ? session.trust : trustForPath(session.cwd),
        cliSessionId,
        resume,
        signal: ctl.signal,
      })) {
        if (event.type === 'error') {
          failed = true;
          audit('error', session.agent, event.message, { sessionId, project });
        }
        if (event.type === 'tool_use') audit('tool', session.agent, `${event.name} ${JSON.stringify(event.input)}`, { sessionId, project });
        if (event.type === 'done' && event.cliSessionId) store.setCliSessionId(sessionId, event.cliSessionId);
        // Text deltas are high-volume; persist them merged when the run ends.
        if (event.type === 'text') {
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
