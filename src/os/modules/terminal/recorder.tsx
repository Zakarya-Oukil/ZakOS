import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { DownloadSimple, Play, Record, Stop, X } from '@phosphor-icons/react';
import { Button, IconButton } from '../../ui';

/**
 * Terminal recording: output chunks with their timestamps, kept in memory while recording and replayable in a small
 * terminal. Only what the shell printed is stored, never what was typed, so a password typed at a hidden prompt is not captured.
 */
export interface Recording {
  title: string;
  startedAt: number;
  events: Array<{ t: number; d: string }>;
}

const live = new Map<string, Recording>();
const last = new Map<string, Recording>();
const listeners = new Set<() => void>();
const MAX_BYTES = 4_000_000;

export function feedRecording(sessionId: string, data: string) {
  const r = live.get(sessionId);
  if (!r) return;
  const size = r.events.reduce((n, e) => n + e.d.length, 0);
  if (size + data.length > MAX_BYTES) {
    stopRecording(sessionId);
    return;
  }
  r.events.push({ t: Date.now() - r.startedAt, d: data });
}

export function startRecording(sessionId: string, title: string) {
  live.set(sessionId, { title, startedAt: Date.now(), events: [] });
  listeners.forEach((l) => l());
}

export function stopRecording(sessionId: string) {
  const r = live.get(sessionId);
  if (r) {
    live.delete(sessionId);
    last.set(sessionId, r);
  }
  listeners.forEach((l) => l());
}

export const isRecording = (sessionId: string) => live.has(sessionId);
export const lastRecording = (sessionId: string) => last.get(sessionId);

function useTick() {
  const [, set] = useState(0);
  useEffect(() => {
    const l = () => set((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
}

function Replay({ rec, onClose }: { rec: Recording; onClose: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [speed, setSpeed] = useState(1);
  const [run, setRun] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const term = new Terminal({ fontFamily: 'Geist Mono, Consolas, monospace', fontSize: 13, disableStdin: true, cursorBlink: false, convertEol: false, theme: { background: getComputedStyle(document.documentElement).getPropertyValue('--os-bg').trim() || '#0a1513', foreground: getComputedStyle(document.documentElement).getPropertyValue('--os-text').trim() || '#e8efe9' } });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(el);
    try {
      fit.fit();
    } catch {
      /* hidden */
    }
    setDone(false);
    const timers: number[] = [];
    rec.events.forEach((e) => timers.push(window.setTimeout(() => term.write(e.d), e.t / speed)));
    const end = (rec.events[rec.events.length - 1]?.t ?? 0) / speed + 200;
    timers.push(window.setTimeout(() => setDone(true), end));
    return () => {
      timers.forEach(clearTimeout);
      term.dispose();
    };
  }, [rec, speed, run]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Replay" className="absolute inset-0 z-30 flex flex-col bg-os-bg">
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-os-line px-4">
        <p className="min-w-0 truncate text-[15px] font-semibold text-os-text">Replay: {rec.title}</p>
        <div className="flex items-center gap-2">
          {[1, 2, 4].map((s) => (
            <button key={s} type="button" aria-pressed={speed === s} onClick={() => setSpeed(s)} className={'h-8 rounded-full px-3 text-xs font-medium focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] ' + (speed === s ? 'bg-os-cyan text-os-on-accent' : 'text-os-muted hover:text-os-text')}>
              {s}x
            </button>
          ))}
          <Button size="sm" onClick={() => setRun((n) => n + 1)}><Play size={14} aria-hidden /> {done ? 'Again' : 'Restart'}</Button>
          <IconButton aria-label="Close the replay" onClick={onClose}><X size={16} /></IconButton>
        </div>
      </header>
      <div ref={host} className="min-h-0 flex-1 p-3" />
    </div>
  );
}

/** Record, stop, replay and save for one terminal. */
export function RecorderControls({ sessionId, title }: { sessionId: string; title: string }) {
  useTick();
  const [replaying, setReplaying] = useState(false);
  const rec = lastRecording(sessionId);
  const recording = isRecording(sessionId);

  const save = () => {
    if (!rec) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(rec)], { type: 'application/json' }));
    a.download = `terminal-${new Date(rec.startedAt).toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <button
        type="button"
        aria-pressed={recording}
        onClick={() => (recording ? stopRecording(sessionId) : startRecording(sessionId, title))}
        title={recording ? 'Stop recording' : 'Record what this terminal prints'}
        className={'inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] ' + (recording ? 'bg-os-cyan text-os-on-accent' : 'text-os-muted hover:bg-os-surface-2 hover:text-os-text')}
      >
        {recording ? <Stop size={13} aria-hidden /> : <Record size={13} aria-hidden />}
        {recording ? 'Stop' : 'Record'}
      </button>
      {rec && !recording && (
        <>
          <button type="button" onClick={() => setReplaying(true)} className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs text-os-muted hover:bg-os-surface-2 hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]">
            <Play size={13} aria-hidden /> Replay
          </button>
          <button type="button" aria-label="Save the recording" onClick={save} className="inline-flex h-7 w-7 items-center justify-center rounded-full text-os-muted hover:bg-os-surface-2 hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]">
            <DownloadSimple size={14} aria-hidden />
          </button>
        </>
      )}
      {replaying && rec && <Replay rec={rec} onClose={() => setReplaying(false)} />}
    </>
  );
}
