import type { AgentEvent } from '../../lib/agentsSocket';

export type Item =
  | { kind: 'user'; key: string; text: string }
  | { kind: 'text'; key: string; text: string; open: boolean }
  | { kind: 'tool'; key: string; id: string; name: string; input: unknown; output?: string; isError?: boolean; open: boolean }
  | { kind: 'error'; key: string; message: string };

let counter = 0;
const nextKey = () => `i${counter++}`;

/** Fold one event into the item list. Pure: returns a new array. */
export function applyEvent(items: Item[], event: AgentEvent): Item[] {
  const last = items[items.length - 1];
  switch (event.type) {
    case 'user':
      return [...items.map(closeAll), { kind: 'user', key: nextKey(), text: event.text }];
    case 'text': {
      if (last?.kind === 'text' && last.open) {
        return [...items.slice(0, -1), { ...last, text: last.text + event.delta }];
      }
      return [...items, { kind: 'text', key: nextKey(), text: event.delta, open: true }];
    }
    case 'tool_use':
      return [
        ...items.map(closeText),
        { kind: 'tool', key: nextKey(), id: event.id, name: event.name, input: event.input, open: true },
      ];
    case 'tool_result':
      return items.map((it) =>
        it.kind === 'tool' && it.id === event.id
          ? { ...it, output: event.output, isError: event.isError, open: false }
          : it,
      );
    case 'error':
      return [...items.map(closeAll), { kind: 'error', key: nextKey(), message: event.message }];
    case 'done':
      return items.map(closeAll);
    default:
      return items;
  }
}

function closeText(it: Item): Item {
  return it.kind === 'text' && it.open ? { ...it, open: false } : it;
}

function closeAll(it: Item): Item {
  if (it.kind === 'text' && it.open) return { ...it, open: false };
  if (it.kind === 'tool' && it.open) return { ...it, open: false };
  return it;
}

export function buildItems(events: AgentEvent[]): Item[] {
  return events.reduce<Item[]>(applyEvent, []);
}

/** One-line description of a tool call's input for the collapsed card header. */
export function summarizeInput(name: string, input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  const o = input as Record<string, unknown>;
  const pick = o.command ?? o.file_path ?? o.path ?? o.pattern ?? o.url ?? o.description ?? o.prompt;
  return typeof pick === 'string' ? pick.replace(/\s+/g, ' ').slice(0, 140) : '';
}
