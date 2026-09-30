import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface Notification {
  id: string;
  title: string;
  body: string;
  ts: number;
  read: boolean;
  /** Where the UI should take the owner, e.g. a workflow run. */
  link?: { module: string; route: string[] };
}

const FILE = path.resolve(process.cwd(), 'data', 'notifications.json');
const KEEP = 100;

function read(): Notification[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list: Notification[]) {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(list.slice(0, KEEP), null, 2));
  } catch (err) {
    console.error('[notifications] could not save:', err instanceof Error ? err.message : err);
  }
}

export const listNotifications = (): Notification[] => read();

export function markAllRead() {
  write(read().map((n) => ({ ...n, read: true })));
}

// A Windows toast needs no installed module: the WinRT API is reachable from PowerShell directly.
// Title and body travel as script arguments, never inside the script text.
const TOAST_SCRIPT = `
param([string]$Title, [string]$Body)
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
$xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
$text = $xml.GetElementsByTagName('text')
$text.Item(0).AppendChild($xml.CreateTextNode($Title)) | Out-Null
$text.Item(1).AppendChild($xml.CreateTextNode($Body)) | Out-Null
$app = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe'
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($app).Show([Windows.UI.Notifications.ToastNotification]::new($xml))
`;
const toastFile = path.join(os.tmpdir(), 'zakos-toast.ps1');

function nativeToast(title: string, body: string) {
  if (process.platform !== 'win32') return;
  try {
    fs.writeFileSync(toastFile, TOAST_SCRIPT);
    const child = spawn('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', toastFile, title, body], {
      windowsHide: true,
      stdio: 'ignore',
    });
    child.on('error', () => {});
    child.unref();
  } catch {
    /* a missing toast must never break a run */
  }
}

export function notify(
  title: string,
  body: string,
  broadcast: (data: unknown) => void,
  link?: Notification['link'],
  opts: { native?: boolean } = {},
): Notification {
  const n: Notification = { id: randomUUID(), title: title.slice(0, 120), body: body.slice(0, 300), ts: Date.now(), read: false, link };
  write([n, ...read()]);
  broadcast({ channel: 'notifications', notification: n });
  if (opts.native !== false) nativeToast(n.title, n.body);
  return n;
}
