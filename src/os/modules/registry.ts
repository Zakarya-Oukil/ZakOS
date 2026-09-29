import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { Bot, Brain, GitBranch, Settings, SquareTerminal, type LucideIcon } from 'lucide-react';

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
    id: 'agents',
    label: 'Agents',
    icon: Bot,
    required: true,
    component: lazy(() => import('./agents/AgentsPage')),
    description: 'Real Claude Code and Hermes sessions you can resume, stop and delete.',
  },
  {
    id: 'brain',
    label: 'Brain',
    icon: Brain,
    component: lazy(() => import('./BrainPage')),
    description: '3D neural-galaxy view of the Obsidian vault.',
  },
  {
    id: 'workflows',
    label: 'Workflows',
    icon: GitBranch,
    component: lazy(() => import('./WorkflowsPage')),
    description: 'Orchestrator, sub-agents and reviewer working on a task.',
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
