import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AgentAdapter, AgentEvent, AgentRunOptions } from './types';
import { spawnLines } from './proc';

const HERMES_BIN =
  process.env.HERMES_BIN || path.join(os.homedir(), 'AppData', 'Local', 'hermes', 'bin', 'hermes.exe');

// Hermes has no structured output: stdout is the answer, and stderr carries `session_id: <id>`.
const SESSION_LINE = /session_id:\s*(\S+)/i;

export const hermesAdapter: AgentAdapter = {
  id: 'hermes',
  label: 'Hermes',

  async detect() {
    // `hermes --version` can take 15s+ when piped (it appears to do an update check), so detection
    // only confirms the binary exists. Runtime failures (auth, billing) surface as error events in run().
    if (!fs.existsSync(HERMES_BIN)) return { available: false, reason: `Not found at ${HERMES_BIN}` };
    return { available: true };
  },

  async *run(opts: AgentRunOptions): AsyncGenerator<AgentEvent> {
    // The prompt goes through a file so it can never be parsed as a flag.
    const queryFile = path.join(os.tmpdir(), `zakos-hermes-${randomUUID()}.txt`);
    fs.writeFileSync(queryFile, opts.prompt, 'utf8');

    const args = ['chat', '--query-file', queryFile, '-Q', '--oneshot'];
    if (opts.resume && opts.cliSessionId) args.push('--resume', opts.cliSessionId);

    const proc = spawnLines(HERMES_BIN, args, { cwd: opts.cwd, signal: opts.signal });
    let sawText = false;

    try {
      for await (const line of proc.lines) {
        sawText = true;
        yield { type: 'text', delta: `${line}\n` };
      }
      const code = await proc.exitCode;
      if (opts.signal.aborted) return;

      const err = proc.stderr();
      if (code !== 0) {
        yield { type: 'error', message: err.trim() || `hermes exited with code ${code}` };
        return;
      }
      if (!sawText) yield { type: 'text', delta: '(no output)' };
      // Hermes assigns its own id on a first run; hand it back so the next turn can resume.
      yield { type: 'done', cliSessionId: SESSION_LINE.exec(err)?.[1] };
    } finally {
      fs.rm(queryFile, { force: true }, () => {});
    }
  },
};
