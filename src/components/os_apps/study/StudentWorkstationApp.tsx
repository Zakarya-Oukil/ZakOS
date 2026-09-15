import React, { useState, useEffect, useRef } from 'react';
import { 
  GraduationCap, 
  BookOpen, 
  CheckCircle2, 
  Square, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  RotateCw, 
  Sparkles, 
  Layers, 
  FileText, 
  Code2, 
  ExternalLink, 
  Flame, 
  ShieldCheck, 
  Clock, 
  ChevronRight, 
  Tag, 
  Check, 
  AlertCircle,
  HelpCircle,
  BrainCircuit,
  Columns
} from 'lucide-react';
import MonacoEditor from '@monaco-editor/react';
import { marked } from 'marked';
import katex from 'katex';
import { soundEngine } from '../../../services/soundEffects';
import { api } from '../../../services/api';

interface StudentWorkstationAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
  initialProps?: {
    courseId?: string;
    moduleId?: string;
  };
}

interface ModuleTask {
  id: string;
  title: string;
  done: boolean;
}

interface CourseModule {
  id: string;
  title: string;
  description: string;
  weight: number; // percent contribution to exam
  status: 'mastered' | 'in-progress' | 'next-up' | 'queued';
  labHours: number;
  tasks: ModuleTask[];
  notesPath: string;
}

interface Course {
  id: string;
  title: string;
  provider: string;
  badge: string;
  description: string;
  modules: CourseModule[];
}

const DEFAULT_COURSES: Course[] = [
  {
    id: 'course-ejpt',
    title: 'eJPTv2 Certification Path',
    provider: 'INE Security / eLearnSecurity',
    badge: 'CYBER-CERT',
    description: 'Comprehensive offensive penetration testing curriculum: Assessment Methodology, Host & Network Auditing, Web Application Pentesting, and Exploitation.',
    modules: [
      {
        id: 'mod-1',
        title: '1. Assessment Methodologies & Info Gathering',
        description: 'OSINT reconnaissance, passive/active network footprinting, and target scoping.',
        weight: 20,
        status: 'mastered',
        labHours: 12,
        notesPath: '01 Certifications/EJPT Certification/Assessment Methodologies.md',
        tasks: [
          { id: 't-1-1', title: 'WHOIS, DNS records & subdomains enumeration', done: true },
          { id: 't-1-2', title: 'Google Dorking & sensitive directory hunting', done: true },
          { id: 't-1-3', title: 'Passive reconnaissance dossier compilation', done: true }
        ]
      },
      {
        id: 'mod-2',
        title: '2. Network Scanning & Port Discovery',
        description: 'Nmap TCP SYN, UDP discovery, service banner grabbing, and NSE script audits.',
        weight: 20,
        status: 'mastered',
        labHours: 18,
        notesPath: '01 Certifications/EJPT Certification/Network Scanning.md',
        tasks: [
          { id: 't-2-1', title: 'Nmap timing templates & stealth SYN sweeps', done: true },
          { id: 't-2-2', title: 'NSE vuln scripts against SMB and HTTP', done: true },
          { id: 't-2-3', title: 'Masscan high-speed subnet exploration', done: true }
        ]
      },
      {
        id: 'mod-3',
        title: '3. Host & Network Pentesting (Enumeration)',
        description: 'Deep service interrogation: SMBv1, DCE/RPC single-homed checks, SNMP, and NetBIOS.',
        weight: 25,
        status: 'in-progress',
        labHours: 24,
        notesPath: '01 Certifications/EJPT Certification/Host & Network Enumeration.md',
        tasks: [
          { id: 't-3-1', title: 'DCE/RPC endpoint mapper (port 135) single-homed verification', done: true },
          { id: 't-3-2', title: 'SMB NULL session & enum4linux user extraction', done: true },
          { id: 't-3-3', title: 'Chisel SOCKS5 proxy routing through HTTP tunnel', done: false },
          { id: 't-3-4', title: 'Metasploit route add multi-subnet pivoting', done: false }
        ]
      },
      {
        id: 'mod-4',
        title: '4. Vulnerability Assessment & Exploitation',
        description: 'Drupalgeddon2, OpenSMTPD CVE-2020-7247, and Windows privilege escalation.',
        weight: 20,
        status: 'next-up',
        labHours: 30,
        notesPath: '01 Certifications/EJPT Certification/Vulnerability Assessment.md',
        tasks: [
          { id: 't-4-1', title: 'Drupal 7.x AJAX Form API render array RCE', done: false },
          { id: 't-4-2', title: 'OpenSMTPD MAIL FROM command injection', done: false },
          { id: 't-4-3', title: 'WinPEAS & JuicyPotato Token PrivEsc', done: false }
        ]
      },
      {
        id: 'mod-5',
        title: '5. Web Application Penetration Testing',
        description: 'SQLi table dumping, XSS cookie stealing, WebDAV upload, and web shells.',
        weight: 15,
        status: 'queued',
        labHours: 16,
        notesPath: '01 Certifications/EJPT Certification/Web App Pentesting.md',
        tasks: [
          { id: 't-5-1', title: 'SQLMap automated blind injection extraction', done: false },
          { id: 't-5-2', title: 'IIS WebDAV PUT arbitrary ASPX upload', done: false },
          { id: 't-5-3', title: 'Directory fuzzing with Gobuster & SecLists', done: false }
        ]
      }
    ]
  },
  {
    id: 'course-oscp',
    title: 'OSCP Active Directory & Labs',
    provider: 'OffSec',
    badge: 'HARDCORE-PENTEST',
    description: 'Offensive Security Certified Professional: Buffer overflows, Active Directory Kerberoasting, BloodHound paths, and pivoting.',
    modules: [
      {
        id: 'oscp-mod-1',
        title: 'Active Directory Enumeration & BloodHound',
        description: 'Domain controller mapping, SharpHound ingestion, and shortest path to Domain Admin.',
        weight: 40,
        status: 'in-progress',
        labHours: 40,
        notesPath: '01 Certifications/OSCP/Active Directory Enumeration.md',
        tasks: [
          { id: 'ot-1', title: 'SharpHound.exe remote collection via CME', done: true },
          { id: 'ot-2', title: 'Kerberoasting SPNs with GetUserSPNs.py', done: false },
          { id: 'ot-3', title: 'AS-REP roasting pre-auth disabled accounts', done: false }
        ]
      },
      {
        id: 'oscp-mod-2',
        title: 'Linux Privilege Escalation & Capabilities',
        description: 'SUDO tokens, SUID binaries, cron job hijacking, and kernel vulnerabilities.',
        weight: 30,
        status: 'next-up',
        labHours: 25,
        notesPath: '01 Certifications/OSCP/Linux PrivEsc.md',
        tasks: [
          { id: 'ot-4', title: 'LinPEAS automated enumeration sweep', done: false },
          { id: 'ot-5', title: 'GTFOBins sudo rights exploitation', done: false }
        ]
      }
    ]
  }
];

export const StudentWorkstationApp: React.FC<StudentWorkstationAppProps> = ({ initialProps }) => {
  // 1. Persistent Courses & Curriculum State
  const [courses, setCourses] = useState<Course[]>(() => {
    const saved = localStorage.getItem('zakos_student_curriculum_v2');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return DEFAULT_COURSES;
  });

  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialProps?.courseId || courses[0]?.id || 'course-ejpt');
  const activeCourse = courses.find(c => c.id === selectedCourseId) || courses[0];

  const [selectedModuleId, setSelectedModuleId] = useState<string>(
    initialProps?.moduleId || activeCourse?.modules[0]?.id || 'mod-3'
  );
  const activeModule = activeCourse?.modules.find(m => m.id === selectedModuleId) || activeCourse?.modules[0];

  // 2. View Mode Switcher: 'curriculum' | 'notepad' | 'flashcards'
  const [viewMode, setViewMode] = useState<'curriculum' | 'notepad' | 'flashcards'>('curriculum');

  // 3. Notepad & Markdown State
  const [notepadContent, setNotepadContent] = useState<string>('');
  const [notepadPane, setNotepadPane] = useState<'split' | 'edit' | 'preview'>('split');
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // 4. Modals State
  const [isNewModuleOpen, setIsNewModuleOpen] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [newModuleDesc, setNewModuleDesc] = useState('');
  const [newModuleWeight, setNewModuleWeight] = useState(20);

  const [newTaskTitle, setNewTaskTitle] = useState('');

  // 5. Flashcard Mini State for Active Module
  const [cardIndex, setCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);

  // Save courses to localStorage on change
  useEffect(() => {
    localStorage.setItem('zakos_student_curriculum_v2', JSON.stringify(courses));
  }, [courses]);

  // Sync notepad content when active module changes
  useEffect(() => {
    if (!activeModule) return;
    api.getNote(activeModule.notesPath)
      .then(res => {
        if (res && res.content) {
          setNotepadContent(res.content);
        } else {
          setNotepadContent(`# ${activeModule.title}\n\n**Curriculum Focus**: ${activeCourse.title}\n**Domain Weight**: ${activeModule.weight}%\n**Status**: \`${activeModule.status.toUpperCase()}\`\n\n## 🎯 Core Technical Objectives\n${activeModule.tasks.map(t => `- [${t.done ? 'x' : ' '}] ${t.title}`).join('\n')}\n\n## 📝 Laboratory Notes & Commands\n\`\`\`bash\n# Key verification command\n\`\`\`\n\n## 💡 Key Takeaways\n> [!NOTE]\n> Essential concept explanation.\n`);
        }
      })
      .catch(() => {
        setNotepadContent(`# ${activeModule.title}\n\n**Curriculum Focus**: ${activeCourse.title}\n**Domain Weight**: ${activeModule.weight}%\n**Status**: \`${activeModule.status.toUpperCase()}\`\n\n## 🎯 Core Technical Objectives\n${activeModule.tasks.map(t => `- [${t.done ? 'x' : ' '}] ${t.title}`).join('\n')}\n\n## 📝 Laboratory Notes & Commands\n\`\`\`bash\n# Add your notes and commands here\n\`\`\`\n\n## 💡 Key Takeaways\n> [!NOTE]\n> Document your findings, proof of concepts, and flags here.\n`);
      });
  }, [activeModule?.id, activeCourse?.id]);

  // Markdown live rendering with KaTeX
  useEffect(() => {
    if (!notepadContent) {
      setPreviewHtml('');
      return;
    }

    try {
      let processed = notepadContent.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
        try {
          return katex.renderToString(math, { displayMode: true });
        } catch {
          return `<pre class="text-rose-400 font-mono">${math}</pre>`;
        }
      });

      processed = processed.replace(/\$([^\$\n]+)\$/g, (_, math) => {
        try {
          return katex.renderToString(math, { displayMode: false });
        } catch {
          return `<code class="text-rose-400 font-mono">${math}</code>`;
        }
      });

      const parsed = marked.parse(processed, { async: false }) as string;
      setPreviewHtml(parsed);
    } catch (e) {
      console.error(e);
    }
  }, [notepadContent]);

  // Calculate Overall Course Readiness %
  const calculateCourseProgress = (): number => {
    if (!activeCourse || activeCourse.modules.length === 0) return 0;
    let totalScore = 0;
    let totalWeight = 0;

    activeCourse.modules.forEach(m => {
      totalWeight += m.weight;
      if (m.tasks.length === 0) {
        if (m.status === 'mastered') totalScore += m.weight;
      } else {
        const completedTasks = m.tasks.filter(t => t.done).length;
        const taskFraction = completedTasks / m.tasks.length;
        totalScore += m.weight * taskFraction;
      }
    });

    return totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : 0;
  };

  const progressPercent = calculateCourseProgress();

  // Task Toggle
  const handleToggleTask = (moduleId: string, taskId: string) => {
    soundEngine.playClick();
    setCourses(prev => prev.map(c => {
      if (c.id !== activeCourse.id) return c;
      return {
        ...c,
        modules: c.modules.map(m => {
          if (m.id !== moduleId) return m;
          const updatedTasks = m.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t);
          const allDone = updatedTasks.every(t => t.done);
          const anyDone = updatedTasks.some(t => t.done);
          const newStatus = allDone ? 'mastered' : anyDone ? 'in-progress' : m.status;
          return { ...m, tasks: updatedTasks, status: newStatus as any };
        })
      };
    }));
  };

  // Add Task to Active Module
  const handleAddTask = () => {
    if (!newTaskTitle.trim() || !activeModule) return;
    soundEngine.playClick();
    const newTask: ModuleTask = {
      id: `task-${Date.now()}`,
      title: newTaskTitle.trim(),
      done: false
    };

    setCourses(prev => prev.map(c => {
      if (c.id !== activeCourse.id) return c;
      return {
        ...c,
        modules: c.modules.map(m => {
          if (m.id !== activeModule.id) return m;
          return {
            ...m,
            tasks: [...m.tasks, newTask]
          };
        })
      };
    }));

    setNewTaskTitle('');
  };

  // Delete Task
  const handleDeleteTask = (moduleId: string, taskId: string) => {
    soundEngine.playClick();
    setCourses(prev => prev.map(c => {
      if (c.id !== activeCourse.id) return c;
      return {
        ...c,
        modules: c.modules.map(m => {
          if (m.id !== moduleId) return m;
          return {
            ...m,
            tasks: m.tasks.filter(t => t.id !== taskId)
          };
        })
      };
    }));
  };

  // Add New Module
  const handleCreateModule = () => {
    if (!newModuleTitle.trim() || !activeCourse) return;
    soundEngine.playClick();
    const newMod: CourseModule = {
      id: `mod-${Date.now()}`,
      title: newModuleTitle.trim(),
      description: newModuleDesc.trim() || 'Custom study module.',
      weight: Number(newModuleWeight) || 20,
      status: 'queued',
      labHours: 10,
      tasks: [
        { id: `t-init-1`, title: 'Read conceptual notes & watch briefings', done: false },
        { id: `t-init-2`, title: 'Execute hands-on laboratory exercise', done: false }
      ],
      notesPath: `01 Certifications/${activeCourse.title}/${newModuleTitle.trim()}.md`
    };

    setCourses(prev => prev.map(c => {
      if (c.id !== activeCourse.id) return c;
      return { ...c, modules: [...c.modules, newMod] };
    }));

    setSelectedModuleId(newMod.id);
    setIsNewModuleOpen(false);
    setNewModuleTitle('');
    setNewModuleDesc('');
  };

  // Save Note to Obsidian Vault
  const handleSaveNotepad = async () => {
    if (!activeModule) return;
    soundEngine.playClick();
    setIsSavingNote(true);
    try {
      await api.saveNote(activeModule.notesPath, notepadContent, {
        course: activeCourse.title,
        module: activeModule.title,
        weight: activeModule.weight,
        status: activeModule.status,
        tags: ['study', 'certifications', activeCourse.id, 'curriculum']
      });
      setSaveSuccess(true);
      soundEngine.playCyberPing();
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingNote(false);
    }
  };

  // Insert Notion-style Markdown Snippets
  const insertSnippet = (snippet: string) => {
    soundEngine.playClick();
    setNotepadContent(prev => prev + '\n\n' + snippet);
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-[#080512] text-zinc-200 font-sans select-text">
      {/* 1. Global Academic Ribbon */}
      <div className="h-12 border-b border-purple-500/20 px-4 bg-[#0e0822]/90 flex items-center justify-between shrink-0 font-mono text-xs">
        {/* Course Dropdown & Progress */}
        <div className="flex items-center gap-3">
          <GraduationCap className="w-5 h-5 text-purple-400 shrink-0" />
          <select
            value={selectedCourseId}
            onChange={(e) => {
              soundEngine.playClick();
              setSelectedCourseId(e.target.value);
            }}
            className="bg-black/60 border border-purple-500/30 rounded-xl px-2.5 py-1 text-white font-bold font-sans text-xs focus:outline-none focus:border-purple-400"
          >
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>

          <span className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold text-[10px]">
            {activeCourse.badge}
          </span>
        </div>

        {/* Course Progress Indicator */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-400 text-[11px]">Readiness:</span>
            <span className="font-bold text-purple-300">{progressPercent}%</span>
            <div className="w-24 bg-white/10 h-2 rounded-full overflow-hidden hidden sm:block">
              <div 
                className="bg-gradient-to-r from-purple-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 bg-black/60 p-0.5 rounded-xl border border-white/10">
            <button
              onClick={() => { soundEngine.playClick(); setViewMode('curriculum'); }}
              className={`px-3 py-1 rounded-lg uppercase tracking-wider text-[10px] font-bold transition-all ${
                viewMode === 'curriculum' ? 'bg-purple-500/30 text-purple-200 border border-purple-500/40' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Curriculum
            </button>
            <button
              onClick={() => { soundEngine.playClick(); setViewMode('notepad'); }}
              className={`px-3 py-1 rounded-lg uppercase tracking-wider text-[10px] font-bold transition-all ${
                viewMode === 'notepad' ? 'bg-purple-500/30 text-purple-200 border border-purple-500/40' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Notion Notepad
            </button>
            <button
              onClick={() => { soundEngine.playClick(); setViewMode('flashcards'); }}
              className={`px-3 py-1 rounded-lg uppercase tracking-wider text-[10px] font-bold transition-all ${
                viewMode === 'flashcards' ? 'bg-purple-500/30 text-purple-200 border border-purple-500/40' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Active Recall
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main Content Area */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* VIEW 1: CURRICULUM & MODULE ROADMAP */}
        {viewMode === 'curriculum' && (
          <div className="flex-1 min-h-0 flex flex-col md:flex-row p-4 gap-4 overflow-hidden">
            {/* Left: Module List (5 cols) */}
            <div className="w-full md:w-5/12 min-h-0 flex flex-col bg-black/40 border border-white/10 rounded-2xl p-3.5 overflow-hidden">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Course Modules ({activeCourse.modules.length})
                </span>
                <button
                  onClick={() => setIsNewModuleOpen(true)}
                  className="px-2 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-[10px] font-mono font-bold flex items-center gap-1 transition-all"
                >
                  <Plus className="w-3 h-3" /> Add Module
                </button>
              </div>

              {/* Modules Scroll List */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {activeCourse.modules.map(mod => {
                  const isSelected = mod.id === activeModule?.id;
                  const completedTasks = mod.tasks.filter(t => t.done).length;
                  const modProgress = mod.tasks.length > 0 ? Math.round((completedTasks / mod.tasks.length) * 100) : (mod.status === 'mastered' ? 100 : 0);

                  return (
                    <div
                      key={mod.id}
                      onClick={() => {
                        soundEngine.playClick();
                        setSelectedModuleId(mod.id);
                      }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-purple-500/20 border-purple-500/60 shadow-[0_0_15px_rgba(168,85,247,0.2)]' 
                          : 'bg-white/5 border-white/5 hover:border-purple-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-white leading-tight pr-2">
                          {mod.title}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                          mod.status === 'mastered' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          mod.status === 'in-progress' ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50 animate-pulse' :
                          mod.status === 'next-up' ? 'bg-amber-500/20 text-amber-300' :
                          'bg-white/5 text-zinc-500'
                        }`}>
                          {mod.status}
                        </span>
                      </div>

                      <p className="text-[11px] text-zinc-400 line-clamp-2 mb-2 font-sans">
                        {mod.description}
                      </p>

                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                        <span>Weight: <strong className="text-purple-300">{mod.weight}%</strong></span>
                        <span>{completedTasks}/{mod.tasks.length} Tasks ({modProgress}%)</span>
                      </div>

                      <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden mt-1.5">
                        <div 
                          className="bg-purple-400 h-full rounded-full transition-all duration-300"
                          style={{ width: `${modProgress}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Active Module Deep Inspector & Checklist (7 cols) */}
            {activeModule && (
              <div className="w-full md:w-7/12 min-h-0 flex flex-col bg-black/50 border border-white/10 rounded-2xl p-4 overflow-hidden">
                <div className="flex items-start justify-between pb-3 mb-3 border-b border-white/10">
                  <div>
                    <div className="flex items-center gap-2 mb-1 font-mono text-[10px] text-purple-400 uppercase">
                      <span>Module Focus</span>
                      <span>•</span>
                      <span>{activeModule.weight}% Exam Domain</span>
                    </div>
                    <h2 className="text-base font-bold text-white font-sans">{activeModule.title}</h2>
                    <p className="text-xs text-zinc-400 mt-0.5">{activeModule.description}</p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setViewMode('notepad')}
                      className="px-3 py-1 rounded-xl bg-purple-500 hover:bg-purple-400 text-black font-bold font-mono text-xs flex items-center gap-1 transition-all"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Open Notepad
                    </button>
                  </div>
                </div>

                {/* Checklist Header */}
                <div className="flex items-center justify-between mb-2 font-mono text-xs">
                  <span className="font-bold text-white uppercase tracking-wider text-[11px]">
                    Technical Milestones & Verification Checklist
                  </span>
                  <span className="text-purple-300 text-[10px]">
                    {activeModule.tasks.filter(t => t.done).length} / {activeModule.tasks.length} Completed
                  </span>
                </div>

                {/* Tasks List */}
                <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {activeModule.tasks.map(task => (
                    <div
                      key={task.id}
                      onClick={() => handleToggleTask(activeModule.id, task.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                        task.done
                          ? 'bg-purple-500/10 border-purple-500/20 text-zinc-400'
                          : 'bg-white/5 border-white/5 hover:border-purple-500/30 text-zinc-100'
                      }`}
                    >
                      <div className="flex items-center gap-3 text-xs font-sans">
                        {task.done ? (
                          <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-zinc-500 shrink-0" />
                        )}
                        <span className={task.done ? 'line-through text-zinc-400' : 'font-medium'}>
                          {task.title}
                        </span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTask(activeModule.id, task.id);
                        }}
                        className="text-zinc-600 hover:text-red-400 p-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add New Milestone / Task Input */}
                <div className="pt-3 mt-2 border-t border-white/10 flex items-center gap-2">
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                    placeholder="Add lab milestone or exam objective..."
                    className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                  <button
                    onClick={handleAddTask}
                    className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-mono font-bold flex items-center gap-1 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Task
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: FULL NOTION-LIKE MARKDOWN NOTEPAD */}
        {viewMode === 'notepad' && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#04020a]">
            {/* Notepad Top Action Bar */}
            <div className="h-10 border-b border-white/10 px-4 bg-[#0a0518] flex items-center justify-between shrink-0 font-mono text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="font-bold text-white truncate text-xs">{activeModule?.title}</span>
                <span className="text-[10px] text-zinc-500 hidden sm:inline">[{activeModule?.notesPath}]</span>
              </div>

              {/* Formatting Quick-Snips Toolbar */}
              <div className="hidden lg:flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5 text-[10px]">
                <button onClick={() => insertSnippet('### New Subsection Title')} className="px-1.5 py-0.5 hover:bg-white/10 rounded text-zinc-400 hover:text-white"># Head</button>
                <button onClick={() => insertSnippet('- [ ] Action item checklist')} className="px-1.5 py-0.5 hover:bg-white/10 rounded text-zinc-400 hover:text-white">[ ] Todo</button>
                <button onClick={() => insertSnippet('```bash\n# Terminal execution\n```')} className="px-1.5 py-0.5 hover:bg-white/10 rounded text-zinc-400 hover:text-white">&lt;/&gt; Code</button>
                <button onClick={() => insertSnippet('$$ E = mc^2 $$')} className="px-1.5 py-0.5 hover:bg-white/10 rounded text-zinc-400 hover:text-white">∑ Math</button>
                <button onClick={() => insertSnippet('> [!TIP]\n> Key exam takeaway.')} className="px-1.5 py-0.5 hover:bg-white/10 rounded text-amber-400 hover:text-amber-300">💡 Tip</button>
                <button onClick={() => insertSnippet('> [!WARNING]\n> High risk pitfall.')} className="px-1.5 py-0.5 hover:bg-white/10 rounded text-red-400 hover:text-red-300">⚠️ Warn</button>
              </div>

              {/* Save & Pane Switcher */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-black/60 p-0.5 rounded-lg border border-white/10 text-[10px]">
                  <button onClick={() => setNotepadPane('edit')} className={`px-2 py-0.5 rounded ${notepadPane === 'edit' ? 'bg-purple-500/30 text-purple-200 font-bold' : 'text-zinc-400'}`}>Edit</button>
                  <button onClick={() => setNotepadPane('split')} className={`px-2 py-0.5 rounded ${notepadPane === 'split' ? 'bg-purple-500/30 text-purple-200 font-bold' : 'text-zinc-400'}`}>Split</button>
                  <button onClick={() => setNotepadPane('preview')} className={`px-2 py-0.5 rounded ${notepadPane === 'preview' ? 'bg-purple-500/30 text-purple-200 font-bold' : 'text-zinc-400'}`}>Preview</button>
                </div>

                <button
                  onClick={handleSaveNotepad}
                  disabled={isSavingNote}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all ${
                    saveSuccess
                      ? 'bg-emerald-500 text-black shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                      : 'bg-purple-500 hover:bg-purple-400 text-black shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                  }`}
                >
                  {saveSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{saveSuccess ? 'SYNCED TO VAULT' : isSavingNote ? 'SAVING...' : 'SYNC (Ctrl+S)'}</span>
                </button>
              </div>
            </div>

            {/* Split Editor Panes */}
            <div className="flex-1 min-h-0 flex overflow-hidden">
              {(notepadPane === 'edit' || notepadPane === 'split') && (
                <div className={`${notepadPane === 'split' ? 'w-1/2' : 'w-full'} h-full min-h-0 border-r border-white/10 overflow-hidden`}>
                  <MonacoEditor
                    height="100%"
                    language="markdown"
                    theme="vs-dark"
                    value={notepadContent}
                    onChange={(val) => setNotepadContent(val || '')}
                    options={{
                      fontSize: 13,
                      fontFamily: '"Fira Code", "JetBrains Mono", Consolas, monospace',
                      minimap: { enabled: false },
                      wordWrap: 'on',
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      padding: { top: 12, bottom: 12 },
                    }}
                  />
                </div>
              )}

              {(notepadPane === 'preview' || notepadPane === 'split') && (
                <div
                  ref={previewRef}
                  className={`${notepadPane === 'split' ? 'w-1/2' : 'w-full'} h-full min-h-0 overflow-y-auto p-6 bg-[#06030e] text-zinc-200 prose prose-invert max-w-none prose-headings:font-sans prose-headings:text-purple-300 prose-a:text-cyan-400 prose-code:text-emerald-300 prose-code:bg-black/40 prose-pre:bg-black/60 prose-pre:border prose-pre:border-white/10 custom-scrollbar`}
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              )}
            </div>
          </div>
        )}

        {/* VIEW 3: ACTIVE RECALL / FLASHCARDS */}
        {viewMode === 'flashcards' && (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-between p-6 overflow-y-auto custom-scrollbar">
            <div className="w-full max-w-xl text-center mb-4">
              <span className="text-[10px] font-mono text-purple-400 uppercase tracking-wider font-bold">
                Leitner Spaced Repetition // {activeModule?.title}
              </span>
              <h3 className="text-lg font-bold text-white mt-1">Active Recall Board</h3>
            </div>

            {/* Flashcard 3D Tactile Card */}
            <div
              onClick={() => {
                soundEngine.playClick();
                setCardFlipped(!cardFlipped);
              }}
              className="w-full max-w-lg min-h-[260px] rounded-3xl bg-gradient-to-br from-purple-950/40 via-black/80 to-[#120728] border border-purple-500/40 p-6 flex flex-col justify-between cursor-pointer hover:border-purple-400 hover:shadow-[0_0_30px_rgba(168,85,247,0.25)] transition-all select-none relative"
            >
              <div className="flex items-center justify-between text-[11px] font-mono text-purple-400">
                <span className="uppercase font-bold tracking-wider">{activeCourse.title}</span>
                <span className="flex items-center gap-1 text-zinc-500">
                  <RotateCw className="w-3 h-3" /> Click to flip
                </span>
              </div>

              <div className="text-center py-6">
                <h4 className={`text-base font-semibold leading-relaxed transition-all ${cardFlipped ? 'text-emerald-300 font-mono text-sm' : 'text-white'}`}>
                  {cardFlipped ? (
                    activeModule?.tasks[cardIndex]?.title
                      ? `Mastery Criteria: Complete execution and proof of concept for "${activeModule.tasks[cardIndex].title}". Ensure all command flags and boundary exceptions are understood.`
                      : 'Review the full module specifications in the Notion Notepad.'
                  ) : (
                    activeModule?.tasks[cardIndex]?.title
                      ? `Explain the core methodology and exploit mechanism of: "${activeModule.tasks[cardIndex].title}".`
                      : 'No milestone question in this slot. Click below to add card.'
                  )}
                </h4>
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 border-t border-white/10 pt-2">
                <span>Milestone Card {cardIndex + 1} / {Math.max(activeModule?.tasks.length || 1, 1)}</span>
                <span className="text-purple-300">{cardFlipped ? 'REVERSE / ANSWER' : 'PROMPT / QUESTION'}</span>
              </div>
            </div>

            {/* Flashcard Response Controls */}
            <div className="flex items-center gap-4 mt-6">
              <button
                onClick={() => {
                  soundEngine.playClick();
                  setCardFlipped(false);
                  setCardIndex(prev => (prev - 1 + (activeModule?.tasks.length || 1)) % (activeModule?.tasks.length || 1));
                }}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-zinc-300 transition-colors"
              >
                Previous Card
              </button>
              <button
                onClick={() => {
                  soundEngine.playClick();
                  setCardFlipped(!cardFlipped);
                }}
                className="px-5 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 text-xs font-mono font-bold transition-all"
              >
                Flip Card
              </button>
              <button
                onClick={() => {
                  soundEngine.playCyberPing();
                  setCardFlipped(false);
                  setCardIndex(prev => (prev + 1) % (activeModule?.tasks.length || 1));
                }}
                className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold transition-colors"
              >
                Mastered / Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: ADD MODULE */}
      {isNewModuleOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#110924] border border-purple-500/40 p-5 space-y-4">
            <h3 className="text-sm font-bold text-white font-mono uppercase flex items-center gap-2">
              <Plus className="w-4 h-4 text-purple-400" /> Create Course Module
            </h3>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="text-[10px] text-zinc-400 uppercase block mb-1">Module Title</label>
                <input
                  type="text"
                  value={newModuleTitle}
                  onChange={(e) => setNewModuleTitle(e.target.value)}
                  placeholder="e.g. 6. Active Directory Kerberoasting"
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500 font-sans"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-400 uppercase block mb-1">Description & Focus</label>
                <input
                  type="text"
                  value={newModuleDesc}
                  onChange={(e) => setNewModuleDesc(e.target.value)}
                  placeholder="Brief summary of domain objectives..."
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500 font-sans"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-400 uppercase block mb-1">Domain Weight (%)</label>
                <input
                  type="number"
                  value={newModuleWeight}
                  onChange={(e) => setNewModuleWeight(Number(e.target.value))}
                  min={1}
                  max={100}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => setIsNewModuleOpen(false)}
                className="px-3 py-1.5 rounded-xl text-zinc-400 hover:text-white font-mono text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateModule}
                className="px-4 py-1.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-black font-bold font-mono text-xs shadow-[0_0_12px_rgba(168,85,247,0.4)]"
              >
                Create Module
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
