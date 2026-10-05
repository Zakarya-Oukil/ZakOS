import { useEffect, useState, useSyncExternalStore } from 'react';
import { agentsSocket, type AgentEvent } from '../../lib/agentsSocket';
import { prefersReducedMotion } from '../../theme/motion';
import { useAppearance } from '../../theme/appearance';

/**
 * What the orb shows, taken from the same agent events the Agents page streams.
 * idle: nothing is running. thinking: a session is running but no tool call is open.
 * running: at least one tool call is open. error: a run failed or a permission was refused.
 */
export type OrbState = 'idle' | 'thinking' | 'running' | 'error';

interface Snapshot {
  state: OrbState;
  /** Tool calls finished over tool calls started in the current turn, 0 to 1. */
  progress: number;
}

interface Session {
  running: boolean;
  open: Set<string>;
  started: number;
  done: number;
  failed: boolean;
}

const sessions = new Map<string, Session>();
const listeners = new Set<() => void>();
let snap: Snapshot = { state: 'idle', progress: 0 };
let unsubscribe: (() => void) | null = null;
let errorTimer: number | undefined;

function get(id: string): Session {
  let s = sessions.get(id);
  if (!s) {
    s = { running: false, open: new Set(), started: 0, done: 0, failed: false };
    sessions.set(id, s);
  }
  return s;
}

function recompute() {
  let state: OrbState = 'idle';
  let started = 0;
  let done = 0;
  for (const s of sessions.values()) {
    started += s.started;
    done += s.done;
    if (s.failed) state = 'error';
    else if (state !== 'error' && s.open.size > 0) state = 'running';
    else if (state === 'idle' && s.running) state = 'thinking';
  }
  const progress = started === 0 ? 0 : Math.min(1, done / started);
  if (snap.state !== state || Math.abs(snap.progress - progress) > 0.001) {
    snap = { state, progress };
    listeners.forEach((l) => l());
  }
}

function onEvent({ sessionId, event }: { sessionId: string; event: AgentEvent }) {
  const s = get(sessionId);
  switch (event.type) {
    case 'status':
      if (event.state === 'running') {
        if (!s.running) {
          s.started = 0;
          s.done = 0;
        }
        s.running = true;
        s.failed = false;
      } else {
        s.running = false;
        s.open.clear();
      }
      break;
    case 'tool_use':
      s.running = true;
      s.open.add(event.id);
      s.started += 1;
      break;
    case 'tool_result':
      s.open.delete(event.id);
      s.done += 1;
      if (event.isError) flagFailure(s);
      break;
    case 'permission_denied':
    case 'error':
      flagFailure(s);
      s.running = false;
      s.open.clear();
      break;
    case 'done':
      s.running = false;
      s.open.clear();
      break;
    default:
      break;
  }
  recompute();
}

/** A failure shows for a while and then clears; the approvals count keeps the "needs you" state after that. */
function flagFailure(s: Session) {
  s.failed = true;
  window.clearTimeout(errorTimer);
  errorTimer = window.setTimeout(() => {
    sessions.forEach((x) => (x.failed = false));
    recompute();
  }, 12_000);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!unsubscribe) unsubscribe = agentsSocket.subscribe(onEvent);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };
}

const getSnapshot = () => snap;

/** The live orb state. `pending` is the number of approvals waiting for the owner, which also means "needs you". */
export function useOrbState(pending = 0): Snapshot {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (pending > 0) return { state: 'error', progress: s.progress };
  return s;
}

const FLAT_KEY = 'zakos_orb_flat';

/**
 * The orb falls back to flat rings when motion is reduced or off, when the owner asks for it, or when the GPU cannot
 * keep up: the first 90 frames are timed once per page load and a slow average switches to the flat version.
 */
export function useOrbFlat(): boolean {
  const { appearance } = useAppearance();
  const [slow, setSlow] = useState(false);
  const [forced, setForced] = useState(() => {
    try {
      return window.localStorage.getItem(FLAT_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const on = () => {
      try {
        setForced(window.localStorage.getItem(FLAT_KEY) === '1');
      } catch {
        /* storage blocked */
      }
    };
    window.addEventListener('zakos:orb-flat', on);
    return () => window.removeEventListener('zakos:orb-flat', on);
  }, []);

  useEffect(() => {
    if (slowChecked) {
      setSlow(slowResult);
      return;
    }
    let frames = 0;
    let last = performance.now();
    let total = 0;
    let raf = 0;
    const tick = (now: number) => {
      // A hidden tab throttles frames; those samples say nothing about the GPU.
      if (!document.hidden) {
        total += now - last;
        frames += 1;
      }
      last = now;
      if (frames >= 90) {
        slowChecked = true;
        slowResult = total / frames > 34;
        setSlow(slowResult);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return forced || slow || prefersReducedMotion() || appearance.motion === 'off';
}

let slowChecked = false;
let slowResult = false;

export function setOrbFlat(on: boolean) {
  try {
    window.localStorage.setItem(FLAT_KEY, on ? '1' : '0');
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new Event('zakos:orb-flat'));
}
