import React, { useState, useEffect } from 'react';
import { ProfileThemeTokens } from '../types/profileTypes';
import { BookOpen, CheckCircle, Edit3, Plus, Trash2, Save, FileText, ChevronRight, Folder } from 'lucide-react';

interface StudyNotionPaneProps {
  theme: ProfileThemeTokens;
}

interface CourseModule {
  id: string;
  title: string;
  category: 'CORE_CS' | 'ALGORITHMS' | 'SYSTEMS' | 'CYBERSECURITY';
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  progress: number; // 0 to 100
  notes: string;
}

const DEFAULT_COURSES: CourseModule[] = [
  {
    id: 'cs-algo',
    title: 'Data Structures & Algorithms (TheAlgorithms / LeetCode)',
    category: 'ALGORITHMS',
    status: 'IN_PROGRESS',
    progress: 65,
    notes: `# Data Structures & Algorithms\n\n## 1. Graph Traversal (BFS & DFS)\n- **BFS**: Uses a queue (FIFO), ideal for finding the shortest path in unweighted graphs.\n- **DFS**: Uses a stack/recursion (LIFO), ideal for topological sorting and cycle detection.\n\n\`\`\`python\ndef bfs(graph, start):\n    visited, queue = set([start]), [start]\n    while queue:\n        vertex = queue.pop(0)\n        for neighbor in graph[vertex]:\n            if neighbor not in visited:\n                visited.add(neighbor)\n                queue.append(neighbor)\n\`\`\`\n\n## 2. Dynamic Programming\n- Key: Overlapping subproblems + optimal substructure.\n- Memoization (top-down) vs Tabulation (bottom-up).\n`,
  },
  {
    id: 'cs-systems',
    title: 'Computer Systems & Architecture (CSAPP / Nand2Tetris)',
    category: 'SYSTEMS',
    status: 'IN_PROGRESS',
    progress: 40,
    notes: `# Computer Systems: A Programmer's Perspective\n\n## Memory Hierarchy Latencies\n- L1 Cache: ~0.5 ns\n- L2 Cache: ~7 ns\n- Main Memory (RAM): ~100 ns\n- NVMe SSD Read: ~15,000 ns (15 µs)\n- Network roundtrip (Datacenter): ~500,000 ns (0.5 ms)\n\n## Pointers & Virtual Memory\n- Page tables map Virtual Address (VPN) to Physical Frame (PPN).\n- TLB (Translation Lookaside Buffer) speeds up memory translations.\n`,
  },
  {
    id: 'cs-cyber',
    title: 'Offensive Security & eJPT Mastery',
    category: 'CYBERSECURITY',
    status: 'IN_PROGRESS',
    progress: 80,
    notes: `# Offensive Security Operations\n\n## Host Exploitation Workflow\n1. Active Discovery: \`nmap -sC -sV -p- -T4 <target>\`\n2. Service Enumeration: SMB (445), HTTP (80/8080), SSH (22)\n3. Initial Access: Exploit / WebShell / Default Credential Brute-force\n4. Post-Exploitation: LinPEAS / WinPEAS / Sudo -l privilege escalation\n`,
  },
];

export const StudyNotionPane: React.FC<StudyNotionPaneProps> = ({ theme }) => {
  const [courses, setCourses] = useState<CourseModule[]>(() => {
    const saved = localStorage.getItem('zakos_study_courses');
    return saved ? JSON.parse(saved) : DEFAULT_COURSES;
  });

  const [activeCourseId, setActiveCourseId] = useState<string>(courses[0]?.id || 'cs-algo');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newCategory, setNewCategory] = useState<CourseModule['category']>('CORE_CS');

  const activeCourse = courses.find((c) => c.id === activeCourseId) || courses[0];

  useEffect(() => {
    localStorage.setItem('zakos_study_courses', JSON.stringify(courses));
  }, [courses]);

  const updateNotes = (content: string) => {
    setCourses((prev) =>
      prev.map((c) => (c.id === activeCourseId ? { ...c, notes: content } : c))
    );
  };

  const updateProgress = (val: number) => {
    setCourses((prev) =>
      prev.map((c) =>
        c.id === activeCourseId
          ? {
              ...c,
              progress: val,
              status: val >= 100 ? 'COMPLETED' : val > 0 ? 'IN_PROGRESS' : 'NOT_STARTED',
            }
          : c
      )
    );
  };

  const addCourse = () => {
    if (!newTitle.trim()) return;
    const newCourse: CourseModule = {
      id: 'course-' + Date.now(),
      title: newTitle.trim(),
      category: newCategory,
      status: 'NOT_STARTED',
      progress: 0,
      notes: `# ${newTitle.trim()}\n\nWrite your notes and syllabus breakdown here...\n`,
    };
    setCourses((prev) => [...prev, newCourse]);
    setActiveCourseId(newCourse.id);
    setNewTitle('');
    setIsEditing(false);
  };

  const deleteCourse = (id: string) => {
    if (courses.length <= 1) return;
    setCourses((prev) => prev.filter((c) => c.id !== id));
    if (activeCourseId === id) {
      const remaining = courses.filter((c) => c.id !== id);
      setActiveCourseId(remaining[0].id);
    }
  };

  return (
    <div className="flex h-full w-full font-mono text-xs overflow-hidden select-none">
      {/* ----------------------------------------------------
          Left Navigation: Courses & Syllabus Tree
          ---------------------------------------------------- */}
      <div
        className="w-64 h-full border-r flex flex-col justify-between shrink-0"
        style={{
          backgroundColor: theme.bgSecondary,
          borderColor: theme.borderPrimary,
        }}
      >
        <div className="flex flex-col overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-2.5 border-b border-dashed" style={{ borderColor: theme.borderPrimary }}>
            <div className="flex items-center gap-1.5 font-bold text-white text-[11px]">
              <Folder className="w-3.5 h-3.5 text-sky-400" />
              <span>SYLLABUS &amp; LABS</span>
            </div>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="p-1 rounded hover:bg-black text-sky-400 hover:text-white transition-colors cursor-pointer"
              title="Add Course"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Add Course Form */}
          {isEditing && (
            <div className="p-2 border-b bg-black/40 space-y-1.5 text-[10px]" style={{ borderColor: theme.borderPrimary }}>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Course Title..."
                className="w-full px-2 py-1 rounded bg-black border border-neutral-700 text-white"
              />
              <div className="flex items-center gap-1">
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="flex-1 px-1 py-1 rounded bg-black border border-neutral-700 text-slate-300 text-[9px]"
                >
                  <option value="CORE_CS">Core CS</option>
                  <option value="ALGORITHMS">Algorithms</option>
                  <option value="SYSTEMS">Systems</option>
                  <option value="CYBERSECURITY">Cybersecurity</option>
                </select>
                <button
                  onClick={addCourse}
                  className="px-2 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-bold text-[9px] cursor-pointer"
                >
                  SAVE
                </button>
              </div>
            </div>
          )}

          {/* Course List */}
          <div className="divide-y divide-neutral-900/30">
            {courses.map((c) => {
              const isSelected = c.id === activeCourseId;
              return (
                <div
                  key={c.id}
                  onClick={() => setActiveCourseId(c.id)}
                  className={`p-2 cursor-pointer transition-colors flex flex-col gap-1 ${
                    isSelected ? 'bg-black/50' : 'hover:bg-black/25'
                  }`}
                  style={{
                    borderLeft: isSelected ? `2px solid ${theme.accentPrimary}` : '2px solid transparent',
                  }}
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold truncate text-slate-200">{c.title}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCourse(c.id);
                      }}
                      className="opacity-0 hover:opacity-100 text-neutral-500 hover:text-rose-400 p-0.5 cursor-pointer"
                      title="Delete Course"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Progress bar */}
                  <div className="flex items-center gap-2 text-[9px] text-neutral-400">
                    <div className="flex-1 h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${c.progress}%`,
                          backgroundColor:
                            c.progress >= 100
                              ? '#10b981'
                              : c.progress >= 50
                              ? theme.accentPrimary
                              : '#f59e0b',
                        }}
                      />
                    </div>
                    <span>{c.progress}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer info */}
        <div className="p-2 border-t text-[9px] text-neutral-500 flex items-center justify-between" style={{ borderColor: theme.borderPrimary }}>
          <span>{courses.length} ACTIVE MODULES</span>
          <span className="text-emerald-400">PERSISTENT DB</span>
        </div>
      </div>

      {/* ----------------------------------------------------
          Right Content: Notion-style Editorial Markdown Workspace
          ---------------------------------------------------- */}
      <div className="flex-1 h-full flex flex-col overflow-hidden" style={{ backgroundColor: theme.bgPanel }}>
        {/* Workspace Toolbar */}
        <div
          className="flex items-center justify-between px-4 py-2 border-b text-[10px]"
          style={{
            backgroundColor: theme.bgSecondary,
            borderColor: theme.borderPrimary,
          }}
        >
          <div className="flex items-center gap-2 truncate">
            <FileText className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="font-bold text-white text-xs truncate">{activeCourse.title}</span>
            <span className="px-1.5 py-0.2 rounded text-[8px] bg-sky-950/60 text-sky-300 border border-sky-600/40 uppercase">
              {activeCourse.category}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Progress Slider */}
            <div className="flex items-center gap-1.5">
              <span className="text-neutral-400 text-[9px]">PROGRESS:</span>
              <input
                type="range"
                min="0"
                max="100"
                value={activeCourse.progress}
                onChange={(e) => updateProgress(Number(e.target.value))}
                className="w-20 accent-sky-400 cursor-pointer"
              />
              <span className="font-bold text-white text-[9px]">{activeCourse.progress}%</span>
            </div>
          </div>
        </div>

        {/* Dynamic Markdown Editor / Viewer */}
        <div className="flex-1 w-full h-full p-4 overflow-y-auto">
          <textarea
            value={activeCourse.notes}
            onChange={(e) => updateNotes(e.target.value)}
            placeholder="Write markdown notes, code snippets, and active recall cues..."
            className="w-full h-full bg-transparent resize-none focus:outline-none leading-relaxed text-slate-200 text-xs font-mono selection:bg-sky-500/30"
            style={{ fontFamily: theme.fontMono }}
          />
        </div>
      </div>
    </div>
  );
};
