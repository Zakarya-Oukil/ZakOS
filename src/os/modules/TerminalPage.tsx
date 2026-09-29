import { useCallback, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { PageFrame } from '../shell/PageFrame';
import { IconButton, Tabs } from '../ui';
import { TerminalView } from './terminal/TerminalView';

interface Term {
  id: string;
  cwd: string;
}

let seq = 0;
const makeTerm = (cwd: string): Term => ({ id: `t${++seq}`, cwd });

export default function TerminalPage() {
  const [terms, setTerms] = useState<Term[]>(() => [makeTerm('')]);
  const [activeId, setActiveId] = useState<string>(terms[0].id);
  const [folder, setFolder] = useState('');

  const add = useCallback(() => {
    const t = makeTerm(folder.trim());
    setTerms((prev) => [...prev, t]);
    setActiveId(t.id);
  }, [folder]);

  const close = useCallback(
    (id: string) => {
      setTerms((prev) => {
        const next = prev.filter((t) => t.id !== id);
        if (next.length === 0) {
          const fresh = makeTerm('');
          setActiveId(fresh.id);
          return [fresh];
        }
        if (id === activeId) setActiveId(next[next.length - 1].id);
        return next;
      });
    },
    [activeId],
  );

  return (
    <PageFrame
      title="Terminal"
      leading={
        <Tabs
          aria-label="Terminals"
          tabs={terms.map((t, i) => ({ id: t.id, label: `Shell ${i + 1}` }))}
          value={activeId}
          onChange={setActiveId}
        />
      }
      actions={
        <>
          <label htmlFor="term-folder" className="sr-only">
            Folder for new terminals
          </label>
          <input
            id="term-folder"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Folder for new terminals"
            spellCheck={false}
            className="hidden h-7 w-56 rounded-[var(--os-radius)] border border-os-line bg-os-bg px-2 font-os-mono text-xs text-os-text placeholder:text-os-muted focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] md:block"
          />
          <IconButton aria-label="New terminal" onClick={add}>
            <Plus size={16} strokeWidth={1.75} />
          </IconButton>
          <IconButton aria-label="Close this terminal" onClick={() => close(activeId)}>
            <X size={16} strokeWidth={1.75} />
          </IconButton>
        </>
      }
    >
      <div className="h-full">
        {terms.map((t) => (
          <div key={t.id} className={t.id === activeId ? 'h-full' : 'hidden'}>
            <TerminalView cwd={t.cwd} active={t.id === activeId} />
          </div>
        ))}
      </div>
    </PageFrame>
  );
}
