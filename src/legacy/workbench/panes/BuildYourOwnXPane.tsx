import React, { useState } from 'react';
import { ProfileThemeTokens } from '../types/profileTypes';
import { Code, CheckSquare, Square, Terminal, ArrowRight, ExternalLink, Cpu, Database, GitBranch, Box } from 'lucide-react';

interface BuildYourOwnXPaneProps {
  theme: ProfileThemeTokens;
}

interface ProjectBlueprint {
  id: string;
  title: string;
  category: string;
  difficulty: 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  description: string;
  steps: Array<{ title: string; completed: boolean }>;
  codeSnippet: string;
  testCommand: string;
}

const BLUEPRINTS: ProjectBlueprint[] = [
  {
    id: 'redis',
    title: 'Build Your Own Redis Server',
    category: 'IN-MEMORY DATABASE',
    difficulty: 'ADVANCED',
    description: 'Implement a TCP server compliant with the Redis Serialization Protocol (RESP), in-memory hash table, GET/SET commands, and TTL key expiry.',
    steps: [
      { title: 'Bind raw TCP socket on port 6379 and accept client connections', completed: true },
      { title: 'Parse RESP protocol primitives: Simple Strings (+), Errors (-), Integers (:), Bulk Strings ($), Arrays (*)', completed: true },
      { title: 'Implement PING / PONG handshake protocol', completed: true },
      { title: 'Implement concurrent GET and SET with in-memory thread-safe dictionary', completed: false },
      { title: 'Implement PX argument for millisecond-level key TTL expiry', completed: false },
      { title: 'Build RDB snapshot persistence or Append-Only File (AOF)', completed: false },
    ],
    codeSnippet: '# Minimal RESP Parser Skeleton in Python\nimport socket\n\ndef handle_client(client_socket):\n    buffer = client_socket.recv(1024).decode("utf-8")\n    # Parse RESP Array\n    if buffer.startswith("*"):\n        parts = buffer.strip().split("\\r\\n")\n        command = parts[2].upper()\n        if command == "PING":\n            client_socket.send(b"+PONG\\r\\n")\n        elif command == "ECHO":\n            arg = parts[4]\n            client_socket.send(f"${len(arg)}\\r\\n{arg}\\r\\n".encode())\n',
    testCommand: 'redis-cli -p 6379 PING && redis-cli -p 6379 SET mykey "hello" && redis-cli -p 6379 GET mykey',
  },
  {
    id: 'git',
    title: 'Build Your Own Git VCS',
    category: 'VERSION CONTROL SYSTEM',
    difficulty: 'ADVANCED',
    description: 'Create a content-addressable file system using SHA-1 hashing, zlib compression, blob/tree/commit objects, and working tree staging.',
    steps: [
      { title: 'Implement "git init" (create .git/objects and .git/refs directories)', completed: true },
      { title: 'Implement "git cat-file -p <sha>" (read & zlib decompress blob objects)', completed: true },
      { title: 'Implement "git hash-object -w <file>" (generate 40-char SHA-1 and write zlib blob)', completed: false },
      { title: 'Implement "git ls-tree <sha>" (parse tree objects and directory entries)', completed: false },
      { title: 'Implement "git write-tree" and "git commit-tree"', completed: false },
    ],
    codeSnippet: '# Git Blob Object Generation (Python)\nimport hashlib\nimport zlib\n\ndef hash_object(data: bytes) -> str:\n    header = f"blob {len(data)}\\0".encode()\n    store = header + data\n    sha1 = hashlib.sha1(store).hexdigest()\n    compressed = zlib.compress(store)\n    # Write to .git/objects/xx/yyyy...\n    return sha1\n',
    testCommand: 'python3 mygit.py init && python3 mygit.py hash-object -w sample.txt',
  },
  {
    id: 'docker',
    title: 'Build Your Own Container Engine (Docker)',
    category: 'CONTAINERIZATION',
    difficulty: 'EXPERT',
    description: 'Use Linux namespaces (PID, MNT, NET, UTS), cgroups v2 memory limits, and pivot_root to isolate a container process.',
    steps: [
      { title: 'Isolate UTS namespace to configure container hostname (CLONE_NEWUTS)', completed: true },
      { title: 'Isolate PID namespace to make container process PID 1 (CLONE_NEWPID)', completed: false },
      { title: 'Chroot into rootfs directory (Alpine / Ubuntu base)', completed: false },
      { title: 'Mount fresh procfs at /proc to isolate ps/top output', completed: false },
      { title: 'Attach cgroups v2 controller to restrict memory to 64MB', completed: false },
    ],
    codeSnippet: '// Linux Container Process Isolation in Go\npackage main\nimport (\n    "os"\n    "os/exec"\n    "syscall"\n)\n\nfunc main() {\n    cmd := exec.Command("/bin/sh")\n    cmd.Stdin = os.Stdin\n    cmd.Stdout = os.Stdout\n    cmd.Stderr = os.Stderr\n    cmd.SysProcAttr = &syscall.SysProcAttr{\n        Cloneflags: syscall.CLONE_NEWUTS | syscall.CLONE_NEWPID | syscall.CLONE_NEWNS,\n    }\n    cmd.Run()\n}\n',
    testCommand: 'go run mydocker.go run /bin/sh -c "hostname container01 && ps aux"',
  },
];

export const BuildYourOwnXPane: React.FC<BuildYourOwnXPaneProps> = ({ theme }) => {
  const [blueprints, setBlueprints] = useState<ProjectBlueprint[]>(BLUEPRINTS);
  const [activeId, setActiveId] = useState<string>(BLUEPRINTS[0].id);

  const active = blueprints.find((b) => b.id === activeId) || blueprints[0];

  const toggleStep = (stepIdx: number) => {
    setBlueprints((prev) =>
      prev.map((b) => {
        if (b.id !== activeId) return b;
        const newSteps = [...b.steps];
        newSteps[stepIdx].completed = !newSteps[stepIdx].completed;
        return { ...b, steps: newSteps };
      })
    );
  };

  const completedCount = active.steps.filter((s) => s.completed).length;
  const progressPct = Math.round((completedCount / active.steps.length) * 100);

  return (
    <div className="flex h-full w-full font-mono text-xs overflow-hidden select-none">
      {/* Left List of Projects */}
      <div
        className="w-56 h-full border-r flex flex-col shrink-0"
        style={{ backgroundColor: theme.bgSecondary, borderColor: theme.borderPrimary }}
      >
        <div className="p-2.5 border-b font-bold text-white text-[11px] flex items-center gap-1.5" style={{ borderColor: theme.borderPrimary }}>
          <Cpu className="w-3.5 h-3.5 text-amber-500" />
          <span>BUILD YOUR OWN X</span>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-neutral-900/40">
          {blueprints.map((bp) => {
            const isSelected = bp.id === activeId;
            return (
              <div
                key={bp.id}
                onClick={() => setActiveId(bp.id)}
                className={`p-2.5 cursor-pointer transition-colors ${
                  isSelected ? 'bg-black/50' : 'hover:bg-black/25'
                }`}
                style={{
                  borderLeft: isSelected ? `2px solid ${theme.accentPrimary}` : '2px solid transparent',
                }}
              >
                <div className="font-bold text-white truncate text-[11px]">{bp.title}</div>
                <div className="text-[9px] text-neutral-400 mt-0.5">{bp.category}</div>
                <div className="flex items-center justify-between text-[8px] text-neutral-500 mt-1">
                  <span className="text-amber-400 font-bold">{bp.difficulty}</span>
                  <span>{bp.steps.filter((s) => s.completed).length}/{bp.steps.length} STEPS</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Blueprint Studio */}
      <div className="flex-1 h-full flex flex-col overflow-y-auto p-4 space-y-4" style={{ backgroundColor: theme.bgPanel }}>
        {/* Title and Progress */}
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: theme.borderPrimary }}>
          <div>
            <h2 className="text-sm font-bold text-white">{active.title}</h2>
            <p className="text-[10px] text-neutral-400 mt-1 max-w-xl leading-relaxed">{active.description}</p>
          </div>
          <div className="text-right">
            <span className="text-lg font-black text-amber-400">{progressPct}%</span>
            <div className="text-[9px] text-neutral-500">BLUEPRINT PROGRESS</div>
          </div>
        </div>

        {/* Interactive Steps Checklist */}
        <div className="space-y-1.5">
          <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
            IMPLEMENTATION MILESTONES ({completedCount}/{active.steps.length})
          </span>
          <div className="space-y-1">
            {active.steps.map((step, idx) => (
              <div
                key={idx}
                onClick={() => toggleStep(idx)}
                className={`p-2 rounded-xs border flex items-center gap-2 cursor-pointer transition-colors ${
                  step.completed ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300' : 'bg-black/40 border-neutral-800 text-neutral-300'
                }`}
              >
                {step.completed ? <CheckSquare className="w-3.5 h-3.5 text-emerald-400" /> : <Square className="w-3.5 h-3.5 text-neutral-500" />}
                <span className="text-[10px]">{step.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Code Skeleton */}
        <div className="space-y-1.5">
          <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
            CORE ARCHITECTURE SKELETON
          </span>
          <div className="p-3 rounded-xs bg-[#03050a] border border-neutral-800 font-mono text-[10px] text-slate-300 overflow-x-auto">
            <pre>{active.codeSnippet}</pre>
          </div>
        </div>

        {/* Verification Command */}
        <div className="p-2.5 rounded-xs bg-black/60 border border-amber-500/30 flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-neutral-400">TEST HARNESS:</span>
            <span className="text-amber-300 font-bold">{active.testCommand}</span>
          </div>
          <span className="text-[9px] text-neutral-500">Run in SSH Terminal pane</span>
        </div>
      </div>
    </div>
  );
};
