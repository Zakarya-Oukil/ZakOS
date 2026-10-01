import { useLayoutEffect, useRef, useState } from 'react';
import { CaretRight, Copy, Paperclip, SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react';
import { cx } from '../../ui/cx';
import { Markdown, StatusDot } from '../../ui';
import { Composer } from './Composer';
import { formatSize, type AttachRef } from './attach';
import { usePrefersReducedMotion } from '../../theme/motion';
import { summarizeInput, type Item } from './items';
import { speechSupported, useReadAloud } from './voice';

function ToolCard({ item }: { item: Extract<Item, { kind: 'tool' }> }) {
  const summary = summarizeInput(item.name, item.input);
  const state = item.open ? 'live' : item.isError ? 'error' : 'idle';
  const stateLabel = item.open ? 'Running' : item.isError ? 'Failed or denied' : 'Done';
  const output = item.output && item.output.length > 4000 ? `${item.output.slice(0, 4000)}\n(output shortened)` : item.output;
  return (
    <details className="group rounded-[var(--os-radius)] border border-os-line bg-os-surface">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-[var(--os-radius)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] [&::-webkit-details-marker]:hidden">
        <CaretRight size={14} className="shrink-0 text-os-muted transition-transform group-open:rotate-90" aria-hidden />
        <span className="font-os-mono text-[13px] text-os-text">{item.name}</span>
        {summary && <span className="min-w-0 flex-1 truncate font-os-mono text-xs text-os-muted">{summary}</span>}
        <StatusDot status={state} label={stateLabel} className="ml-auto" />
      </summary>
      <div className="grid gap-2 border-t border-os-line p-3">
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-os-mono text-xs leading-relaxed text-os-muted">
          {JSON.stringify(item.input, null, 2)}
        </pre>
        {output !== undefined && (
          <pre
            className={cx(
              'max-h-64 overflow-auto whitespace-pre-wrap break-words border-t border-os-line pt-2 font-os-mono text-xs leading-relaxed',
              item.isError ? 'text-os-danger' : 'text-os-text',
            )}
          >
            {output || '(no output)'}
          </pre>
        )}
      </div>
    </details>
  );
}

function ItemView({ item, speaking, onSpeak }: { item: Item; speaking: string | null; onSpeak: (key: string, text: string) => void }) {
  switch (item.kind) {
    case 'user':
      return (
        <div className="ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-[var(--os-radius-lg)] bg-os-surface-2 px-3.5 py-2.5 text-[15px] leading-relaxed text-os-text">
          {item.text}
          {item.attachments && item.attachments.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Attached context">
              {item.attachments.map((a, i) => (
                <li key={i} className="flex max-w-full items-center gap-1 rounded-full border border-os-line px-2 py-0.5 text-xs text-os-muted">
                  <Paperclip size={11} aria-hidden className="shrink-0" />
                  <span className="truncate">{a.label}</span>
                  {a.truncated && <span className="text-os-amber">cut</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    case 'text':
      return (
        <div className="group/answer">
          <Markdown text={item.text} />
          {!item.open && (
            <div className="mt-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover/answer:opacity-100 focus-within:opacity-100">
              {speechSupported() && (
                <button
                  type="button"
                  aria-pressed={speaking === item.key}
                  onClick={() => onSpeak(item.key, item.text)}
                  className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs text-os-muted hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
                >
                  {speaking === item.key ? <SpeakerSlash size={14} aria-hidden /> : <SpeakerHigh size={14} aria-hidden />}
                  {speaking === item.key ? 'Stop' : 'Read aloud'}
                </button>
              )}
              <button
                type="button"
                onClick={() => void navigator.clipboard?.writeText(item.text)}
                className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs text-os-muted hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
              >
                <Copy size={14} aria-hidden /> Copy
              </button>
            </div>
          )}
        </div>
      );
    case 'tool':
      return <ToolCard item={item} />;
    case 'error':
      return (
        <div role="alert" className="max-w-[75ch] whitespace-pre-wrap break-words rounded-[var(--os-radius)] border border-os-danger px-3 py-2 text-sm text-os-danger">
          {item.message}
        </div>
      );
  }
}

interface ConversationProps {
  items: Item[];
  running: boolean;
  loading: boolean;
  error: string | null;
  sessionKey: string;
  sessionId?: string;
  onSend: (prompt: string, attachments: AttachRef[]) => Promise<void>;
  onStop: () => Promise<void>;
  agentLabel: string;
}

export function Conversation({ items, running, loading, error, sessionKey, sessionId, onSend, onStop, agentLabel }: ConversationProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const reduced = usePrefersReducedMotion();
  const [sendError, setSendError] = useState<string | null>(null);
  const aloud = useReadAloud();

  // A new session always opens at the latest message.
  useLayoutEffect(() => {
    stick.current = true;
  }, [sessionKey]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTo({ top: el.scrollHeight, behavior: reduced ? 'auto' : 'auto' });
  }, [items, running, sessionKey, reduced]);

  useLayoutEffect(() => {
    setSendError(null);
  }, [sessionKey]);

  const last = items[items.length - 1];
  const showWorking = running && !(last?.kind === 'text' && last.open);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <div className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-4 px-4 py-6">
          {loading && items.length === 0 && <p className="text-sm text-os-muted">Loading conversation</p>}
          {error && (
            <p role="alert" className="text-sm text-os-danger">
              {error}
            </p>
          )}
          {!loading && !error && items.length === 0 && (
            <p className="max-w-[60ch] text-sm leading-relaxed text-os-muted">
              This session is empty. Send a message and {agentLabel} runs it here, in the working folder shown on the right.
            </p>
          )}
          {items.map((it) => (
            <ItemView key={it.key} item={it} speaking={aloud.speaking} onSpeak={aloud.toggle} />
          ))}
          {showWorking && (
            <p className="flex items-center gap-2 text-sm text-os-muted" role="status">
              <StatusDot status="live" label="Working" />
              Working
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-os-line bg-os-surface p-3">
        <div className="mx-auto max-w-3xl">
          {sendError && (
            <p role="alert" className="mb-2 text-sm text-os-danger">
              {sendError}
            </p>
          )}
          <Composer
            sessionId={sessionId}
            sessionKey={sessionKey}
            running={running}
            agentLabel={agentLabel}
            onSend={onSend}
            onStop={onStop}
            onSent={() => {
              stick.current = true;
            }}
            onError={setSendError}
          />
        </div>
      </div>
    </div>
  );
}
