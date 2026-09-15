import { WebSocket } from 'ws';
import { Client, ConnectConfig } from 'ssh2';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import os from 'os';

export interface SshConnectPayload {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  privateKey?: string;
  useLocalFallback?: boolean;
}

export function handleSshWebSocketConnection(ws: WebSocket) {
  let sshClient: Client | null = null;
  let localProcess: ChildProcessWithoutNullStreams | null = null;
  let isConnected = false;

  // Handle incoming messages from frontend xterm
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      // 1. Initialize Connection
      if (msg.type === 'ssh:connect') {
        const payload: SshConnectPayload = msg.payload || {};
        
        // If local shell requested or no host specified, spawn host shell (PowerShell/Bash)
        if (payload.useLocalFallback || !payload.host) {
          spawnLocalShell(msg.cols || 80, msg.rows || 24);
          return;
        }

        // Otherwise initiate real SSH2 connection
        connectSsh(payload, msg.cols || 80, msg.rows || 24);
        return;
      }

      // 2. User typed keystrokes
      if (msg.type === 'ssh:input') {
        if (localProcess && localProcess.stdin.writable) {
          localProcess.stdin.write(msg.data);
        }
        return;
      }

      // 3. Terminal resize (Cols/Rows)
      if (msg.type === 'ssh:resize') {
        // Handled dynamically
        return;
      }

      // 4. Manual disconnect
      if (msg.type === 'ssh:disconnect') {
        cleanup();
      }
    } catch (e: any) {
      console.error('[SSH Bridge] Parse error:', e);
    }
  });

  ws.on('close', () => {
    cleanup();
  });

  ws.on('error', (err) => {
    console.error('[SSH Bridge] WebSocket error:', err);
    cleanup();
  });

  function cleanup() {
    isConnected = false;
    if (sshClient) {
      try { sshClient.end(); } catch (e) {}
      sshClient = null;
    }
    if (localProcess) {
      try { localProcess.kill(); } catch (e) {}
      localProcess = null;
    }
  }

  // Real SSH2 client connection
  function connectSsh(payload: SshConnectPayload, cols: number, rows: number) {
    cleanup();
    sshClient = new Client();

    const config: ConnectConfig = {
      host: payload.host || '127.0.0.1',
      port: payload.port || 22,
      username: payload.username || 'root',
      readyTimeout: 8000,
    };

    if (payload.password) {
      config.password = payload.password;
    }
    if (payload.privateKey) {
      config.privateKey = payload.privateKey;
    }

    sshClient.on('ready', () => {
      isConnected = true;
      ws.send(JSON.stringify({
        type: 'ssh:status',
        status: 'CONNECTED',
        message: `SSH connection established to ${config.host}:${config.port}`
      }));

      sshClient!.shell({ term: 'xterm-256color', cols, rows }, (err, stream) => {
        if (err) {
          ws.send(JSON.stringify({ type: 'ssh:error', error: `Shell failed: ${err.message}` }));
          return;
        }

        // Pipe remote output to frontend
        stream.on('data', (data: Buffer) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ssh:data', data: data.toString('utf-8') }));
          }
        });

        stream.on('close', () => {
          ws.send(JSON.stringify({ type: 'ssh:status', status: 'DISCONNECTED', message: 'SSH session closed by remote' }));
          cleanup();
        });

        // Forward stdin
        ws.on('message', (raw) => {
          try {
            const m = JSON.parse(raw.toString());
            if (m.type === 'ssh:input' && stream.writable) {
              stream.write(m.data);
            } else if (m.type === 'ssh:resize') {
              stream.setWindow(m.rows || 24, m.cols || 80, 0, 0);
            }
          } catch (e) {}
        });
      });
    });

    sshClient.on('error', (err) => {
      console.warn(`[SSH Bridge] SSH connect failed (${err.message}). Offering fallback to Local Terminal.`);
      ws.send(JSON.stringify({
        type: 'ssh:error',
        error: `Could not connect to ${config.host}:${config.port} (${err.message}).`,
        canFallback: true
      }));
    });

    try {
      sshClient.connect(config);
    } catch (err: any) {
      ws.send(JSON.stringify({ type: 'ssh:error', error: err.message }));
    }
  }

  // Local shell execution (PowerShell on Windows, Bash on Linux/macOS)
  function spawnLocalShell(cols: number, rows: number) {
    cleanup();
    const isWindows = os.platform() === 'win32';
    const shellCmd = isWindows ? 'powershell.exe' : 'bash';
    const shellArgs = isWindows ? ['-NoLogo'] : [];

    try {
      localProcess = spawn(shellCmd, shellArgs, {
        env: { ...process.env, TERM: 'xterm-256color' },
      });

      isConnected = true;
      ws.send(JSON.stringify({
        type: 'ssh:status',
        status: 'CONNECTED',
        message: `Interactive shell spawned (${shellCmd})`
      }));

      // Banner
      const banner = `\r\n\x1b[38;5;214m[ZakOS Workbench]\x1b[0m Interactive Terminal Online (${shellCmd})\r\n\r\n`;
      ws.send(JSON.stringify({ type: 'ssh:data', data: banner }));

      localProcess.stdout.on('data', (chunk: Buffer) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ssh:data', data: chunk.toString('utf-8') }));
        }
      });

      localProcess.stderr.on('data', (chunk: Buffer) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ssh:data', data: chunk.toString('utf-8') }));
        }
      });

      localProcess.on('close', (code) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ssh:status', status: 'DISCONNECTED', message: `Process exited with code ${code}` }));
        }
        cleanup();
      });
    } catch (err: any) {
      ws.send(JSON.stringify({ type: 'ssh:error', error: `Failed to spawn local shell: ${err.message}` }));
    }
  }
}
