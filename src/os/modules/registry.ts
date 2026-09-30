import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { Bot, Brain, FolderGit2, GitBranch, GitCommitHorizontal, House, Rocket, Sparkles, Timer, ScrollText, ShieldCheck, Settings, SquareTerminal, type LucideIcon } from 'lucide-react';

export interface OsModule {
  id: string;
  label: string;
  icon: LucideIcon;
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
    required: true,
    component: lazy(() => import('./home/HomePage')),
    description: 'What needs you, what is running, usage by provider, schedules and a quick start.',
  },
  {
    id: 'agents',
    label: 'Agents',
    icon: Bot,
    required: true,
    component: lazy(() => import('./agents/AgentsPage')),
    description: 'Real Claude Code, Hermes and Antigravity sessions you can resume, stop and delete.',
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: FolderGit2,
    component: lazy(() => import('./projects/ProjectsPage')),
    description: 'Add folders or clone from GitHub, and build a graph for each project.',
  },
  {
    id: 'brain',
    label: 'Brain',
    icon: Brain,
    component: lazy(() => import('./brain/BrainPage')),
    description: '3D galaxy of the Obsidian vault, with each project as its own star.',
  },
  {
    id: 'workflows',
    label: 'Workflows',
    icon: GitBranch,
    component: lazy(() => import('./workflows/WorkflowsPage')),
    description: 'Orchestrator, sub-agents and reviewer working on a task.',
  },
  {
    id: 'approvals',
    label: 'Approvals',
    icon: ShieldCheck,
    component: lazy(() => import('./approvals/ApprovalsPage')),
    description: 'Actions agents were refused permission for, waiting for your yes or no.',
  },
  {
    id: 'audit',
    label: 'Audit',
    icon: ScrollText,
    component: lazy(() => import('./audit/AuditPage')),
    description: 'Searchable history of every prompt, tool call, error and run decision.',
  },
  {
    id: 'automations',
    label: 'Automations',
    icon: Timer,
    component: lazy(() => import('./automations/AutomationsPage')),
    description: 'Run saved workflows on a schedule or when a commit lands, with history and Run now.',
  },
  {
    id: 'skills',
    label: 'Skills',
    icon: Sparkles,
    component: lazy(() => import('./skills/SkillsPage')),
    description: 'Create, edit and switch on or off the skills your Claude agents can use.',
  },
  {
    id: 'git',
    label: 'Git',
    icon: GitCommitHorizontal,
    component: lazy(() => import('./git/GitPage')),
    description: 'Status, stage, commit, history and branches for each project.',
  },
  {
    id: 'dev',
    label: 'Dev',
    icon: Rocket,
    component: lazy(() => import('./dev/DevPage')),
    description: 'Run a project and preview it here, and check its health.',
  },
  {
    id: 'terminal',
    label: 'Terminal',
    icon: SquareTerminal,
    component: lazy(() => import('./TerminalPage')),
    description: 'Project shell.',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    required: true,
    component: lazy(() => import('./SettingsPage')),
    description: 'Modules, agent status and workspace.',
  },
];

export function findModule(id: string | undefined): OsModule | undefined {
  return MODULES.find((m) => m.id === id);
}
