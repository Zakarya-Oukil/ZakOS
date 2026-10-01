import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import { Button, ErrorNote, Field, inputCls } from '../ui';
import { api } from '../lib/api';
import { projectsApi, type ProjectInfo } from '../lib/projectsApi';
import { ACCENTS, setAppearance, useAppearance } from '../theme/appearance';
import { usePrefersReducedMotion } from '../theme/motion';
import { Topography } from './Topography';
import type { Theme } from '../theme/useTheme';

export const SETUP_KEY = 'zakos_setup_done';
export const NAME_KEY = 'zakos_profile_name';

export function setupDone(): boolean {
  try {
    return window.localStorage.getItem(SETUP_KEY) === '1';
  } catch {
    return true;
  }
}

interface Provider {
  id: string;
  label: string;
  available: boolean;
  version: string | null;
  reason: string | null;
}

const STEPS = ['Welcome', 'Agents', 'First project', 'Look', 'Vault'] as const;

export function SetupWizard({ theme, onTheme, onDone }: { theme: Theme; onTheme: () => void; onDone: () => void }) {
  const reduced = usePrefersReducedMotion();
  const { appearance } = useAppearance();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(() => {
    try {
      return window.localStorage.getItem(NAME_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [path, setPath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [vault, setVault] = useState<{ ok: boolean; notes?: number } | null>(null);

  useEffect(() => {
    api<{ home: { providers: Provider[] } }>('/api/home').then((d) => setProviders(d.home.providers)).catch(() => setProviders([]));
    projectsApi.list().then(setProjects).catch(() => undefined);
    api<{ stats: { totalNotes: number } }>('/api/vault/overview').then((d) => setVault({ ok: true, notes: d.stats.totalNotes })).catch(() => setVault({ ok: false }));
  }, []);

  const finish = () => {
    try {
      window.localStorage.setItem(SETUP_KEY, '1');
      if (name.trim()) window.localStorage.setItem(NAME_KEY, name.trim());
    } catch {
      /* storage blocked: the wizard may show again */
    }
    onDone();
  };

  const addProject = async () => {
    setError(null);
    try {
      const p = await projectsApi.add(path.trim());
      setProjects((l) => [...l, p]);
      setPath('');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const browse = async () => {
    const p = await projectsApi.pickFolder('Pick a project folder').catch(() => null);
    if (p) setPath(p);
  };

  const container = { hidden: {}, show: { transition: { staggerChildren: reduced ? 0 : 0.09 } } };
  const word = { hidden: { opacity: 0, y: reduced ? 0 : 28 }, show: { opacity: 1, y: 0, transition: { duration: reduced ? 0.01 : 0.7, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } } };

  return (
    <div role="dialog" aria-modal="true" aria-label="Set up Zak OS" className="fixed inset-0 z-[60] overflow-y-auto bg-os-bg">
      <Topography className="pointer-events-none fixed inset-0 h-full w-full" />
      <div className="relative mx-auto grid min-h-[100dvh] max-w-3xl content-center gap-8 px-6 py-10">
        <ol className="flex flex-wrap gap-x-5 gap-y-1 text-[13px]" aria-label="Setup steps">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === step ? 'step' : undefined} className={i === step ? 'font-semibold text-os-text' : i < step ? 'text-os-ok' : 'text-os-muted'}>
              {s}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <motion.div variants={container} initial="hidden" animate="show" className="grid gap-6">
            <h1 className="font-os-sans text-[56px] font-extrabold leading-[1.02] tracking-[-0.03em] text-os-text">
              {['Your', 'map', 'room', 'for', 'working', 'with', 'agents.'].map((w) => (
                <motion.span key={w} variants={word} className="mr-[0.25em] inline-block">
                  {w}
                </motion.span>
              ))}
            </h1>
            <motion.p variants={word} className="max-w-[48ch] text-[17px] leading-relaxed text-os-muted">
              Zak OS runs real coding agents on this machine, keeps every session, and asks before anything risky. Setup takes about a minute and you can skip any step.
            </motion.p>
            <motion.div variants={word} className="max-w-sm">
              <Field label="What should we call you?" htmlFor="sw-name">
                <input id="sw-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
              </Field>
            </motion.div>
          </motion.div>
        )}

        {step === 1 && (
          <div className="grid gap-5">
            <h2 className="font-os-sans text-[34px] font-extrabold tracking-tight text-os-text">Your agents</h2>
            <p className="max-w-[56ch] text-[15px] text-os-muted">Zak OS uses the command line tools you are already signed in to. No API keys are stored here.</p>
            <ul className="grid gap-2">
              {(providers ?? []).map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-[var(--os-radius)] border border-os-line bg-os-surface px-4 py-3">
                  {p.available ? <CheckCircle size={22} className="shrink-0 text-os-ok" aria-hidden /> : <WarningCircle size={22} className="shrink-0 text-os-amber" aria-hidden />}
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium text-os-text">{p.label}</p>
                    <p className="text-xs text-os-muted">{p.available ? (p.version ? `Found, version ${p.version}` : 'Found') : p.reason ?? 'Not found on this machine'}</p>
                  </div>
                </li>
              ))}
              {providers === null && <li className="text-sm text-os-muted">Looking for agents</li>}
            </ul>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-5">
            <h2 className="font-os-sans text-[34px] font-extrabold tracking-tight text-os-text">Add your first project</h2>
            <p className="max-w-[56ch] text-[15px] text-os-muted">A project is a folder on disk. Agents run inside it and it appears on your Home map.</p>
            {projects.length > 0 && (
              <ul className="grid gap-1.5 text-sm text-os-text">
                {projects.map((p) => (
                  <li key={p.id} className="flex items-center gap-2"><CheckCircle size={18} className="text-os-ok" aria-hidden /> {p.name}</li>
                ))}
              </ul>
            )}
            <div className="flex max-w-xl gap-2">
              <label htmlFor="sw-path" className="sr-only">Project folder</label>
              <input id="sw-path" value={path} onChange={(e) => setPath(e.target.value)} placeholder="C:\Users\you\Projects\my-app" className={inputCls} />
              <Button size="sm" onClick={browse}>Browse</Button>
              <Button size="sm" variant="primary" onClick={addProject} disabled={!path.trim()}>Add</Button>
            </div>
            {error && <ErrorNote>{error}</ErrorNote>}
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-6">
            <h2 className="font-os-sans text-[34px] font-extrabold tracking-tight text-os-text">Choose a look</h2>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[13px] font-medium text-os-text">Theme</span>
              {(['dark', 'light'] as Theme[]).map((t) => (
                <Button key={t} size="sm" variant={theme === t ? 'primary' : 'outline'} aria-pressed={theme === t} onClick={() => theme !== t && onTheme()}>
                  {t === 'dark' ? 'Dark' : 'Light'}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[13px] font-medium text-os-text">Accent</span>
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  aria-label={a.label}
                  aria-pressed={appearance.accent === a.id}
                  onClick={() => setAppearance({ accent: a.id })}
                  style={{ backgroundColor: theme === 'dark' ? a.dark : a.light }}
                  className="h-9 w-9 rounded-full ring-offset-2 ring-offset-[var(--os-bg)] transition-shadow focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)] aria-pressed:ring-2 aria-pressed:ring-[var(--os-text)]"
                />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[13px] font-medium text-os-text">Motion</span>
              {(['full', 'calm', 'off'] as const).map((m) => (
                <Button key={m} size="sm" variant={appearance.motion === m ? 'primary' : 'outline'} aria-pressed={appearance.motion === m} onClick={() => setAppearance({ motion: m })}>
                  {m === 'full' ? 'Full' : m === 'calm' ? 'Calm' : 'Off'}
                </Button>
              ))}
            </div>
            <p className="text-sm text-os-muted">You can change all of this later in Settings.</p>
          </div>
        )}

        {step === 4 && (
          <div className="grid gap-5">
            <h2 className="font-os-sans text-[34px] font-extrabold tracking-tight text-os-text">Your notes vault</h2>
            <p className="max-w-[56ch] text-[15px] text-os-muted">The Brain tab turns your Obsidian vault into a terrain map, and agents can read it for context.</p>
            <p className="flex items-center gap-3 rounded-[var(--os-radius)] border border-os-line bg-os-surface px-4 py-3 text-[15px] text-os-text">
              {vault?.ok ? <CheckCircle size={22} className="text-os-ok" aria-hidden /> : <WarningCircle size={22} className="text-os-amber" aria-hidden />}
              {vault === null ? 'Checking' : vault.ok ? `Connected, ${vault.notes} notes found.` : 'No vault found yet. The Brain tab stays empty until one is connected.'}
            </p>
          </div>
        )}

        <div className="flex items-center gap-3">
          {step > 0 && <Button variant="ghost" onClick={() => setStep(step - 1)}>Back</Button>}
          {step < STEPS.length - 1 ? (
            <Button variant="primary" onClick={() => setStep(step + 1)}>
              {step === 0 ? 'Start' : 'Continue'} <ArrowRight size={16} aria-hidden />
            </Button>
          ) : (
            <Button variant="primary" onClick={finish}>Open Zak OS</Button>
          )}
          <button type="button" onClick={finish} className="ml-auto text-sm text-os-muted underline underline-offset-4 hover:text-os-text focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]">
            Skip setup
          </button>
        </div>
      </div>
    </div>
  );
}
