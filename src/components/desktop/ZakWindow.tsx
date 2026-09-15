import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';
import { WindowState, OperatingSystemId } from '../../types/desktop';
import { soundEngine } from '../../services/soundEffects';

interface ZakWindowProps {
  window: WindowState;
  isActive: boolean;
  activeOs: OperatingSystemId;
  onFocus: (id: string) => void;
  onClose: (id: string) => void;
  onMinimize: (id: string) => void;
  onMaximize: (id: string) => void;
  onUpdatePosition: (id: string, pos: { x: number; y: number }) => void;
  onUpdateSize: (id: string, size: { width: number; height: number }) => void;
  children: React.ReactNode;
}

export const ZakWindow: React.FC<ZakWindowProps> = ({
  window: win,
  isActive,
  activeOs,
  onFocus,
  onClose,
  onMinimize,
  onMaximize,
  onUpdatePosition,
  onUpdateSize,
  children
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({ mouseX: 0, mouseY: 0, startX: 0, startY: 0 });
  const resizeStartRef = useRef<{ mouseX: number; mouseY: number; startW: number; startH: number; startX: number; startY: number }>({ mouseX: 0, mouseY: 0, startW: 0, startH: 0, startX: 0, startY: 0 });

  // Handle Dragging
  const handleMouseDownHeader = (e: React.MouseEvent) => {
    if (win.isMaximized) return;
    if ((e.target as HTMLElement).closest('button')) return;

    onFocus(win.id);
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: win.position.x,
      startY: win.position.y
    };
  };

  // Handle Resizing
  const handleMouseDownResize = (direction: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (win.isMaximized) return;
    onFocus(win.id);
    setIsResizing(direction);
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startW: win.size.width,
      startH: win.size.height,
      startX: win.position.x,
      startY: win.position.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - dragStartRef.current.mouseX;
        const dy = e.clientY - dragStartRef.current.mouseY;
        const newX = Math.max(0, Math.min(window.innerWidth - 100, dragStartRef.current.startX + dx));
        const newY = Math.max(40, Math.min(window.innerHeight - 80, dragStartRef.current.startY + dy));
        onUpdatePosition(win.id, { x: newX, y: newY });
      } else if (isResizing) {
        const dx = e.clientX - resizeStartRef.current.mouseX;
        const dy = e.clientY - resizeStartRef.current.mouseY;
        let newW = resizeStartRef.current.startW;
        let newH = resizeStartRef.current.startH;
        let newX = resizeStartRef.current.startX;
        let newY = resizeStartRef.current.startY;

        if (isResizing.includes('e')) newW = Math.max(380, resizeStartRef.current.startW + dx);
        if (isResizing.includes('s')) newH = Math.max(260, resizeStartRef.current.startH + dy);
        if (isResizing.includes('w')) {
          const possibleW = resizeStartRef.current.startW - dx;
          if (possibleW >= 380) {
            newW = possibleW;
            newX = resizeStartRef.current.startX + dx;
          }
        }
        if (isResizing.includes('n')) {
          const possibleH = resizeStartRef.current.startH - dy;
          if (possibleH >= 260) {
            newH = possibleH;
            newY = resizeStartRef.current.startY + dy;
          }
        }

        onUpdateSize(win.id, { width: newW, height: newH });
        if (newX !== win.position.x || newY !== win.position.y) {
          onUpdatePosition(win.id, { x: newX, y: newY });
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(null);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, win.id, win.position, win.size, onUpdatePosition, onUpdateSize]);

  if (!win.isOpen || win.isMinimized) return null;

  // OS-specific window styling accents
  const getThemeClasses = () => {
    switch (win.os) {
      case 'cyber':
        return {
          border: isActive ? 'border-red-500/40 shadow-[0_0_25px_rgba(239,68,68,0.2)]' : 'border-red-900/30',
          headerBg: 'bg-[#0d090d]/90',
          titleColor: 'text-red-400',
          accent: 'bg-red-500/20 text-red-300'
        };
      case 'dev':
        return {
          border: isActive ? 'border-emerald-500/40 shadow-[0_0_25px_rgba(16,185,129,0.2)]' : 'border-emerald-900/30',
          headerBg: 'bg-[#070e0b]/90',
          titleColor: 'text-emerald-400',
          accent: 'bg-emerald-500/20 text-emerald-300'
        };
      case 'study':
        return {
          border: isActive ? 'border-purple-500/40 shadow-[0_0_25px_rgba(168,85,247,0.2)]' : 'border-purple-900/30',
          headerBg: 'bg-[#0c0817]/90',
          titleColor: 'text-purple-300',
          accent: 'bg-purple-500/20 text-purple-300'
        };
      case 'founder':
        return {
          border: isActive ? 'border-zinc-400/40 shadow-[0_0_25px_rgba(255,255,255,0.1)]' : 'border-zinc-800',
          headerBg: 'bg-[#111111]/90',
          titleColor: 'text-zinc-200',
          accent: 'bg-zinc-800 text-zinc-300'
        };
      case 'agentic':
      default:
        return {
          border: isActive ? 'border-cyan-500/40 shadow-[0_0_25px_rgba(6,182,212,0.2)]' : 'border-cyan-950/40',
          headerBg: 'bg-[#060c16]/90',
          titleColor: 'text-cyan-400',
          accent: 'bg-cyan-500/20 text-cyan-300'
        };
    }
  };

  const theme = getThemeClasses();

  return (
    <div
      onMouseDown={() => onFocus(win.id)}
      style={{
        position: 'absolute',
        left: win.isMaximized ? 0 : win.position.x,
        top: win.isMaximized ? 42 : win.position.y,
        width: win.isMaximized ? '100vw' : win.size.width,
        height: win.isMaximized ? 'calc(100vh - 42px - 60px)' : win.size.height,
        zIndex: win.zIndex,
        transition: isDragging || isResizing ? 'none' : 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
      className={`flex flex-col rounded-xl overflow-hidden backdrop-blur-xl bg-[#090d16]/95 border ${theme.border} select-none`}
    >
      {/* Window Header */}
      <div
        onMouseDown={handleMouseDownHeader}
        onDoubleClick={() => {
          soundEngine.playClick();
          onMaximize(win.id);
        }}
        className={`h-10 px-3 flex items-center justify-between border-b border-white/5 cursor-grab active:cursor-grabbing ${theme.headerBg}`}
      >
        {/* Title & Badge */}
        <div className="flex items-center gap-2 overflow-hidden">
          <span className={`text-xs px-2 py-0.5 rounded font-mono font-bold tracking-wider uppercase ${theme.accent}`}>
            {win.os}
          </span>
          <span className={`text-xs font-semibold tracking-wide truncate ${theme.titleColor}`}>
            {win.title}
          </span>
        </div>

        {/* Window Controls (macOS & Windows hybrid styling) */}
        <div className="flex items-center gap-1.5 ml-2" onMouseDown={(e) => e.stopPropagation()}>
          {/* Minimize */}
          <button
            onClick={() => {
              soundEngine.playWindowMinimize();
              onMinimize(win.id);
            }}
            title="Minimize to Dock"
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          {/* Maximize / Restore */}
          <button
            onClick={() => {
              soundEngine.playClick();
              onMaximize(win.id);
            }}
            title={win.isMaximized ? "Restore Window" : "Maximize Window"}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          >
            {win.isMaximized ? <Copy className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
          </button>

          {/* Close */}
          <button
            onClick={() => {
              soundEngine.playClick();
              onClose(win.id);
            }}
            title="Close Application"
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Window Body */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#04070e]/80 text-zinc-200 relative select-text">
        {children}
      </div>

      {/* Resize Handles (8 directions) */}
      {!win.isMaximized && (
        <>
          <div onMouseDown={(e) => handleMouseDownResize('n', e)} className="absolute top-0 left-2 right-2 h-1.5 cursor-ns-resize" />
          <div onMouseDown={(e) => handleMouseDownResize('s', e)} className="absolute bottom-0 left-2 right-2 h-1.5 cursor-ns-resize" />
          <div onMouseDown={(e) => handleMouseDownResize('w', e)} className="absolute left-0 top-2 bottom-2 w-1.5 cursor-ew-resize" />
          <div onMouseDown={(e) => handleMouseDownResize('e', e)} className="absolute right-0 top-2 bottom-2 w-1.5 cursor-ew-resize" />
          <div onMouseDown={(e) => handleMouseDownResize('nw', e)} className="absolute top-0 left-0 w-3 h-3 cursor-nwse-resize" />
          <div onMouseDown={(e) => handleMouseDownResize('ne', e)} className="absolute top-0 right-0 w-3 h-3 cursor-nesw-resize" />
          <div onMouseDown={(e) => handleMouseDownResize('sw', e)} className="absolute bottom-0 left-0 w-3 h-3 cursor-nesw-resize" />
          <div onMouseDown={(e) => handleMouseDownResize('se', e)} className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize" />
        </>
      )}
    </div>
  );
};
