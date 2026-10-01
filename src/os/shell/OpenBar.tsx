import { useState } from 'react';
import type { FormEvent } from 'react';
import { Microphone, MicrophoneSlash, ArrowRight } from '@phosphor-icons/react';
import { dictationSupported, useDictation } from '../modules/agents/voice';
import { openFromText } from '../lib/launcher';
import { cx } from '../ui/cx';

/** One line to open anything: a link or video in a floating window, an installed app on this PC. Typed or spoken. */
export function OpenBar({ className }: { className?: string }) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const go = async (value: string) => {
    const v = value.trim();
    if (!v || busy) return;
    setBusy(true);
    setStatus(await openFromText(v));
    setBusy(false);
    setText('');
  };

  const mic = useDictation((spoken) => {
    setText(spoken);
    void go(spoken);
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void go(text);
  };

  return (
    <div className={className}>
      <form onSubmit={submit} className="flex items-center gap-2 border border-os-line bg-os-surface/70 pl-3 pr-1 backdrop-blur-md focus-within:border-os-cyan focus-within:shadow-[var(--os-glow-cyan)]" role="search">
        <label htmlFor="open-bar" className="sr-only">
          Open an app, link or video
        </label>
        <input
          id="open-bar"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Open youtube.com, play lofi on youtube, open spotify"
          autoComplete="off"
          className="h-11 min-w-0 flex-1 bg-transparent font-os-sans text-[15px] text-os-text placeholder:text-os-muted focus:outline-none focus-visible:shadow-none"
        />
        {dictationSupported() && (
          <button
            type="button"
            onClick={() => (mic.listening ? mic.stop() : mic.start())}
            aria-pressed={mic.listening}
            aria-label={mic.listening ? 'Stop listening' : 'Speak a command'}
            className={cx('grid h-9 w-9 place-items-center text-os-muted transition-colors hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]', mic.listening && 'text-os-cyan')}
          >
            {mic.listening ? <MicrophoneSlash size={18} weight="duotone" aria-hidden /> : <Microphone size={18} weight="duotone" aria-hidden />}
          </button>
        )}
        <button type="submit" disabled={busy || !text.trim()} aria-label="Open" className="grid h-9 w-9 place-items-center bg-os-cyan text-os-bg transition-opacity disabled:opacity-40 focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] active:scale-95">
          <ArrowRight size={18} weight="bold" aria-hidden />
        </button>
      </form>
      <p role="status" aria-live="polite" className={cx('mt-2 min-h-5 font-os-sans text-[13px]', status && !status.ok ? 'text-os-danger' : 'text-os-muted')}>
        {mic.error ?? status?.message ?? ''}
      </p>
    </div>
  );
}
