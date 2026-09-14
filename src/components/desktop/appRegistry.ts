import { AppDefinition } from '../../types/desktop';

// CyberOS Apps
import { SpiderReconApp } from '../os_apps/cyber/SpiderReconApp';
import { PayloadForgeApp } from '../os_apps/cyber/PayloadForgeApp';
import { TargetMatrixApp } from '../os_apps/cyber/TargetMatrixApp';
import { CveHunterApp } from '../os_apps/cyber/CveHunterApp';
import { EjptAssistantApp } from '../os_apps/cyber/EjptAssistantApp';

// StudyOS Apps
import { SocratesTutorApp } from '../os_apps/study/SocratesTutorApp';
import { FlashcardsApp } from '../os_apps/study/FlashcardsApp';
import { DocSynthesizerApp } from '../os_apps/study/DocSynthesizerApp';
import { StudyStudioApp } from '../os_apps/study/StudyStudioApp';

// DevOS Apps
import { TacticalDevTerminalApp } from '../os_apps/dev/TacticalDevTerminalApp';
import { GitMatrixApp } from '../os_apps/dev/GitMatrixApp';
import { DockerFleetApp } from '../os_apps/dev/DockerFleetApp';
import { ApiLabApp } from '../os_apps/dev/ApiLabApp';

// AgenticOS Apps
import { JarvisCommanderApp } from '../os_apps/agentic/JarvisCommanderApp';
import { AgentCouncilApp } from '../os_apps/agentic/AgentCouncilApp';
import { ModelRouterApp } from '../os_apps/agentic/ModelRouterApp';
import { UniverseGraphApp } from '../os_apps/agentic/UniverseGraphApp';

// FounderOS Apps
import { GbrainMemoryApp } from '../os_apps/founder/GbrainMemoryApp';
import { ProjectPipelineApp } from '../os_apps/founder/ProjectPipelineApp';
import { FinanceMonitorApp } from '../os_apps/founder/FinanceMonitorApp';

export const ALL_APPS: AppDefinition[] = [
  // -------------------------------------------------------------
  // 🛡️ CYBER_OS APPS (Zak's Spider Suite)
  // -------------------------------------------------------------
  {
    id: 'cyber-spider',
    title: "Zak's Spider Recon",
    iconName: 'spider',
    os: 'cyber',
    category: 'Offensive Recon',
    description: 'Automated web crawler, endpoint discovery, and fuzzing.',
    defaultWidth: 720,
    defaultHeight: 520,
    defaultX: 80,
    defaultY: 80,
    component: SpiderReconApp,
    isPinned: true
  },
  {
    id: 'cyber-target-matrix',
    title: 'Target & Subnet Matrix',
    iconName: 'recon',
    os: 'cyber',
    category: 'Target Intel',
    description: 'Subnet map and open port visualizer.',
    defaultWidth: 760,
    defaultHeight: 520,
    defaultX: 120,
    defaultY: 100,
    component: TargetMatrixApp,
    isPinned: true
  },
  {
    id: 'cyber-payload-forge',
    title: 'Payload & RevShell Forge',
    iconName: 'Shield',
    os: 'cyber',
    category: 'Exploitation',
    description: 'One-click reverse shell and payload generator.',
    defaultWidth: 680,
    defaultHeight: 500,
    defaultX: 160,
    defaultY: 120,
    component: PayloadForgeApp,
    isPinned: true
  },
  {
    id: 'cyber-cve-hunter',
    title: 'CVE & Exploit-DB Hunter',
    iconName: 'recon',
    os: 'cyber',
    category: 'Vulnerability Intel',
    description: 'Search CVEs, CVSS scores, and Metasploit modules.',
    defaultWidth: 680,
    defaultHeight: 480,
    defaultX: 200,
    defaultY: 140,
    component: CveHunterApp
  },
  {
    id: 'cyber-ejpt-qa',
    title: 'eJPT / Lab Q&A Engine',
    iconName: 'FileText',
    os: 'cyber',
    category: 'Assessment & Labs',
    description: '33 verified exam questions with technical evidence.',
    defaultWidth: 720,
    defaultHeight: 540,
    defaultX: 240,
    defaultY: 90,
    component: EjptAssistantApp,
    isPinned: true
  },

  // -------------------------------------------------------------
  // 📚 STUDY_OS APPS (Academic & Socrates Mentor)
  // -------------------------------------------------------------
  {
    id: 'study-socrates',
    title: 'Socrates AI Mentor',
    iconName: 'socrates',
    os: 'study',
    category: 'Socratic Mentorship',
    description: 'Conversational tutor for oral boards and concept testing.',
    defaultWidth: 680,
    defaultHeight: 520,
    defaultX: 90,
    defaultY: 80,
    component: SocratesTutorApp,
    isPinned: true
  },
  {
    id: 'study-flashcards',
    title: 'Spaced Repetition Decks',
    iconName: 'study',
    os: 'study',
    category: 'Active Recall',
    description: 'Leitner flashcards generated from Obsidian notes.',
    defaultWidth: 640,
    defaultHeight: 480,
    defaultX: 140,
    defaultY: 110,
    component: FlashcardsApp,
    isPinned: true
  },
  {
    id: 'study-synthesizer',
    title: 'Document Synthesizer',
    iconName: 'study',
    os: 'study',
    category: 'Deep Synthesis',
    description: 'Synthesize PDFs and lectures into mental models.',
    defaultWidth: 700,
    defaultHeight: 500,
    defaultX: 180,
    defaultY: 130,
    component: DocSynthesizerApp
  },
  {
    id: 'study-studio',
    title: 'Obsidian Study Studio',
    iconName: 'notes',
    os: 'study',
    category: 'Knowledge Authoring',
    description: 'Distraction-free Markdown editor synced with vault.',
    defaultWidth: 680,
    defaultHeight: 520,
    defaultX: 220,
    defaultY: 100,
    component: StudyStudioApp,
    isPinned: true
  },

  // -------------------------------------------------------------
  // 💻 DEV_OS APPS (Fullstack & DevOps Cockpit)
  // -------------------------------------------------------------
  {
    id: 'dev-terminal',
    title: 'Tactical Dev Terminal',
    iconName: 'terminal',
    os: 'dev',
    category: 'Interactive Shell',
    description: 'PowerShell / Bash interactive execution terminal.',
    defaultWidth: 750,
    defaultHeight: 520,
    defaultX: 80,
    defaultY: 80,
    component: TacticalDevTerminalApp,
    isPinned: true
  },
  {
    id: 'dev-git',
    title: 'Git Matrix Visualizer',
    iconName: 'terminal',
    os: 'dev',
    category: 'Version Control',
    description: 'Visual branches, diffs, and commit controller.',
    defaultWidth: 680,
    defaultHeight: 480,
    defaultX: 130,
    defaultY: 110,
    component: GitMatrixApp,
    isPinned: true
  },
  {
    id: 'dev-docker',
    title: 'Docker & Services Fleet',
    iconName: 'telemetry',
    os: 'dev',
    category: 'Container Operations',
    description: 'Inspect live container daemons and ports.',
    defaultWidth: 700,
    defaultHeight: 460,
    defaultX: 180,
    defaultY: 140,
    component: DockerFleetApp,
    isPinned: true
  },
  {
    id: 'dev-api-lab',
    title: 'API Lab & REST Client',
    iconName: 'telemetry',
    os: 'dev',
    category: 'Network Engineering',
    description: 'Postman-style HTTP/WebSocket request builder.',
    defaultWidth: 680,
    defaultHeight: 500,
    defaultX: 220,
    defaultY: 100,
    component: ApiLabApp
  },

  // -------------------------------------------------------------
  // 🧠 AGENTIC_OS APPS (JARVIS Central Fleet Command)
  // -------------------------------------------------------------
  {
    id: 'agentic-jarvis',
    title: 'JARVIS Master Core',
    iconName: 'jarvis',
    os: 'agentic',
    category: 'Primary Executive',
    description: 'Conversational voice HUD and autonomous directives.',
    defaultWidth: 720,
    defaultHeight: 540,
    defaultX: 90,
    defaultY: 70,
    component: JarvisCommanderApp,
    isPinned: true
  },
  {
    id: 'agentic-council',
    title: 'The Agent Council',
    iconName: 'agent',
    os: 'agentic',
    category: 'Fleet Orchestration',
    description: 'Roster of specialized autonomous agents.',
    defaultWidth: 720,
    defaultHeight: 520,
    defaultX: 140,
    defaultY: 100,
    component: AgentCouncilApp,
    isPinned: true
  },
  {
    id: 'agentic-model-router',
    title: 'Universal Model Router',
    iconName: 'ai',
    os: 'agentic',
    category: 'AI Switchboard',
    description: 'Gemini 2.5/3.7 + Ollama local model fallback.',
    defaultWidth: 700,
    defaultHeight: 520,
    defaultX: 190,
    defaultY: 120,
    component: ModelRouterApp,
    isPinned: true
  },
  {
    id: 'agentic-universe-graph',
    title: '3D Knowledge Universe',
    iconName: 'Compass',
    os: 'agentic',
    category: 'Neural Visualization',
    description: '3D interactive Force Graph of all 123+ vault notes.',
    defaultWidth: 760,
    defaultHeight: 540,
    defaultX: 230,
    defaultY: 80,
    component: UniverseGraphApp,
    isPinned: true
  },

  // -------------------------------------------------------------
  // 💼 FOUNDER_OS APPS (Operations & Memory Governance)
  // -------------------------------------------------------------
  {
    id: 'founder-gbrain',
    title: 'G-Brain & Memory Hub',
    iconName: 'founder',
    os: 'founder',
    category: 'Memory Governance',
    description: 'Truth lifecycle from signals to durable memories.',
    defaultWidth: 720,
    defaultHeight: 500,
    defaultX: 90,
    defaultY: 80,
    component: GbrainMemoryApp,
    isPinned: true
  },
  {
    id: 'founder-pipeline',
    title: 'Engineering Pipeline',
    iconName: 'projects',
    os: 'founder',
    category: 'Project Execution',
    description: 'Milestone tracker for all active software initiatives.',
    defaultWidth: 680,
    defaultHeight: 480,
    defaultX: 140,
    defaultY: 110,
    component: ProjectPipelineApp,
    isPinned: true
  },
  {
    id: 'founder-finance',
    title: 'Infrastructure & Budget',
    iconName: 'founder',
    os: 'founder',
    category: 'Operations',
    description: 'Cloud hosting, API tokens, and subscription runway.',
    defaultWidth: 660,
    defaultHeight: 460,
    defaultX: 190,
    defaultY: 130,
    component: FinanceMonitorApp
  }
];
