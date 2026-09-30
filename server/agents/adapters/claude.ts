import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { AgentAdapter, AgentEvent, AgentRunOptions } from './types';
import { spawnLines } from './proc';
import type { Trust } from '../settings';

const execFileAsync = promisify(execFile);

/** Maps a trust level onto Claude Code's own permission modes. */
const MODE: Record<Trust, string> = {
  'read-only': 'plan',
  default: 'default',
  acceptEdits: 'acceptEdits',
  full: 'bypassPermissions',
};

function stringifyResult(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => (c && typeof c === 'object' && 'text' in c ? String((c as { text: unknown }).text) : ''))
      .join('');
  }
  return content == null ? '' : JSON.stringify(content);
}

/** Map one stream-json line from the Claude CLI to zero or more normalized events. */
function* mapLine(raw: string, seenTools: Set<string>): Generator<AgentEvent> {
  let msg: any;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }

  switch (msg.type) {
    case 'stream_event': {
      const delta = msg.event?.type === 'content_block_delta' ? msg.event.delta : null;
      if (delta?.type === 'text_delta' && delta.text) yield { type: 'text', delta: delta.text };
      break;
    }
    case 'assistant': {
      // Text already arrived through stream_event deltas; only tool calls are new here.
      for (const block of msg.message?.content ?? []) {
        if (block.type === 'tool_use' && !seenTools.has(block.id)) {
          seenTools.add(block.id);
          yield { type: 'tool_use', id: block.id, name: block.name, input: block.input };
        }
      }
      break;
    }
    case 'user': {
      for (const block of msg.message?.content ?? []) {
        if (block.type === 'tool_result') {
          yield {
            type: 'tool_result',
            id: block.tool_use_id,
            output: stringifyResult(block.content),
            isError: Boolean(block.is_error),
          };
        }
      }
      break;
    }
    case 'result': {
      if (msg.is_error) {
        yield { type: 'error', message: stringifyResult(msg.result) || `Run failed (${msg.subtype ?? 'error'})` };
      }
      yield { type: 'done', cliSessionId: msg.session_id };
      break;
    }
  }
}

export const claudeAdapter: AgentAdapter = {
  id: 'claude',
  label: 'Claude Code',

  async detect() {
    try {
      const { stdout } = await execFileAsync('claude', ['--version'], { windowsHide: true, timeout: 8000 });
      return { available: true, version: stdout.trim() };
    } catch (err) {
      return { available: false, reason: err instanceof Error ? err.message : String(err) };
    }
  },

  async *run(opts: AgentRunOptions): AsyncGenerator<AgentEvent> {
    const args = [
      '-p',
      '--output-format', 'stream-json',
      '--input-format', 'text',
      '--verbose',
      '--include-partial-messages',
      '--permission-mode', MODE[opts.trust],
    ];
    if (opts.cliSessionId) args.push(opts.resume ? '--resume' : '--session-id', opts.cliSessionId);

    // Prompt goes over stdin so it can never be parsed as a flag.
    const proc = spawnLines('claude', args, { cwd: opts.cwd, signal: opts.signal, stdin: opts.prompt });
    const seenTools = new Set<string>();
    let sawDone = false;

    for await (const line of proc.lines) {
      for (const event of mapLine(line, seenTools)) {
        if (event.type === 'done') sawDone = true;
        yield event;
      }
    }

    const code = await proc.exitCode;
    if (opts.signal.aborted) return;
    if (!sawDone) {
      yield { type: 'error', message: proc.stderr().trim() || `claude exited with code ${code}` };
    }
  },
};
