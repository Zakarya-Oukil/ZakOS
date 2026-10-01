import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { Brain, ChartLineUp, CirclesFour, FileText, FolderSimple, GearSix, GitBranch, GitCommit, House, Kanban, Key, Detective, Plugs, Robot, Rocket, Scroll, ShieldCheck, Sparkle, Storefront, TerminalWindow, Timer, UsersThree, Globe, WebhooksLogo, Files, type Icon } from '@phosphor-icons/react';

export type ModuleGroup = 'workspace' | 'agents' | 'knowledge' | 'build' | 'security' | 'connect' | 'system';

export const GROUPS: { id: ModuleGroup; label: string }[] = [
  { id: 'workspace', label: 'Workspace' },
  { id: 'agents', label: 'Agents' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'build', label: 'Build' },
  { id: 'security', label: 'Security' },
  { id: 'connect', label: 'Connections' },
  { id: 'system', label: 'System' },
];

export interface OsModule {
  id: string;
  label: string;
  icon: Icon;
  /** Sidebar section the module sits under. */
  group: ModuleGroup;
  /** Needs this plan or higher. Without it the page explains what it is and how to unlock it. */
  premium?: 'pro' | 'team';
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
    id: 'tasks',
    label: 'Tasks',
    icon: Kanban,
    group: 'workspace',
    component: lazy(() => import('./tasks/TasksPage')),
    description: 'A board your agents and you share: backlog, doing, waiting on you, review, done.',
  },
  {
    id: 'files',
    label: 'Files',
    icon: Files,
    group: 'build',
    component: lazy(() => import('./files/FilesPage')),
    description: 'Browse, search, preview and edit files inside your registered projects.',
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: FileText,
    group: 'workspace',
    premium: 'pro',
    component: lazy(() => import('./reports/ReportsPage')),
    description: 'What was done, what it cost, what is open and what is next, on demand or on a schedule.',
  },
  {
    id: 'templates',
    label: 'Templates',
    icon: Storefront,
    group: 'knowledge',
    premium: 'pro',
    component: lazy(() => import('./templates/TemplatesPage')),
    description: 'Starter workflows, skills, prompts, themes and projects. Import and export as files.',
  },
  {
    id: 'cyberlab',
    label: 'CyberLab',
    icon: Detective,
    group: 'security',
    component: lazy(() => import('./cyberlab/CyberLabPage')),
    description: 'OSINT tools, investigation cases with evidence, a link graph, reports and exam study tracking.',
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: Plugs,
    group: 'connect',
    premium: 'pro',
    component: lazy(() => import('./integrations/IntegrationsPage')),
    description: 'GitHub, Telegram, Discord and Slack, with tokens in an encrypted store.',
  },
  {
    id: 'mcp',
    label: 'MCP servers',
    icon: CirclesFour,
    group: 'connect',
    premium: 'pro',
    component: lazy(() => import('./mcp/McpPage')),
    description: 'See, add, test and remove the MCP servers Claude Code can use.',
  },
  {
    id: 'webhooks',
    label: 'Webhooks and keys',
    icon: WebhooksLogo,
    group: 'connect',
    premium: 'pro',
    component: lazy(() => import('./webhooks/WebhooksPage')),
    description: 'Signed inbound webhooks with a request log and replay, plus a personal API key.',
  },
  {
    id: 'remote',
    label: 'Remote access',
    icon: Globe,
    group: 'connect',
    premium: 'team',
    component: lazy(() => import('./remote/RemotePage')),
    description: 'Approve agent actions from your phone through Tailscale or a Cloudflare tunnel.',
  },
  {
    id: 'usage',
    label: 'Usage and cost',
    icon: ChartLineUp,
    group: 'system',
    component: lazy(() => import('./usage/UsagePage')),
    description: 'Spend by day, model and session, budgets, and plan windows with a forecast.',
  },
  {
    id: 'team',
    label: 'Team',
    icon: UsersThree,
    group: 'system',
    premium: 'team',
    component: lazy(() => import('./team/TeamPage')),
    description: 'Local accounts with Owner, Operator and Viewer roles.',
  },
  {
    id: 'licence',
    label: 'Licence',
    icon: Key,
    group: 'system',
    required: true,
    component: lazy(() => import('./licence/LicencePage')),
    description: 'Your plan, licence key, updates and upgrade link.',
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
