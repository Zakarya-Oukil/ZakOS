import { spawn, execFile, type ChildProcess } from 'node:child_process';

/** Kill a child and everything it started (Windows needs taskkill /T). */
export function killTree(child: ChildProcess): void {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, () => {});
  } else {
    child.kill('SIGTERM');
  }
}

export interface SpawnedLines {
  lines: AsyncGenerator<string>;
  stderr: () => string;
  exitCode: Promise<number | null>;
}

/**
 * Spawn a command and expose stdout as an async stream of lines.
 * The abort signal terminates the whole process tree.
 */
export function spawnLines(
  command: string,
  args: string[],
  opts: { cwd: string; signal: AbortSignal; stdin?: string }
): SpawnedLines {
  const child = spawn(command, args, {
    cwd: opts.cwd,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const onAbort = () => killTree(child);
  if (opts.signal.aborted) onAbort();
  else opts.signal.addEventListener('abort', onAbort, { once: true });

  let errText = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (d: string) => {
    errText = (errText + d).slice(-8000);
  });

  child.stdin.on('error', () => {});
  child.stdin.end(opts.stdin ?? '');

  const exitCode = new Promise<number | null>((resolve) => {
    child.on('error', (err) => {
      errText += `\n${err.message}`;
      resolve(null);
    });
    child.on('close', (code) => resolve(code));
  });

  async function* readLines(): AsyncGenerator<string> {
    child.stdout.setEncoding('utf8');
    let buf = '';
    try {
      for await (const chunk of child.stdout) {
        buf += chunk as string;
        let idx: number;
        while ((idx = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, idx).replace(/\r$/, '');
          buf = buf.slice(idx + 1);
          if (line) yield line;
        }
      }
      if (buf.trim()) yield buf.trim();
    } finally {
      opts.signal.removeEventListener('abort', onAbort);
      if (child.exitCode === null) killTree(child);
    }
  }

  return { lines: readLines(), stderr: () => errText, exitCode };
}
