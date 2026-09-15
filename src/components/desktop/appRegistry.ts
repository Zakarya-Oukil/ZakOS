import { AppDefinition, DesktopFolderDefinition } from '../../types/desktop';

// Common Apps
import { ObsidianVaultApp } from '../os_apps/common/ObsidianVaultApp';

// CyberOS Apps
import { SpiderReconApp } from '../os_apps/cyber/SpiderReconApp';
import { GodsEyeApp } from '../os_apps/cyber/GodsEyeApp';
import { PayloadForgeApp } from '../os_apps/cyber/PayloadForgeApp';
import { TargetMatrixApp } from '../os_apps/cyber/TargetMatrixApp';
import { CveHunterApp } from '../os_apps/cyber/CveHunterApp';
import { EjptAssistantApp } from '../os_apps/cyber/EjptAssistantApp';
import { CyberAdminApp } from '../os_apps/cyber/CyberAdminApp';

// StudyOS Apps
import { SocratesTutorApp } from '../os_apps/study/SocratesTutorApp';
import { FlashcardsApp } from '../os_apps/study/FlashcardsApp';
import { DocSynthesizerApp } from '../os_apps/study/DocSynthesizerApp';
import { StudyStudioApp } from '../os_apps/study/StudyStudioApp';
import { StudentWorkstationApp } from '../os_apps/study/StudentWorkstationApp';

// DevOS Apps
import { MonacoIdeApp } from '../os_apps/dev/MonacoIdeApp';
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
import { ProjectsTrackerApp } from '../os_apps/founder/ProjectsTrackerApp';
import { ProjectPipelineApp } from '../os_apps/founder/ProjectPipelineApp';
import { FinanceMonitorApp } from '../os_apps/founder/FinanceMonitorApp';

export const ALL_APPS: AppDefinition[] = [
  // -------------------------------------------------------------
  // 🛡️ CYBER_OS APPS (Zak's Spider Suite)
  // -------------------------------------------------------------
  {
    id: 'cyber-admin',
    title: 'Cyber Operations & Admin C2',
    iconName: 'Shield',
    os: 'cyber',
    category: 'Administrative Command',
    description: 'Master operations hub: background daemons, reverse shell listeners, RoE target scope lock, OPSEC audit trail, and tactical forensics arsenal.',
    defaultWidth: 840,
    defaultHeight: 600,
    defaultX: 60,
    defaultY: 60,
    component: CyberAdminApp,
    isPinned: true
  },
  {
    id: 'cyber-spider',
    title: "Zak's Spider Recon",
    iconName: 'spider',
    os: 'cyber',
    category: 'Offensive Recon',
    description: 'Automated web crawler, endpoint discovery, port scanning, and DNS fuzzing.',
    defaultWidth: 740,
    defaultHeight: 530,
    defaultX: 80,
    defaultY: 80,
    component: SpiderReconApp,
    isPinned: true
  },
  {
    id: 'cyber-godseye',
    title: "God's Eye 3D GEOINT",
    iconName: 'globe',
    os: 'cyber',
    category: 'Tactical Recon & Surveillance',
    description: 'Cesium 3D Globe with Google Photorealistic mesh, live CCTV viewshed frustums, ADS-B flight radar, satellites, and FLIR/NVG optics.',
    defaultWidth: 920,
    defaultHeight: 640,
    defaultX: 70,
    defaultY: 50,
    component: GodsEyeApp,
    isPinned: true
  },
  {
    id: 'cyber-target-matrix',
    title: 'Target & Subnet Matrix',
    iconName: 'recon',
    os: 'cyber',
    category: 'Target Intel',
    description: 'Subnet map, target dossiers, and live open port visualizer.',
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
    description: 'Reverse shell generator in 9 languages, Msfvenom commands, and evasion encoders.',
    defaultWidth: 700,
    defaultHeight: 520,
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
    description: 'Search CVEs, CVSS scores, POC exploits, and Metasploit modules.',
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
    description: '33 verified exam questions with technical proof, credentials, and evidence.',
    defaultWidth: 720,
    defaultHeight: 540,
    defaultX: 240,
    defaultY: 90,
    component: EjptAssistantApp,
    isPinned: true
  },
  {
    id: 'cyber-vault',
    title: 'Cyber Warfare Vault',
    iconName: 'vault',
    os: 'cyber',
    category: 'Knowledge Base',
    description: 'Obsidian notes filtered for penetration testing, target dossiers, and lab writeups.',
    defaultWidth: 800,
    defaultHeight: 560,
    defaultX: 180,
    defaultY: 80,
    component: ObsidianVaultApp,
    isPinned: true
  },

  // -------------------------------------------------------------
  // 📚 STUDY_OS APPS (Academic & Socrates Mentor)
  // -------------------------------------------------------------
  {
    id: 'study-curriculum',
    title: 'Curriculum & Notion Notepad',
    iconName: 'study',
    os: 'study',
    category: 'Academic Workstation',
    description: 'Dynamic certification syllabus, editable modules, task milestones, and Notion-style Markdown notepad.',
    defaultWidth: 900,
    defaultHeight: 620,
    defaultX: 70,
    defaultY: 50,
    component: StudentWorkstationApp,
    isPinned: true
  },
  {
    id: 'study-socrates',
    title: 'Socrates AI Mentor',
    iconName: 'socrates',
    os: 'study',
    category: 'Socratic Mentorship',
    description: 'Conversational tutor for deep philosophical questioning and exam preparation.',
    defaultWidth: 700,
    defaultHeight: 530,
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
    description: 'SM-2 Leitner flashcards generated from Obsidian notes with retention telemetry.',
    defaultWidth: 660,
    defaultHeight: 500,
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
    description: 'Synthesize research papers, PDFs, and lectures into durable mental models.',
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
    description: 'Distraction-free Markdown editor synced with live Obsidian vault.',
    defaultWidth: 700,
    defaultHeight: 530,
    defaultX: 220,
    defaultY: 100,
    component: StudyStudioApp,
    isPinned: true
  },
  {
    id: 'study-vault',
    title: 'Academic Obsidian Vault',
    iconName: 'vault',
    os: 'study',
    category: 'Knowledge Base',
    description: 'Full Obsidian vault browser filtered for study notes and academic research.',
    defaultWidth: 800,
    defaultHeight: 560,
    defaultX: 160,
    defaultY: 80,
    component: ObsidianVaultApp,
    isPinned: true
  },

  // -------------------------------------------------------------
  // 💻 DEV_OS APPS (Fullstack & DevOps Cockpit)
  // -------------------------------------------------------------
  {
    id: 'dev-ide',
    title: 'Monaco Code IDE',
    iconName: 'terminal',
    os: 'dev',
    category: 'Software Engineering',
    description: 'Full-featured Monaco code editor with file tree, terminal, Git, and AI coding assistant.',
    defaultWidth: 840,
    defaultHeight: 580,
    defaultX: 60,
    defaultY: 50,
    component: MonacoIdeApp,
    isPinned: true
  },
  {
    id: 'dev-terminal',
    title: 'Tactical Dev Terminal',
    iconName: 'terminal',
    os: 'dev',
    category: 'Interactive Shell',
    description: 'PowerShell / Bash interactive execution terminal with preset scripts and telemetry.',
    defaultWidth: 750,
    defaultHeight: 520,
    defaultX: 100,
    defaultY: 90,
    component: TacticalDevTerminalApp,
    isPinned: true
  },
  {
    id: 'dev-git',
    title: 'Git Matrix Visualizer',
    iconName: 'terminal',
    os: 'dev',
    category: 'Version Control',
    description: 'Visual branches, diffs, GitHub portfolio repositories, and commit controller.',
    defaultWidth: 720,
    defaultHeight: 500,
    defaultX: 140,
    defaultY: 120,
    component: GitMatrixApp,
    isPinned: true
  },
  {
    id: 'dev-docker',
    title: 'Docker & Services Fleet',
    iconName: 'telemetry',
    os: 'dev',
    category: 'Container Operations',
    description: 'Inspect live container daemons, CPU/RAM telemetry, and stream log outputs.',
    defaultWidth: 720,
    defaultHeight: 480,
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
    description: 'Postman-style HTTP/WebSocket request builder with headers, params, and response latency.',
    defaultWidth: 700,
    defaultHeight: 520,
    defaultX: 220,
    defaultY: 100,
    component: ApiLabApp
  },
  {
    id: 'dev-vault',
    title: 'Engineering Obsidian Vault',
    iconName: 'vault',
    os: 'dev',
    category: 'Knowledge Base',
    description: 'Obsidian notes filtered for software architecture, systems, and developer specs.',
    defaultWidth: 800,
    defaultHeight: 560,
    defaultX: 160,
    defaultY: 80,
    component: ObsidianVaultApp,
    isPinned: true
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
    description: 'Conversational voice HUD and autonomous multi-agent directives.',
    defaultWidth: 720,
    defaultHeight: 540,
    defaultX: 90,
    defaultY: 70,
    component: JarvisCommanderApp,
    isPinned: true
  },
  {
    id: 'agentic-council',
    title: 'The Agent Council Suite',
    iconName: 'agent',
    os: 'agentic',
    category: 'Fleet Orchestration',
    description: 'Autonomous crew roster: Ares, Socrates, Daedalus, Athena, and JARVIS Prime.',
    defaultWidth: 760,
    defaultHeight: 540,
    defaultX: 140,
    defaultY: 90,
    component: AgentCouncilApp,
    isPinned: true
  },
  {
    id: 'agentic-model-router',
    title: 'Universal Model Router',
    iconName: 'ai',
    os: 'agentic',
    category: 'AI Switchboard',
    description: 'Gemini 2.5 Flash, 3.7 Pro, and Ollama local model switchboard and latency monitor.',
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
    description: '3D interactive Force Graph of all 155+ Obsidian vault notes with cluster filtering.',
    defaultWidth: 780,
    defaultHeight: 560,
    defaultX: 220,
    defaultY: 70,
    component: UniverseGraphApp,
    isPinned: true
  },
  {
    id: 'agentic-vault',
    title: 'Master Obsidian Vault',
    iconName: 'vault',
    os: 'agentic',
    category: 'Knowledge Base',
    description: 'Complete Obsidian knowledge vault editor with live sync and Mermaid rendering.',
    defaultWidth: 800,
    defaultHeight: 560,
    defaultX: 160,
    defaultY: 80,
    component: ObsidianVaultApp,
    isPinned: true
  },

  // -------------------------------------------------------------
  // 💼 FOUNDER_OS APPS (Operations & Memory Governance)
  // -------------------------------------------------------------
  {
    id: 'founder-gbrain',
    title: 'G-Brain Constellation Core',
    iconName: 'founder',
    os: 'founder',
    category: 'Epistemic Intelligence',
    description: 'FounderOS-grade knowledge graph constellation, force layout, link communities, and live Obsidian vault distillation.',
    defaultWidth: 900,
    defaultHeight: 620,
    defaultX: 90,
    defaultY: 60,
    component: GbrainMemoryApp,
    isPinned: true
  },
  {
    id: 'founder-pipeline',
    title: 'Workspace Projects Tracker',
    iconName: 'projects',
    os: 'founder',
    category: 'Project Execution',
    description: 'Tactile folder-card projects tracker with interactive checklists, Kanban detail view, and Monaco IDE integration.',
    defaultWidth: 920,
    defaultHeight: 640,
    defaultX: 80,
    defaultY: 50,
    component: ProjectsTrackerApp,
    isPinned: true
  },
  {
    id: 'founder-finance',
    title: 'Cloud MRR & Finance Engine',
    iconName: 'founder',
    os: 'founder',
    category: 'Operations',
    description: 'Cloud hosting runway, token costs, revenue telemetry, and burn rate monitor.',
    defaultWidth: 680,
    defaultHeight: 480,
    defaultX: 190,
    defaultY: 130,
    component: FinanceMonitorApp
  },
  {
    id: 'founder-vault',
    title: 'Executive Obsidian Vault',
    iconName: 'vault',
    os: 'founder',
    category: 'Knowledge Base',
    description: 'Obsidian notes filtered for strategy, startup roadmap, and executive decisions.',
    defaultWidth: 800,
    defaultHeight: 560,
    defaultX: 160,
    defaultY: 80,
    component: ObsidianVaultApp,
    isPinned: true
  }
];

// =============================================================
// 📁 DESKTOP FOLDERS (Real OS Folder Groupings per Environment)
// =============================================================
export const DESKTOP_FOLDERS: DesktopFolderDefinition[] = [
  // CyberOS Folders
  {
    id: 'cyber-recon-folder',
    title: 'Reconnaissance Suite',
    os: 'cyber',
    iconName: 'recon',
    color: 'red',
    description: 'Automated crawlers, port scanners, and target matrix intelligence.',
    appIds: ['cyber-spider', 'cyber-target-matrix', 'cyber-cve-hunter']
  },
  {
    id: 'cyber-exploit-folder',
    title: 'Exploit & Arsenal',
    os: 'cyber',
    iconName: 'Shield',
    color: 'red',
    description: 'Payload generators, reverse shell forge, eJPT lab dossiers, and pentest vault.',
    appIds: ['cyber-payload-forge', 'cyber-ejpt-qa', 'cyber-vault']
  },

  // DevOS Folders
  {
    id: 'dev-studio-folder',
    title: 'Development Studio',
    os: 'dev',
    iconName: 'terminal',
    color: 'emerald',
    description: 'Monaco code editor, tactical shell terminal, and Git repository controller.',
    appIds: ['dev-ide', 'dev-terminal', 'dev-git']
  },
  {
    id: 'dev-infra-folder',
    title: 'Infrastructure & APIs',
    os: 'dev',
    iconName: 'telemetry',
    color: 'emerald',
    description: 'Docker fleet containers, REST API lab client, and systems architecture vault.',
    appIds: ['dev-docker', 'dev-api-lab', 'dev-vault']
  },

  // StudyOS Folders
  {
    id: 'study-mastery-folder',
    title: 'Academic Mastery',
    os: 'study',
    iconName: 'socrates',
    color: 'purple',
    description: 'Socrates AI mentor, spaced repetition Leitner flashcards, and document synthesizer.',
    appIds: ['study-socrates', 'study-flashcards', 'study-synthesizer']
  },
  {
    id: 'study-knowledge-folder',
    title: 'Knowledge & Studio',
    os: 'study',
    iconName: 'notes',
    color: 'purple',
    description: 'Dynamic certification syllabus, Notion Markdown notepad, and full academic Obsidian vault.',
    appIds: ['study-curriculum', 'study-studio', 'study-vault']
  },

  // AgenticOS Folders
  {
    id: 'agentic-crew-folder',
    title: 'Autonomous Crew Operations',
    os: 'agentic',
    iconName: 'agent',
    color: 'cyan',
    description: 'JARVIS Master Core, Multi-Agent Council suite, and Universal Model switchboard.',
    appIds: ['agentic-jarvis', 'agentic-council', 'agentic-model-router']
  },
  {
    id: 'agentic-brain-folder',
    title: 'Neural Brain & Universe',
    os: 'agentic',
    iconName: 'Compass',
    color: 'cyan',
    description: '3D Knowledge Universe graph of 155+ notes and master Obsidian knowledge vault.',
    appIds: ['agentic-universe-graph', 'agentic-vault']
  },

  // FounderOS Folders
  {
    id: 'founder-exec-folder',
    title: 'Executive Operations',
    os: 'founder',
    iconName: 'founder',
    color: 'amber',
    description: 'G-Brain epistemic memory governor and venture milestone pipeline.',
    appIds: ['founder-gbrain', 'founder-pipeline']
  },
  {
    id: 'founder-assets-folder',
    title: 'Financial & Strategic Assets',
    os: 'founder',
    iconName: 'projects',
    color: 'amber',
    description: 'Cloud MRR runway engine, burn rate monitor, and strategic executive vault.',
    appIds: ['founder-finance', 'founder-vault']
  }
];

