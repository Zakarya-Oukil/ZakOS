import { Fragment, memo, type ReactNode } from 'react';
import { marked, type Token, type Tokens } from 'marked';
import { cx } from './cx';

/**
 * Renders markdown as React elements. Nothing is injected as HTML, so untrusted
 * agent output cannot run script or inject markup: raw HTML shows as plain text
 * and links are limited to http(s) and mailto.
 */

const SAFE_LINK = /^(https?:\/\/|mailto:)/i;

function inline(tokens: Token[] | undefined, keyPrefix: string): ReactNode {
  if (!tokens) return null;
  return tokens.map((t, i) => {
    const key = `${keyPrefix}-${i}`;
    switch (t.type) {
      case 'strong':
        return <strong key={key} className="font-semibold">{inline((t as Tokens.Strong).tokens, key)}</strong>;
      case 'em':
        return <em key={key}>{inline((t as Tokens.Em).tokens, key)}</em>;
      case 'del':
        return <del key={key}>{inline((t as Tokens.Del).tokens, key)}</del>;
      case 'codespan':
        return (
          <code key={key} className="rounded-[var(--os-radius-sm)] bg-os-surface-2 px-1 py-0.5 font-os-mono text-[0.85em]">
            {(t as Tokens.Codespan).text}
          </code>
        );
      case 'br':
        return <br key={key} />;
      case 'link': {
        const l = t as Tokens.Link;
        const label = inline(l.tokens, key);
        if (!SAFE_LINK.test(l.href)) return <Fragment key={key}>{label}</Fragment>;
        return (
          <a
            key={key}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-os-cyan underline decoration-os-line underline-offset-2 hover:decoration-os-cyan focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
          >
            {label}
          </a>
        );
      }
      case 'image':
        return <Fragment key={key}>{(t as Tokens.Image).text}</Fragment>;
      case 'text': {
        const tx = t as Tokens.Text;
        return <Fragment key={key}>{tx.tokens ? inline(tx.tokens, key) : tx.text}</Fragment>;
      }
      default:
        // Includes raw `html` tokens: shown as literal text, never parsed.
        return <Fragment key={key}>{'text' in t ? String((t as { text: unknown }).text) : t.raw}</Fragment>;
    }
  });
}

function blocks(tokens: Token[], keyPrefix: string): ReactNode {
  return tokens.map((t, i) => {
    const key = `${keyPrefix}-${i}`;
    switch (t.type) {
      case 'space':
        return null;
      case 'heading': {
        const h = t as Tokens.Heading;
        const size = h.depth <= 1 ? 'text-lg' : h.depth === 2 ? 'text-base' : 'text-[15px]';
        return (
          <p key={key} role="heading" aria-level={Math.min(h.depth + 2, 6)} className={cx('font-semibold text-os-text', size)}>
            {inline(h.tokens, key)}
          </p>
        );
      }
      case 'paragraph':
        return <p key={key}>{inline((t as Tokens.Paragraph).tokens, key)}</p>;
      case 'text':
        return <p key={key}>{inline((t as Tokens.Text).tokens ?? [t], key)}</p>;
      case 'code': {
        const c = t as Tokens.Code;
        return (
          <pre
            key={key}
            className="overflow-x-auto rounded-[var(--os-radius)] border border-os-line bg-os-bg p-3 font-os-mono text-[13px] leading-relaxed text-os-text"
          >
            <code>{c.text}</code>
          </pre>
        );
      }
      case 'blockquote':
        return (
          <blockquote key={key} className="grid gap-2 border-l border-os-line pl-3 text-os-muted">
            {blocks((t as Tokens.Blockquote).tokens, key)}
          </blockquote>
        );
      case 'list': {
        const l = t as Tokens.List;
        const Tag = l.ordered ? 'ol' : 'ul';
        return (
          <Tag key={key} className={cx('grid gap-1 pl-5', l.ordered ? 'list-decimal' : 'list-disc')} start={l.ordered ? Number(l.start) || 1 : undefined}>
            {l.items.map((it, j) => (
              <li key={`${key}-${j}`} className="pl-1">
                {blocks(it.tokens, `${key}-${j}`)}
              </li>
            ))}
          </Tag>
        );
      }
      case 'hr':
        return <hr key={key} className="border-os-line" />;
      case 'table': {
        const tb = t as Tokens.Table;
        return (
          <div key={key} className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr>
                  {tb.header.map((h, j) => (
                    <th key={j} className="border-b border-os-line px-2 py-1.5 font-medium text-os-muted">
                      {inline(h.tokens, `${key}-h${j}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tb.rows.map((r, ri) => (
                  <tr key={ri}>
                    {r.map((c, ci) => (
                      <td key={ci} className="border-b border-os-line px-2 py-1.5 align-top">
                        {inline(c.tokens, `${key}-${ri}-${ci}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      default:
        // Raw HTML blocks and anything unknown render as inert text.
        return (
          <p key={key} className="whitespace-pre-wrap">
            {t.raw}
          </p>
        );
    }
  });
}

interface MarkdownProps {
  text: string;
  className?: string;
}

export const Markdown = memo(function Markdown({ text, className }: MarkdownProps) {
  const tokens = marked.lexer(text, { gfm: true, breaks: false });
  return (
    <div className={cx('grid max-w-[75ch] gap-3 break-words text-[15px] leading-relaxed text-os-text', className)}>
      {blocks(tokens, 'md')}
    </div>
  );
});
