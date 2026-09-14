import React, { useState, useEffect } from 'react';
import { Clock, Play, Pause, RotateCcw, Volume2, VolumeX, CheckSquare, Square, Plus, Trash2, Sparkles, BookOpen } from 'lucide-react';
import { soundEngine } from '../../../services/soundEffects';

interface StudyStudioAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
}

interface Task {
  id: string;
  text: string;
  done: boolean;
}

export const StudyStudioApp: React.FC<StudyStudioAppProps> = () => {
  // Pomodoro State
  const [mode, setMode] = useState<'work' | 'shortBreak' | 'longBreak'>('work');
  const [timeLeft, setTimeLeft] = useState<number>(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  
  // Ambient Sound State
  const [soundTrack, setSoundTrack] = useState<'none' | 'gamma' | 'rain' | 'brown'>('none');
  
  // Tasks State
  const [tasks, setTasks] = useState<Task[]>([
    { id: '1', text: 'Master DCE/RPC endpoint single-homed verification', done: true },
    { id: '2', text: 'Review Chisel SOCKS5 pivot tunnel routing', done: false },
    { id: '3', text: 'Memorize Drupalgeddon2 CVE-2018-7600 exploit chain', done: false },
    { id: '4', text: 'Practice 20 flashcards on Network Security deck', done: false }
  ]);
  const [newTaskText, setNewTaskText] = useState('');

  // Pomodoro Ticker
  useEffect(() => {
    let timer: any = null;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      soundEngine.playCyberPing();
      setIsRunning(false);
    }
    return () => clearInterval(timer);
  }, [isRunning, timeLeft]);

  const switchMode = (newMode: 'work' | 'shortBreak' | 'longBreak') => {
    soundEngine.playClick();
    setMode(newMode);
    setIsRunning(false);
    if (newMode === 'work') setTimeLeft(25 * 60);
    else if (newMode === 'shortBreak') setTimeLeft(5 * 60);
    else setTimeLeft(15 * 60);
  };

  const toggleTimer = () => {
    soundEngine.playClick();
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    soundEngine.playClick();
    setIsRunning(false);
    if (mode === 'work') setTimeLeft(25 * 60);
    else if (mode === 'shortBreak') setTimeLeft(5 * 60);
    else setTimeLeft(15 * 60);
  };

  const toggleTask = (id: string) => {
    soundEngine.playClick();
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const addTask = () => {
    if (!newTaskText.trim()) return;
    soundEngine.playClick();
    setTasks(prev => [...prev, { id: Date.now().toString(), text: newTaskText.trim(), done: false }]);
    setNewTaskText('');
  };

  const deleteTask = (id: string) => {
    soundEngine.playClick();
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="h-full flex flex-col p-4 bg-[#090514] text-zinc-200 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
            Study Studio // Deep Focus & Pomodoro
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-purple-400 font-bold bg-purple-500/20 px-2 py-0.5 rounded">
            {tasks.filter(t => t.done).length}/{tasks.length} Completed
          </span>
        </div>
      </div>

      {/* Main Split: Pomodoro Timer & Audio (Left) | Task Checklist (Right) */}
      <div className="flex-1 grid grid-cols-12 gap-3 overflow-hidden">
        {/* Left: Pomodoro Timer & Sound Mixer */}
        <div className="col-span-6 flex flex-col items-center justify-between p-4 rounded-2xl bg-black/40 border border-white/10">
          {/* Mode Selector */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/5 border border-white/5 font-mono text-xs">
            <button
              onClick={() => switchMode('work')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                mode === 'work' ? 'bg-purple-500/30 text-purple-200 border border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.3)]' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Deep Work (25m)
            </button>
            <button
              onClick={() => switchMode('shortBreak')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                mode === 'shortBreak' ? 'bg-purple-500/30 text-purple-200 border border-purple-500/50' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Short Break (5m)
            </button>
            <button
              onClick={() => switchMode('longBreak')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                mode === 'longBreak' ? 'bg-purple-500/30 text-purple-200 border border-purple-500/50' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Long Break (15m)
            </button>
          </div>

          {/* Clock Display */}
          <div className="my-3 text-center">
            <div className="text-6xl font-mono font-black tracking-tight text-white drop-shadow-[0_0_20px_rgba(168,85,247,0.4)]">
              {formatTime(timeLeft)}
            </div>
            <div className="text-xs font-mono text-purple-400 uppercase tracking-widest mt-1">
              {mode === 'work' ? 'Focus Sprint In Session' : 'Rest & Cognitive Reset'}
            </div>
          </div>

          {/* Timer Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTimer}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-mono text-xs font-bold transition-all ${
                isRunning 
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30' 
                  : 'bg-purple-500 hover:bg-purple-400 text-black shadow-[0_0_15px_rgba(168,85,247,0.4)]'
              }`}
            >
              {isRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{isRunning ? 'PAUSE' : 'START FOCUS'}</span>
            </button>
            <button
              onClick={resetTimer}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/5 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Ambient Sound Controls */}
          <div className="w-full pt-3 mt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono">
            <span className="text-zinc-500 flex items-center gap-1.5"><Volume2 className="w-3.5 h-3.5 text-purple-400" /> Ambient Tones:</span>
            <div className="flex gap-1.5">
              {(['none', 'gamma', 'rain', 'brown'] as const).map(sound => (
                <button
                  key={sound}
                  onClick={() => {
                    soundEngine.playClick();
                    setSoundTrack(sound);
                  }}
                  className={`px-2 py-0.5 rounded uppercase font-bold text-[10px] ${
                    soundTrack === sound 
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' 
                      : 'bg-white/5 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {sound === 'gamma' ? '40Hz Gamma' : sound}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Study Tasks Checklist */}
        <div className="col-span-6 flex flex-col rounded-2xl bg-black/40 border border-white/10 p-3.5 overflow-hidden">
          <span className="text-xs font-mono font-bold text-white uppercase tracking-wider mb-2 block">
            Session Study Checklist
          </span>

          {/* Task List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {tasks.map(t => (
              <div 
                key={t.id} 
                onClick={() => toggleTask(t.id)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                  t.done 
                    ? 'bg-purple-500/10 border-purple-500/20 text-zinc-400 line-through' 
                    : 'bg-white/5 border-white/5 hover:border-purple-500/30 text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-2.5 text-xs font-sans">
                  {t.done ? (
                    <CheckSquare className="w-4 h-4 text-purple-400 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-zinc-500 shrink-0" />
                  )}
                  <span>{t.text}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteTask(t.id);
                  }}
                  className="text-zinc-600 hover:text-red-400 p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* New Task Input */}
          <div className="pt-3 mt-2 border-t border-white/10 flex items-center gap-2">
            <input
              type="text"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTask()}
              placeholder="Add study goal..."
              className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={addTask}
              className="p-1.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-black transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

