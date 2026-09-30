import { vaultService } from '../vault';

/**
 * Ranked full-text search over the vault using BM25. It matches words (with light stemming),
 * not meaning, so a question worded very differently from the note can miss it. Titles, tags and
 * headings count for more than body text.
 */
export interface Hit {
  id: string;
  title: string;
  relativePath: string;
  score: number;
  snippet: string;
  tags: string[];
}

interface Doc {
  id: string;
  title: string;
  relativePath: string;
  tags: string[];
  body: string;
  terms: Map<string, number>;
  length: number;
}

const STOP = new Set('a an and are as at be but by for from has have how i in into is it its of on or that the their then there these this to was what when where which who why will with you your can do does did not no so if we our us about'.split(' '));

/** Lowercases, splits on anything that is not a letter or digit, drops filler words and trims plural endings. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map((t) => (t.length > 4 && t.endsWith('ies') ? `${t.slice(0, -3)}y` : t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t));
}

let cache: { signature: string; docs: Doc[]; df: Map<string, number>; avg: number } | null = null;

/** The index is rebuilt only when a note was added, removed or changed. */
function index() {
  const notes = vaultService.getAllNotes().filter((n) => !n.relativePath.split('/').includes('Graph'));
  const signature = notes.map((n) => `${n.id}:${n.size}:${n.updated}`).join('|');
  if (cache && cache.signature === signature) return cache;

  const docs: Doc[] = notes.map((n) => {
    const terms = new Map<string, number>();
    const add = (text: string, weight: number) => {
      for (const t of tokenize(text)) terms.set(t, (terms.get(t) ?? 0) + weight);
    };
    add(n.title, 6);
    add(n.tags.join(' '), 4);
    add(n.headings.map((h) => (typeof h === 'string' ? h : (h as { text?: string }).text ?? '')).join(' '), 3);
    add(n.relativePath, 1);
    add(n.content, 1);
    return { id: n.id, title: n.title, relativePath: n.relativePath, tags: n.tags, body: n.content, terms, length: [...terms.values()].reduce((a, b) => a + b, 0) };
  });
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.terms.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const avg = docs.reduce((a, d) => a + d.length, 0) / Math.max(1, docs.length);
  cache = { signature, docs, df, avg };
  return cache;
}

function snippetFor(body: string, queryTerms: string[]): string {
  const lower = body.toLowerCase();
  let at = -1;
  for (const t of queryTerms) {
    const i = lower.indexOf(t);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  const start = Math.max(0, at < 0 ? 0 : at - 60);
  const raw = body.slice(start, start + 220).replace(/\s+/g, ' ').trim();
  return `${start > 0 ? '…' : ''}${raw}${start + 220 < body.length ? '…' : ''}`;
}

export function searchNotes(query: string, limit = 20): Hit[] {
  const q = tokenize(query);
  if (q.length === 0) return [];
  const { docs, df, avg } = index();
  const N = docs.length;
  const k1 = 1.4;
  const b = 0.75;
  const hits: Hit[] = [];
  for (const d of docs) {
    let score = 0;
    for (const t of q) {
      const f = d.terms.get(t);
      if (!f) continue;
      const idf = Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.length) / avg)));
    }
    if (score > 0) hits.push({ id: d.id, title: d.title, relativePath: d.relativePath, score: Math.round(score * 100) / 100, snippet: snippetFor(d.body, q), tags: d.tags });
  }
  return hits.sort((a, b2) => b2.score - a.score).slice(0, limit);
}

/** Full text of a note by id, for building an answer from it. */
export function noteBody(id: string): string {
  return vaultService.getNoteById(id)?.content ?? '';
}
