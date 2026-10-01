import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, ErrorNote, Field, SuccessNote, inputCls, textareaCls } from '../ui';
import { api } from '../lib/api';

export const CAPTURE_EVENT = 'zakos:quick-capture';

/** A small window to drop a thought into the vault Inbox from anywhere, without leaving the page. */
export function QuickCapture() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const show = () => {
      setMsg(null);
      setOpen(true);
    };
    window.addEventListener(CAPTURE_EVENT, show);
    return () => window.removeEventListener(CAPTURE_EVENT, show);
  }, []);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => first.current?.focus());
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  if (!open) return null;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const d = await api<{ path: string }>('/api/brain-x/capture', { method: 'POST', body: { title, body } });
      setMsg({ ok: true, text: `Saved to the vault as ${d.path}` });
      setTitle('');
      setBody('');
      setTimeout(() => setOpen(false), 1200);
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-start justify-center bg-[color-mix(in_srgb,var(--os-bg)_70%,transparent)] px-4 pt-[14vh] backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <form onSubmit={save} role="dialog" aria-modal="true" aria-label="Quick capture" className="os-chamfer relative w-full max-w-lg rounded-bl-[var(--os-radius-lg)] rounded-tl-[var(--os-radius-lg)] rounded-br-[var(--os-radius-lg)] border border-os-line bg-os-surface p-5">
        <h2 className="mb-4 font-os-sans text-[18px] font-extrabold tracking-tight text-os-text">Capture a note</h2>
        <div className="grid gap-4">
          <Field label="Title (optional)" htmlFor="qc-title">
            <input id="qc-title" ref={first} value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Note" htmlFor="qc-body" hint="Goes to the 00 Inbox folder in your vault. Passwords and keys are blanked.">
            <textarea id="qc-body" rows={6} value={body} onChange={(e) => setBody(e.target.value)} className={textareaCls} />
          </Field>
          {msg && (msg.ok ? <SuccessNote>{msg.text}</SuccessNote> : <ErrorNote>{msg.text}</ErrorNote>)}
          <div className="flex gap-2">
            <Button type="submit" variant="primary" size="sm" disabled={busy || (!title.trim() && !body.trim())}>Save note</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      </form>
    </div>
  );
}
