import { useEffect, useRef, useState, type FormEvent } from 'react';
import { BookmarkSimple, Trash } from '@phosphor-icons/react';
import { Button, inputCls } from '../../ui';
import { api } from '../../lib/api';

/** Saved terminal commands, kept in this browser. A command is inserted at the prompt and never run for you. */
const KEY = 'zakos_saved_commands';
export const INSERT_EVENT = 'zakos:terminal-insert';

interface Saved {
  name: string;
  command: string;
}

function read(): Saved[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => x && typeof x.name === 'string' && typeof x.command === 'string') : [];
  } catch {
    return [];
  }
}

export function SavedCommands({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Saved[]>(read);
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');
  const [filter, setFilter] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const [ask, setAsk] = useState('');
  const [proposed, setProposed] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const propose = async () => {
    setAsking(true);
    setAskError(null);
    setProposed(null);
    try {
      const d = await api<{ command: string }>('/api/git-x/suggest-command', { method: 'POST', body: { request: ask } });
      setProposed(d.command);
    } catch (e) {
      setAskError((e as Error).message);
    } finally {
      setAsking(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const persist = (next: Saved[]) => {
    setItems(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage blocked */
    }
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !command.trim()) return;
    persist([...items.filter((i) => i.name !== name.trim()), { name: name.trim().slice(0, 40), command: command.trim().slice(0, 500) }].slice(-40));
    setName('');
    setCommand('');
  };

  const insert = (c: Saved) => {
    window.dispatchEvent(new CustomEvent(INSERT_EVENT, { detail: { sessionId, text: c.command } }));
    setOpen(false);
  };

  const shown = items.filter((i) => `${i.name} ${i.command}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs text-os-muted transition-colors hover:bg-os-surface-2 hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
      >
        <BookmarkSimple size={15} aria-hidden /> Commands
      </button>
      {open && (
        <div role="dialog" aria-label="Saved commands" className="absolute right-0 top-9 z-30 w-[360px] rounded-[var(--os-radius-lg)] border border-os-line bg-os-bg p-3 shadow-[var(--os-shadow-panel)]">
          <label htmlFor="sc-filter" className="sr-only">Search saved commands</label>
          <input id="sc-filter" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search saved commands" className={inputCls + ' h-9'} />
          <ul className="mt-2 max-h-56 overflow-y-auto">
            {shown.length === 0 && <li className="px-2 py-3 text-sm text-os-muted">{items.length ? 'No match.' : 'Nothing saved yet.'}</li>}
            {shown.map((i) => (
              <li key={i.name} className="flex items-center gap-1">
                <button type="button" onClick={() => insert(i)} className="min-w-0 flex-1 rounded-[var(--os-radius)] px-2 py-1.5 text-left hover:bg-os-surface-2 focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]">
                  <span className="block truncate text-[13px] font-medium text-os-text">{i.name}</span>
                  <span className="block truncate font-os-mono text-xs text-os-muted">{i.command}</span>
                </button>
                <button type="button" aria-label={`Delete ${i.name}`} onClick={() => persist(items.filter((x) => x.name !== i.name))} className="rounded-full p-1.5 text-os-muted hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]">
                  <Trash size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={add} className="mt-2 grid gap-2 border-t border-os-line pt-3">
            <label htmlFor="sc-name" className="sr-only">Name</label>
            <input id="sc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className={inputCls + ' h-9'} />
            <label htmlFor="sc-cmd" className="sr-only">Command</label>
            <input id="sc-cmd" value={command} onChange={(e) => setCommand(e.target.value)} placeholder="Command" spellCheck={false} className={inputCls + ' h-9 font-os-mono text-xs'} />
            <Button type="submit" size="sm" className="justify-self-start" disabled={!name.trim() || !command.trim()}>Save command</Button>
          </form>
          <p className="mt-2 text-xs text-os-muted">Inserted at the prompt. You press Enter to run it.</p>
          <div className="mt-3 grid gap-2 border-t border-os-line pt-3">
            <label htmlFor="sc-ask" className="text-[13px] font-medium text-os-text">Ask for a command</label>
            <input id="sc-ask" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="show the 5 biggest folders here" className={inputCls + ' h-9'} />
            <Button type="button" size="sm" className="justify-self-start" disabled={asking || !ask.trim()} onClick={propose}>{asking ? 'Thinking' : 'Suggest a command'}</Button>
            {askError && <p role="alert" className="text-xs text-os-danger">{askError}</p>}
            {proposed && (
              <div className="grid gap-2">
                <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-[var(--os-radius)] bg-os-surface-2 p-2 font-os-mono text-xs text-os-text">{proposed}</pre>
                <Button type="button" size="sm" className="justify-self-start" onClick={() => insert({ name: 'suggested', command: proposed.split('\n').filter((l) => !l.startsWith('#')).join(' ').trim() })}>Put it at the prompt (not run)</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
