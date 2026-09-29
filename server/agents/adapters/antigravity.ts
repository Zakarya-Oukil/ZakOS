import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { AgentAdapter, AgentEvent, AgentRunOptions } from './types';
import { spawnLines } from './proc';

const execFileAsync = promisify(execFile);

const BIN = process.env.AGY_BIN || 'agy';

/**
 * Antigravity's own default mode asks for review on every action, so `default` passes no flag.
 * `acceptEdits` auto-approves file edits only. There is deliberately no bypass mode.
 */
function modeArgs(): string[] {
  return process.env.AGENT_PERMISSION_MODE === 'default' ? [] : ['--mode', 'accept-edits'];
}

/** Map one NDJSON line from `agy --output-format stream-json` to normalized events. */
function* mapLine(raw: string, state: { conversationId?: string }): Generator<AgentEvent> {
  let msg: any;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }

  if (msg.event === 'init') {
    state.conversationId = msg.init?.conversation_id ?? state.conversationId;
    return;
  }

  if (msg.event === 'step_update') {
    const s = msg.step_update ?? {};
    state.conversationId = s.conversation_id ?? state.conversationId;

    if (s.step_type === 'agent_response' && typeof s.text_delta === 'string' && s.text_delta) {
      yield { type: 'text', delta: s.text_delta };
      return;
    }

    if (s.step_type === 'tool') {
      const id = `${s.conversation_id}:${s.step_index}`;
      const info = s.tool_info ?? {};
      if (s.state === 'ACTIVE') {
        yield { type: 'tool_use', id, name: s.tool_name ?? info.name ?? 'tool', input: info.parameters ?? {} };
      } else if (s.state === 'DONE') {
        yield { type: 'tool_result', id, output: String(info.output ?? ''), isError: false };
      } else if (s.state === 'ERROR' || s.state === 'FAILED') {
        yield { type: 'tool_result', id, output: String(info.output ?? info.error ?? 'Tool failed'), isError: true };
      }
    }
    return;
  }

  if (msg.event === 'result') {
    const r = msg.result ?? {};
    state.conversationId = r.conversation_id ?? state.conversationId;
    if (r.status && r.status !== 'SUCCESS') {
      yield { type: 'error', message: String(r.response || r.error || `Run ended with status ${r.status}`) };
    }
    yield { type: 'done', cliSessionId: state.conversationId };
  }
}

export const antigravityAdapter: AgentAdapter = {
  id: 'antigravity',
  label: 'Antigravity',

  async detect() {
    try {
      const { stdout } = await execFileAsync(BIN, ['--version'], { windowsHide: true, timeout: 10_000 });
      return { available: true, version: `agy ${stdout.trim()}` };
    } catch (err) {
      return { available: false, reason: err instanceof Error ? err.message : String(err) };
    }
  },

  async *run(opts: AgentRunOptions): AsyncGenerator<AgentEvent> {
    // `--print=<prompt>` keeps a prompt that starts with a dash from being read as a flag.
    const args = [`--print=${opts.prompt}`, '--output-format', 'stream-json', ...modeArgs()];
    if (opts.resume && opts.cliSessionId) args.push('--conversation', opts.cliSessionId);

    const proc = spawnLines(BIN, args, { cwd: opts.cwd, signal: opts.signal });
    const state: { conversationId?: string } = {};
    let sawDone = false;

    for await (const line of proc.lines) {
      for (const event of mapLine(line, state)) {
        if (event.type === 'done') sawDone = true;
        yield event;
      }
    }

    const code = await proc.exitCode;
    if (opts.signal.aborted) return;
    if (!sawDone) yield { type: 'error', message: proc.stderr().trim() || `agy exited with code ${code}` };
  },
};
