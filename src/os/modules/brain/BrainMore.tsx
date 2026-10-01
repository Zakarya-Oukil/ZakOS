import { Button, EmptyState, ErrorNote, Skeleton } from '../../ui';
import { useResource } from '../../lib/api';

interface Props {
  onOpenNote: (relativePath: string, id: string) => void;
}

const idOf = (p: string) => p.replace(/\.md$/, '');

/** Notes nothing links to, and links that could exist because one note names another. */
export function TidyTab({ onOpenNote }: Props) {
  const orphans = useResource<{ notes: Array<{ title: string; relativePath: string; words: number; updated: string }> }>('/api/brain-x/orphans');
  const links = useResource<{ suggestions: Array<{ from: string; fromPath: string; to: string; toPath: string }> }>('/api/brain-x/link-suggestions');

  return (
    <div className="grid gap-6 text-sm">
      <section>
        <h3 className="mb-1 text-[13px] font-semibold text-os-text">Notes with no links</h3>
        <p className="mb-2 text-xs leading-relaxed text-os-muted">These are islands: no note links to them and they link to nothing. Link them from a hub note, or delete them.</p>
        {orphans.loading && <Skeleton className="h-16" />}
        {orphans.error && <ErrorNote>{orphans.error}</ErrorNote>}
        {orphans.data && orphans.data.notes.length === 0 && <p className="text-os-muted">Every note is connected.</p>}
        <ul className="grid gap-0.5">
          {orphans.data?.notes.slice(0, 30).map((n) => (
            <li key={n.relativePath}>
              <button type="button" onClick={() => onOpenNote(n.relativePath, idOf(n.relativePath))} className="w-full rounded-[var(--os-radius)] px-2 py-1.5 text-left hover:bg-os-surface-2 focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]">
                <span className="block truncate text-os-text">{n.title}</span>
                <span className="block truncate text-xs text-os-muted">{n.relativePath}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="mb-1 text-[13px] font-semibold text-os-text">Links that could exist</h3>
        <p className="mb-2 text-xs leading-relaxed text-os-muted">The first note mentions the second by name without a link. Open the first and wrap the name in double brackets.</p>
        {links.loading && <Skeleton className="h-16" />}
        {links.data && links.data.suggestions.length === 0 && <p className="text-os-muted">No missing links found.</p>}
        <ul className="grid gap-1.5">
          {links.data?.suggestions.map((s, i) => (
            <li key={i} className="rounded-[var(--os-radius)] border border-os-line p-2.5">
              <p className="text-os-text">
                <button type="button" onClick={() => onOpenNote(s.fromPath, idOf(s.fromPath))} className="underline decoration-os-contour underline-offset-4 hover:text-os-cyan focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]">{s.from}</button>
                <span className="text-os-muted"> mentions </span>
                <button type="button" onClick={() => onOpenNote(s.toPath, idOf(s.toPath))} className="underline decoration-os-contour underline-offset-4 hover:text-os-cyan focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]">{s.to}</button>
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** When notes were made, newest day first. */
export function TimelineTab({ onOpenNote }: Props) {
  const { data, loading, error } = useResource<{ timeline: Array<{ day: string; count: number; notes: Array<{ title: string; relativePath: string }> }> }>('/api/brain-x/timeline?days=90');
  return (
    <div className="text-sm">
      {loading && <Skeleton className="h-24" />}
      {error && <ErrorNote>{error}</ErrorNote>}
      {data && data.timeline.length === 0 && <EmptyState title="No notes in the last 90 days">New notes appear here by the day they were made.</EmptyState>}
      <ol className="grid gap-4">
        {data?.timeline.map((d) => (
          <li key={d.day}>
            <p className="mb-1 text-[13px] font-semibold text-os-text">
              {new Date(d.day).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
              <span className="ml-2 text-xs font-normal text-os-muted">{d.count} note{d.count === 1 ? '' : 's'}</span>
            </p>
            <ul className="grid gap-0.5">
              {d.notes.map((n) => (
                <li key={n.relativePath}>
                  <button type="button" onClick={() => onOpenNote(n.relativePath, idOf(n.relativePath))} className="w-full truncate rounded-[var(--os-radius)] px-2 py-1 text-left text-os-text hover:bg-os-surface-2 focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]">{n.title}</button>
                </li>
              ))}
              {d.count > d.notes.length && <li className="px-2 text-xs text-os-muted">and {d.count - d.notes.length} more</li>}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** What agents wrote into the vault through auto-capture. */
export function AgentMemoryTab({ onOpenNote }: Props) {
  const { data, loading, error } = useResource<{ notes: Array<{ title: string; relativePath: string; entries: number; excerpt: string }> }>('/api/brain-x/agent-memory');
  return (
    <div className="text-sm">
      {loading && <Skeleton className="h-24" />}
      {error && <ErrorNote>{error}</ErrorNote>}
      {data && data.notes.length === 0 && (
        <EmptyState title="Agents have not written to the vault yet">Turn on capture in the Memory tab, or use Save to Brain on a session. What agents remember shows up here by day.</EmptyState>
      )}
      <ul className="grid gap-2">
        {data?.notes.map((n) => (
          <li key={n.relativePath} className="rounded-[var(--os-radius)] border border-os-line p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-os-text">{n.title}</p>
              <span className="text-xs text-os-muted">{n.entries} entr{n.entries === 1 ? 'y' : 'ies'}</span>
            </div>
            <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-os-muted">{n.excerpt}</p>
            <Button size="sm" variant="ghost" className="mt-1.5" onClick={() => onOpenNote(n.relativePath, idOf(n.relativePath))}>Read it</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
