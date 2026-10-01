import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ModuleContext } from './lib/moduleContext';
import { useAgentsConnection } from './lib/agentsSocket';
import { useHashRoute } from './lib/router';
import { useModuleState } from './lib/useModuleState';
import { MODULES, findModule } from './modules/registry';
import { Sidebar } from './shell/Sidebar';
import { Topography } from './shell/Topography';
import { useTheme } from './theme/useTheme';
import { useAppearance } from './theme/appearance';
import { useAuth } from './lib/useAuth';
import { planAtLeast, useLicence } from './lib/useLicence';
import { Locked, SignIn } from './shell/Gates';
import { RemoteShell } from './shell/RemoteShell';
import { SetupWizard, setupDone } from './shell/SetupWizard';
import { useShortcutListener } from './lib/shortcuts';
import { CAPTURE_EVENT, QuickCapture } from './shell/QuickCapture';
import { bootSequence } from './theme/gsap';
import { pageVariants, reducedPageVariants, usePrefersReducedMotion } from './theme/motion';
import { CommandPalette, type Command } from './ui';

const LegacyApp = lazy(() => import('../legacy/App').then((m) => ({ default: m.App })));

const COLLAPSE_KEY = 'zakos_os_sidebar_collapsed';

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

function PageFallback() {
  return (
    <div className="grid h-full place-items-center text-sm text-os-muted" role="status">
      Loading
    </div>
  );
}

export function Shell() {
  const { segments, navigate } = useHashRoute();
  const modules = useModuleState();
  const connected = useAgentsConnection();
  const reduced = usePrefersReducedMotion();
  const { theme, toggle: toggleTheme } = useTheme();
  const { appearance } = useAppearance();
  const auth = useAuth();
  const licence = useLicence();
  const [showSetup, setShowSetup] = useState(() => !setupDone());
  const remoteView = !['localhost', '127.0.0.1', '[::1]', '::1'].includes(window.location.hostname) || new URLSearchParams(window.location.search).has('phone');
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const rootRef = useRef<HTMLDivElement>(null);

  const [first, ...rest] = segments;
  const visible = useMemo(() => MODULES.filter((m) => modules.isEnabled(m.id)), [modules]);
  const isLegacy = first === 'legacy';
  const active = findModule(first) && modules.isEnabled(first!) ? findModule(first)! : visible[0];

  // Land on the first module when the hash is empty or points at a disabled/unknown one.
  useEffect(() => {
    if (!isLegacy && active && first !== active.id) navigate(active.id);
  }, [isLegacy, active, first, navigate]);

  useEffect(() => {
    const tl = bootSequence(rootRef.current);
    return () => {
      tl?.kill();
    };
  }, []);

  // While the setup dialog is open the app behind it cannot be tabbed into or read by a screen reader.
  useEffect(() => {
    const nodes = rootRef.current?.querySelectorAll(':scope > nav, :scope > main');
    nodes?.forEach((n) => (showSetup ? n.setAttribute('inert', '') : n.removeAttribute('inert')));
  }, [showSetup]);

  const toggleSidebar = () =>
    setCollapsed((c) => {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      } catch {
        /* storage blocked */
      }
      return !c;
    });

  const commands: Command[] = useMemo(
    () => [
      ...visible.map((m) => ({ id: `go-${m.id}`, label: `Go to ${m.label}`, hint: m.description, run: () => navigate(m.id) })),
      { id: 'capture', label: 'Capture a note to the vault', run: () => window.dispatchEvent(new Event(CAPTURE_EVENT)) },
      { id: 'toggle-theme', label: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme', run: toggleTheme },
      { id: 'toggle-sidebar', label: collapsed ? 'Expand sidebar' : 'Collapse sidebar', run: toggleSidebar },
      { id: 'legacy', label: 'Open legacy UI', run: () => navigate('legacy') },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible, collapsed, navigate, theme],
  );

  useShortcutListener({
    'toggle-sidebar': toggleSidebar,
    'toggle-theme': toggleTheme,
    'quick-capture': () => window.dispatchEvent(new Event(CAPTURE_EVENT)),
    ...Object.fromEntries(['home', 'agents', 'tasks', 'projects', 'brain', 'approvals', 'terminal'].map((id) => [`go-${id}`, () => visible.some((m) => m.id === id) && navigate(id)])),
  });

  // Someone opening Zak OS through a tunnel gets the phone view only.
  if (remoteView) return <RemoteShell />;
  if (auth.loaded && auth.enabled && !auth.user) return <SignIn />;

  if (isLegacy) {
    return (
      <div className="relative h-full w-full">
        <Suspense fallback={<PageFallback />}>
          <LegacyApp />
        </Suspense>
        <a
          href="#/agents"
          className="fixed left-3 top-3 z-50 rounded-[var(--os-radius)] border border-os-line bg-os-surface px-3 py-1.5 font-os-sans text-xs text-os-text hover:bg-os-surface-2 focus-visible:outline-none focus-visible:shadow-[var(--os-focus-ring)]"
        >
          Back to Zak OS
        </a>
      </div>
    );
  }

  const Page = active?.component;

  return (
    <ModuleContext.Provider value={modules}>
      <div ref={rootRef} className="relative flex h-[100dvh] w-full font-os-sans text-os-text">
        {appearance.backdrop !== 'none' && (
          <Topography className="pointer-events-none fixed inset-0 h-full w-full" still={appearance.backdrop === 'still' || appearance.motion === 'off'} calm={appearance.motion === 'calm'} />
        )}
        <Sidebar
          modules={visible}
          activeId={active?.id}
          collapsed={collapsed}
          onToggle={toggleSidebar}
          connected={connected}
          theme={theme}
          onToggleTheme={toggleTheme}
          plan={licence.plan}
        />
        <main className="relative min-w-0 flex-1">
          {Page && (
            <motion.div
              key={active.id}
              className="h-full"
              variants={reduced ? reducedPageVariants : pageVariants}
              initial="initial"
              animate="animate"
            >
              <Suspense fallback={<PageFallback />}>
                {active.premium && licence.info && !planAtLeast(licence.plan, active.premium) ? (
                  <Locked module={active} info={licence.info} />
                ) : (
                  <Page route={rest} navigate={navigate} />
                )}
              </Suspense>
            </motion.div>
          )}
        </main>
        <CommandPalette commands={commands} />
        <QuickCapture />
        {showSetup && <SetupWizard theme={theme} onTheme={toggleTheme} onDone={() => setShowSetup(false)} />}
      </div>
    </ModuleContext.Provider>
  );
}
