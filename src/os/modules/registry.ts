import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { Brain, FolderSimple, GearSix, GitBranch, GitCommit, House, Robot, Rocket, Scroll, ShieldCheck, Sparkle, TerminalWindow, Timer, type Icon } from '@phosphor-icons/react';

export type ModuleGroup = 'workspace' | 'agents' | 'knowledge' | 'build' | 'system';

export const GROUPS: { id: ModuleGroup; label: string }[] = [
  { id: 'workspace', label: 'Workspace' },
  { id: 'agents', label: 'Agents' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'build', label: 'Build' },
  { id: 'system', label: 'System' },
];

export interface OsModule {
  id: string;
  label: string;
  icon: Icon;
  /** Sidebar section the module sits under. */
  group: ModuleGroup;
  component: LazyExoticComponent<ComponentType<ModuleProps>>;
  /** Cannot be switched off (the shell needs somewhere to land). */
  required?: boolean;
  description: string;
}

export interface ModuleProps {
  /** Route segments after the module id: `#/agents/claude/<id>` gives ['claude', '<id>']. */
  route: string[];
  navigate: (...parts: string[]) => void;
}

export const MODULES: OsModule[] = [
  {
    id: 'home',
    label: 'Home',
    icon: House,
    group: 'workspace',
    required: true,
    component: lazy(() => import('./home/HomePage')),
    description: 'What needs you, what is running, usage by provider, schedules and a quick start.',
  },
  {
    id: 'agents',
    label: 'Agents',
    icon: Robot,
    group: 'agents',
    required: true,
    component: lazy(() => import('./agents/AgentsPage')),
    description: 'Real Claude Code, Hermes and Antigravity sessions you can resume, stop and delete.',
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: FolderSimple,
    group: 'workspace',
    component: lazy(() => import('./projects/ProjectsPage')),
    description: 'Add folders or clone from GitHub, and build a graph for each project.',
  },
  {
    id: 'brain',
    label: 'Brain',
    icon: Brain,
    group: 'knowledge',
    component: lazy(() => import('./brain/BrainPage')),
    description: 'Terrain map of the Obsidian vault: notes are peaks, projects are summits with flags.',
  },
  {
    id: 'workflows',
    label: 'Workflows',
    icon: GitBranch,
    group: 'agents',
    component: lazy(() => import('./workflows/WorkflowsPage')),
    description: 'Orchestrator, sub-agents and reviewer working on a task.',
  },
  {
    id: 'approvals',
    label: 'Approvals',
    icon: ShieldCheck,
    group: 'agents',
    component: lazy(() => import('./approvals/ApprovalsPage')),
    description: 'Actions agents were refused permission for, waiting for your yes or no.',
  },
  {
    id: 'audit',
    label: 'Audit',
    icon: Scroll,
    group: 'system',
    component: lazy(() => import('./audit/AuditPage')),
    description: 'Searchable history of every prompt, tool call, error and run decision.',
  },
  {
    id: 'automations',
    label: 'Automations',
    icon: Timer,
    group: 'agents',
    component: lazy(() => import('./automations/AutomationsPage')),
    description: 'Run saved workflows on a schedule or when a commit lands, with history and Run now.',
  },
  {
    id: 'skills',
    label: 'Skills',
    icon: Sparkle,
    group: 'knowledge',
    component: lazy(() => import('./skills/SkillsPage')),
    description: 'Create, edit and switch on or off the skills your Claude agents can use.',
  },
  {
    id: 'git',
    label: 'Git',
    icon: GitCommit,
    group: 'build',
    component: lazy(() => import('./git/GitPage')),
    description: 'Status, stage, commit, history and branches for each project.',
  },
  {
    id: 'dev',
    label: 'Dev',
    icon: Rocket,
    group: 'build',
    component: lazy(() => import('./dev/DevPage')),
    description: 'Run a project and preview it here, and check its health.',
  },
  {
    id: 'terminal',
    label: 'Terminal',
    icon: TerminalWindow,
    group: 'build',
    component: lazy(() => import('./TerminalPage')),
    description: 'Project shell.',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: GearSix,
    group: 'system',
    required: true,
    component: lazy(() => import('./SettingsPage')),
    description: 'Modules, agent status and workspace.',
  },
];

export function findModule(id: string | undefined): OsModule | undefined {
  return MODULES.find((m) => m.id === id);
}
