import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Voice in and out through the browser's own speech features. Dictation in Chrome sends audio to the browser vendor's
 * speech service, so it needs an internet connection; reading aloud runs on this machine.
 */
interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>; resultIndex: number }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

type Ctor = new () => RecognitionLike;

function ctor(): Ctor | null {
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const dictationSupported = () => typeof window !== 'undefined' && ctor() !== null;
export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function useDictation(onFinalText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<RecognitionLike | null>(null);
  const cb = useRef(onFinalText);
  cb.current = onFinalText;

  const stop = useCallback(() => rec.current?.stop(), []);

  const start = useCallback(() => {
    const C = ctor();
    if (!C) return setError('This browser has no speech recognition. Chrome and Edge do.');
    setError(null);
    const r = new C();
    r.lang = navigator.language || 'en-US';
    r.interimResults = false;
    r.continuous = true;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) cb.current(res[0].transcript.trim());
      }
    };
    r.onerror = (e) => {
      setError(e.error === 'not-allowed' ? 'Microphone access was blocked. Allow it in the browser address bar.' : e.error === 'network' ? 'Speech recognition needs an internet connection.' : `Speech recognition stopped (${e.error}).`);
      setListening(false);
    };
    r.onend = () => setListening(false);
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, []);

  useEffect(() => () => rec.current?.stop(), []);
  return { listening, error, start, stop };
}

/** Strips Markdown so the voice reads words, not symbols. */
function plain(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' code block omitted. ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~|-]{1,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function useReadAloud() {
  const [speaking, setSpeaking] = useState<string | null>(null);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const toggle = useCallback((key: string, text: string) => {
    if (!speechSupported()) return;
    const synth = window.speechSynthesis;
    if (speaking === key) {
      synth.cancel();
      setSpeaking(null);
      return;
    }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(plain(text).slice(0, 6000));
    u.lang = navigator.language || 'en-US';
    u.onend = () => setSpeaking((s) => (s === key ? null : s));
    u.onerror = () => setSpeaking((s) => (s === key ? null : s));
    setSpeaking(key);
    synth.speak(u);
  }, [speaking]);

  return { speaking, toggle };
}
