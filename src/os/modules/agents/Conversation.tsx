import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUp, ChevronRight, Square } from 'lucide-react';
import { cx } from '../../ui/cx';
import { Kbd, Markdown, StatusDot } from '../../ui';
import { usePrefersReducedMotion } from '../../theme/motion';
import { summarizeInput, type Item } from './items';

function ToolCard({ item }: { item: Extract<Item, { kind: 'tool' }> }) {
  const summary = summarizeInput(item.name, item.input);
  const state = item.open ? 'live' : item.isError ? 'error' : 'idle';
  const stateLabel = item.open ? 'Running' : item.isError ? 'Failed or denied' : 'Done';
  const output = item.output && item.output.length > 4000 ? `${item.output.slice(0, 4000)}\n(output shortened)` : item.output;
  return (
    <details className="group rounded-[var(--os-radius)] border border-os-line bg-os-surface">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-[var(--os-radius)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] [&::-webkit-details-marker]:hidden">
        <ChevronRight size={14} strokeWidth={1.75} className="shrink-0 text-os-muted transition-transform group-open:rotate-90" aria-hidden />
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

function ItemView({ item }: { item: Item }) {
  switch (item.kind) {
    case 'user':
      return (
        <div className="ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-[var(--os-radius-lg)] bg-os-surface-2 px-3.5 py-2.5 text-[15px] leading-relaxed text-os-text">
          {item.text}
        </div>
      );
    case 'text':
      return <Markdown text={item.text} />;
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
  onSend: (prompt: string) => Promise<void>;
  onStop: () => Promise<void>;
  agentLabel: string;
}

export function Conversation({ items, running, loading, error, sessionKey, onSend, onStop, agentLabel }: ConversationProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const reduced = usePrefersReducedMotion();
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  // A new session always opens at the latest message.
  useLayoutEffect(() => {
    stick.current = true;
  }, [sessionKey]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTo({ top: el.scrollHeight, behavior: reduced ? 'auto' : 'auto' });
  }, [items, running, sessionKey, reduced]);

  useEffect(() => {
    setDraft('');
    setSendError(null);
    input.current?.focus();
  }, [sessionKey]);

  // Grow the box with its content, up to a cap.
  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [draft]);

  const submit = async () => {
    const prompt = draft.trim();
    if (!prompt || running) return;
    setSendError(null);
    stick.current = true;
    setDraft('');
    try {
      await onSend(prompt);
    } catch (e) {
      setDraft(prompt);
      setSendError((e as Error).message);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };

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
            <ItemView key={it.key} item={it} />
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
          <div className="flex items-end gap-2 rounded-[var(--os-radius-lg)] border border-os-line bg-os-bg p-2 focus-within:border-os-cyan">
            <textarea
              ref={input}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              aria-label={`Message ${agentLabel}`}
              placeholder={running ? `${agentLabel} is working` : `Message ${agentLabel}`}
              disabled={running}
              className="max-h-[200px] min-h-[28px] flex-1 resize-none bg-transparent px-1.5 py-1 text-[15px] leading-relaxed text-os-text placeholder:text-os-muted focus:outline-none disabled:opacity-60"
            />
            {running ? (
              <button
                type="button"
                onClick={() => void onStop()}
                aria-label="Stop the running agent"
                className="flex h-8 items-center gap-1.5 rounded-[var(--os-radius)] border border-os-amber px-3 text-sm text-os-amber hover:bg-os-surface-2 focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
              >
                <Square size={12} strokeWidth={2} aria-hidden />
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void submit()}
                disabled={!draft.trim()}
                aria-label="Send message"
                className="grid h-8 w-8 place-items-center rounded-[var(--os-radius)] bg-os-cyan text-os-bg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ArrowUp size={16} strokeWidth={2.25} aria-hidden />
              </button>
            )}
          </div>
          <p className="mt-1.5 text-xs text-os-muted">
            <Kbd>Enter</Kbd> to send, <Kbd>Shift</Kbd> + <Kbd>Enter</Kbd> for a new line
          </p>
        </div>
      </div>
    </div>
  );
}
