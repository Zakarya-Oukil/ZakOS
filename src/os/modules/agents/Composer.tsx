import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUp, Bookmark, FileText, Folder, Globe, Network, NotebookText, Paperclip, Square, Trash2, X } from 'lucide-react';
import { cx } from '../../ui/cx';
import { Kbd } from '../../ui';
import {
  contextApi,
  formatSize,
  KIND_LABEL,
  promptsApi,
  type AttachKind,
  type Attachment,
  type AttachRef,
  type Candidate,
  type SavedPrompt,
} from './attach';

const ICON: Record<AttachKind, typeof FileText> = { file: FileText, folder: Folder, note: NotebookText, graph: Network, url: Globe, picked: Paperclip };

const pop =
  'absolute bottom-full left-0 right-0 z-20 mb-2 max-h-72 overflow-y-auto rounded-[var(--os-radius-lg)] border border-os-line bg-os-surface p-1 shadow-lg';
const row =
  'flex w-full items-center gap-2 rounded-[var(--os-radius)] px-2 py-1.5 text-left text-sm text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]';
const smallBtn =
  'inline-flex h-7 items-center gap-1.5 rounded-[var(--os-radius)] border border-os-line px-2 text-xs text-os-muted hover:border-os-cyan hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] disabled:cursor-not-allowed disabled:opacity-40';

type Popup = { type: 'mention'; query: string; start: number } | { type: 'slash'; query: string } | { type: 'add' } | null;
type Tab = 'file' | 'note' | 'graph' | 'url';

interface ComposerProps {
  sessionId: string | undefined;
  running: boolean;
  agentLabel: string;
  onSend: (prompt: string, attachments: AttachRef[]) => Promise<void>;
  onStop: () => Promise<void>;
  /** Changes when the owner opens another session, which clears the draft. */
  sessionKey: string;
  onSent: () => void;
  onError: (message: string | null) => void;
}

let keyCounter = 0;

export function Composer({ sessionId, running, agentLabel, onSend, onStop, sessionKey, onSent, onError }: ComposerProps) {
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [popup, setPopup] = useState<Popup>(null);
  const [results, setResults] = useState<Candidate[]>([]);
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [active, setActive] = useState(0);
  const [tab, setTab] = useState<Tab>('file');
  const [addQuery, setAddQuery] = useState('');
  const [url, setUrl] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft('');
    setAttachments([]);
    setPopup(null);
    setNote(null);
    input.current?.focus();
  }, [sessionKey]);

  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [draft]);

  // Candidates for whichever popup is open. Stale answers are dropped so fast typing cannot show old results.
  useEffect(() => {
    if (!sessionId || !popup) return;
    let stale = false;
    const t = setTimeout(() => {
      const ask =
        popup.type === 'mention'
          ? contextApi.search(sessionId, popup.query)
          : popup.type === 'add' && tab !== 'url'
            ? contextApi.search(sessionId, addQuery, tab)
            : null;
      ask?.then((r) => !stale && (setResults(r), setActive(0))).catch(() => !stale && setResults([]));
      if (popup.type === 'slash') promptsApi.list().then((p) => !stale && setPrompts(p)).catch(() => !stale && setPrompts([]));
    }, 120);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [popup, sessionId, tab, addQuery]);

  const addAttachment = useCallback(
    async (a: AttachRef & { label: string }) => {
      if (!sessionId) return;
      if (attachments.some((x) => x.kind === a.kind && x.ref === a.ref)) return;
      const key = `a${keyCounter++}`;
      setAttachments((prev) => [...prev, { ...a, key }]);
      setNote(null);
      try {
        // Checking now means a bad URL or a vanished file fails here, with its reason, instead of at send time.
        const info = await contextApi.check(sessionId, a);
        setAttachments((prev) => prev.map((x) => (x.key === key ? { ...x, label: info.label || x.label, size: info.size, truncated: info.truncated } : x)));
      } catch (e) {
        setAttachments((prev) => prev.filter((x) => x.key !== key));
        setNote((e as Error).message);
      }
    },
    [sessionId, attachments],
  );

  const pickCandidate = (c: Candidate) => {
    if (popup?.type === 'mention') {
      // Replace the "@query" the owner typed with nothing; the chip carries the reference.
      const end = popup.start + 1 + popup.query.length;
      setDraft((d) => `${d.slice(0, popup.start)}${d.slice(end)}`.replace(/ {2,}/g, ' '));
    }
    setPopup(null);
    void addAttachment(c);
    input.current?.focus();
  };

  const pickPrompt = (p: SavedPrompt) => {
    setDraft(p.text);
    setPopup(null);
    input.current?.focus();
  };

  const onChange = (value: string, caret: number) => {
    setDraft(value);
    const before = value.slice(0, caret);
    const mention = /(^|\s)@([^\s@]*)$/.exec(before);
    if (mention) return setPopup({ type: 'mention', query: mention[2], start: caret - mention[2].length - 1 });
    const slash = /^\/([^\s]*)$/.exec(value);
    if (slash) return setPopup({ type: 'slash', query: slash[1] });
    setPopup((p) => (p && p.type !== 'add' ? null : p));
  };

  const visiblePrompts = popup?.type === 'slash' ? prompts.filter((p) => p.name.toLowerCase().includes(popup.query.toLowerCase())) : [];
  const listLength = popup?.type === 'slash' ? visiblePrompts.length : results.length;

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (popup && popup.type !== 'add' && listLength > 0) {
      if (e.key === 'ArrowDown') return void (e.preventDefault(), setActive((i) => (i + 1) % listLength));
      if (e.key === 'ArrowUp') return void (e.preventDefault(), setActive((i) => (i - 1 + listLength) % listLength));
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (popup.type === 'slash') pickPrompt(visiblePrompts[active]);
        else pickCandidate(results[active]);
        return;
      }
    }
    if (e.key === 'Escape' && popup) return void (e.preventDefault(), setPopup(null));
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };

  const submit = async () => {
    const prompt = draft.trim();
    if (!prompt || running) return;
    if (attachments.some((a) => a.size === undefined)) return setNote('Still checking an attachment. Try again in a moment.');
    onError(null);
    onSent();
    const sending = attachments;
    setDraft('');
    setAttachments([]);
    setPopup(null);
    try {
      await onSend(prompt, sending.map(({ kind, ref }) => ({ kind, ref })));
    } catch (e) {
      setDraft(prompt);
      setAttachments(sending);
      onError((e as Error).message);
    }
  };

  const savePrompt = async () => {
    const name = saveName.trim();
    if (!name || !draft.trim()) return;
    try {
      await promptsApi.save(name, draft.trim());
      setSaving(false);
      setSaveName('');
      setNote(`Saved as /${name}`);
    } catch (e) {
      setNote((e as Error).message);
    }
  };

  const pick = async (type: 'file' | 'folder') => {
    setPopup(null);
    try {
      const p = await contextApi.pick(type);
      if (p) void addAttachment(p);
    } catch (e) {
      setNote((e as Error).message);
    }
  };

  const total = attachments.reduce((n, a) => n + (a.size ?? 0), 0);

  return (
    <div className="relative">
      {popup && (popup.type === 'mention' || popup.type === 'slash') && (
        <div className={pop} role="listbox" aria-label={popup.type === 'slash' ? 'Saved prompts' : 'Things to attach'}>
          {popup.type === 'slash' ? (
            visiblePrompts.length === 0 ? (
              <p className="px-2 py-2 text-xs text-os-muted">No saved prompts{popup.query ? ` match "${popup.query}"` : ' yet'}. Write one, then use Save as prompt.</p>
            ) : (
              visiblePrompts.map((p, i) => (
                <div key={p.id} className="group flex items-center">
                  <button type="button" role="option" aria-selected={i === active} className={cx(row, 'min-w-0 flex-1', i === active && 'bg-os-surface-2')} onMouseEnter={() => setActive(i)} onClick={() => pickPrompt(p)}>
                    <Bookmark size={14} aria-hidden className="shrink-0 text-os-cyan" />
                    <span className="shrink-0 font-os-mono text-xs">/{p.name}</span>
                    <span className="truncate text-xs text-os-muted">{p.text}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete prompt ${p.name}`}
                    className="mx-1 rounded-[var(--os-radius-sm)] p-1 text-os-muted hover:text-os-danger focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
                    onClick={() => promptsApi.remove(p.id).then(() => setPrompts((l) => l.filter((x) => x.id !== p.id))).catch((e: Error) => setNote(e.message))}
                  >
                    <Trash2 size={13} aria-hidden />
                  </button>
                </div>
              ))
            )
          ) : results.length === 0 ? (
            <p className="px-2 py-2 text-xs text-os-muted">Nothing matches "{popup.query}". Files, Obsidian notes and graph nodes are searched.</p>
          ) : (
            results.map((c, i) => <CandidateRow key={`${c.kind}:${c.ref}`} c={c} active={i === active} onHover={() => setActive(i)} onPick={() => pickCandidate(c)} />)
          )}
        </div>
      )}

      {popup?.type === 'add' && (
        <div className={cx(pop, 'p-2')} role="dialog" aria-label="Attach context">
          <div className="mb-2 flex flex-wrap items-center gap-1" role="tablist">
            {(['file', 'note', 'graph', 'url'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                className={cx('rounded-[var(--os-radius)] px-2 py-1 text-xs focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]', tab === t ? 'bg-os-surface-2 text-os-text' : 'text-os-muted hover:text-os-text')}
                onClick={() => {
                  setTab(t);
                  setResults([]);
                  setAddQuery('');
                }}
              >
                {t === 'file' ? 'Project files' : t === 'note' ? 'Notes' : t === 'graph' ? 'Graph' : 'Web page'}
              </button>
            ))}
            <span className="ml-auto flex gap-1">
              <button type="button" className={smallBtn} onClick={() => void pick('file')}>
                <Paperclip size={12} aria-hidden /> Pick file…
              </button>
              <button type="button" className={smallBtn} onClick={() => void pick('folder')}>
                <Folder size={12} aria-hidden /> Pick folder…
              </button>
            </span>
          </div>
          {tab === 'url' ? (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!url.trim()) return;
                void addAttachment({ kind: 'url', ref: url.trim(), label: url.trim() });
                setUrl('');
                setPopup(null);
              }}
            >
              <input
                autoFocus
                aria-label="Web page address"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                className="h-8 min-w-0 flex-1 rounded-[var(--os-radius)] border border-os-line bg-os-bg px-2 text-sm text-os-text placeholder:text-os-muted focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
              />
              <button type="submit" className={smallBtn} disabled={!url.trim()}>
                Attach page
              </button>
            </form>
          ) : (
            <>
              <input
                autoFocus
                aria-label="Search"
                value={addQuery}
                onChange={(e) => setAddQuery(e.target.value)}
                placeholder={tab === 'file' ? 'Search project files' : tab === 'note' ? 'Search Obsidian notes' : 'Search graph nodes'}
                className="mb-1 h-8 w-full rounded-[var(--os-radius)] border border-os-line bg-os-bg px-2 text-sm text-os-text placeholder:text-os-muted focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
              />
              {results.length === 0 ? (
                <p className="px-2 py-2 text-xs text-os-muted">{tab === 'graph' ? 'No matching graph nodes. Build the project graph on the Projects page first.' : 'No matches.'}</p>
              ) : (
                results.map((c, i) => <CandidateRow key={`${c.kind}:${c.ref}`} c={c} active={i === active} onHover={() => setActive(i)} onPick={() => pickCandidate(c)} />)
              )}
            </>
          )}
        </div>
      )}

      {attachments.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Attached context">
          {attachments.map((a) => {
            const Icon = ICON[a.kind];
            return (
              <li key={a.key} className="flex max-w-full items-center gap-1.5 rounded-full border border-os-line bg-os-surface-2 py-0.5 pl-2 pr-1 text-xs text-os-text">
                <Icon size={12} aria-hidden className="shrink-0 text-os-cyan" />
                <span className="truncate" title={`${KIND_LABEL[a.kind]}: ${a.label}`}>{a.label}</span>
                <span className={cx('shrink-0', a.truncated ? 'text-os-amber' : 'text-os-muted')}>{a.size === undefined ? 'checking…' : a.truncated ? `${formatSize(a.size)} cut` : formatSize(a.size)}</span>
                <button type="button" aria-label={`Remove ${a.label}`} className="rounded-full p-0.5 text-os-muted hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]" onClick={() => setAttachments((p) => p.filter((x) => x.key !== a.key))}>
                  <X size={12} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-end gap-2 rounded-[var(--os-radius-lg)] border border-os-line bg-os-bg p-2 focus-within:border-os-cyan">
        <button
          type="button"
          aria-label="Attach context"
          aria-expanded={popup?.type === 'add'}
          disabled={!sessionId}
          onClick={() => {
            setResults([]);
            setAddQuery('');
            setPopup((p) => (p?.type === 'add' ? null : { type: 'add' }));
          }}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--os-radius)] text-os-muted hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] disabled:opacity-40"
        >
          <Paperclip size={16} strokeWidth={1.75} aria-hidden />
        </button>
        <textarea
          ref={input}
          value={draft}
          onChange={(e) => onChange(e.target.value, e.target.selectionStart)}
          onKeyDown={onKeyDown}
          rows={1}
          aria-label={`Message ${agentLabel}`}
          aria-autocomplete="list"
          placeholder={running ? `${agentLabel} is working` : `Message ${agentLabel}. @ to attach, / for saved prompts`}
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

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-os-muted">
        <span>
          <Kbd>Enter</Kbd> to send, <Kbd>Shift</Kbd> + <Kbd>Enter</Kbd> for a new line
        </span>
        {total > 0 && <span>{formatSize(total)} attached</span>}
        {draft.trim() && !saving && (
          <button type="button" className="underline-offset-2 hover:text-os-text hover:underline focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]" onClick={() => setSaving(true)}>
            Save as prompt
          </button>
        )}
        {saving && (
          <form
            className="flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              void savePrompt();
            }}
          >
            <input autoFocus aria-label="Prompt name" value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Name" maxLength={60} className="h-6 w-32 rounded-[var(--os-radius-sm)] border border-os-line bg-os-bg px-1.5 text-xs text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]" />
            <button type="submit" className={smallBtn} disabled={!saveName.trim()}>Save</button>
            <button type="button" className={smallBtn} onClick={() => setSaving(false)}>Cancel</button>
          </form>
        )}
        {note && <span role="status" className="text-os-amber">{note}</span>}
      </div>
    </div>
  );
}

function CandidateRow({ c, active, onHover, onPick }: { c: Candidate; active: boolean; onHover: () => void; onPick: () => void }) {
  const Icon = ICON[c.kind];
  return (
    <button type="button" role="option" aria-selected={active} className={cx(row, active && 'bg-os-surface-2')} onMouseEnter={onHover} onClick={onPick}>
      <Icon size={14} aria-hidden className="shrink-0 text-os-cyan" />
      <span className="shrink-0 truncate">{c.label}</span>
      {c.detail && <span className="min-w-0 truncate text-xs text-os-muted">{c.detail}</span>}
      <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-os-muted">{KIND_LABEL[c.kind]}</span>
    </button>
  );
}
