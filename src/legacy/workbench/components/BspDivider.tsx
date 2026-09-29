import React, { useState, useEffect, useRef } from 'react';
import { DividerInfo, SplitDirection } from '../types/bspTypes';
import { ProfileThemeTokens } from '../types/profileTypes';

interface BspDividerProps {
  divider: DividerInfo;
  parentRef: React.RefObject<HTMLDivElement | null>;
  currentRatio: number;
  theme: ProfileThemeTokens;
  onRatioChange: (nodeId: string, newRatio: number) => void;
}

export const BspDivider: React.FC<BspDividerProps> = ({
  divider,
  parentRef,
  currentRatio,
  theme,
  onRatioChange,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startPos: number; startRatio: number }>({ startPos: 0, startRatio: currentRatio });

  const isVertical = divider.direction === 'vertical';

  useEffect(() => {
    if (!isDragging) return;

    let rafId: number;

    const handleMouseMove = (e: MouseEvent) => {
      if (!parentRef.current) return;
      const rect = parentRef.current.getBoundingClientRect();

      rafId = requestAnimationFrame(() => {
        if (isVertical) {
          const deltaX = e.clientX - dragStartRef.current.startPos;
          const ratioDelta = deltaX / rect.width;
          const newRatio = Math.max(0.1, Math.min(0.9, dragStartRef.current.startRatio + ratioDelta));
          onRatioChange(divider.nodeId, newRatio);
        } else {
          const deltaY = e.clientY - dragStartRef.current.startPos;
          const ratioDelta = deltaY / rect.height;
          const newRatio = Math.max(0.1, Math.min(0.9, dragStartRef.current.startRatio + ratioDelta));
          onRatioChange(divider.nodeId, newRatio);
        }
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      cancelAnimationFrame(rafId);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      cancelAnimationFrame(rafId);
    };
  }, [isDragging, isVertical, divider.nodeId, onRatioChange, parentRef]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      startPos: isVertical ? e.clientX : e.clientY,
      startRatio: currentRatio,
    };
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`absolute z-20 group transition-colors select-none ${
        isVertical
          ? 'cursor-col-resize w-2 -ml-1'
          : 'cursor-row-resize h-2 -mt-1'
      }`}
      style={{
        left: isVertical ? `${divider.x}%` : `${divider.x}%`,
        top: isVertical ? `${divider.y}%` : `${divider.y}%`,
        width: isVertical ? '8px' : `${divider.length}%`,
        height: isVertical ? `${divider.length}%` : '8px',
      }}
    >
      {/* Visual 1px divider line centered inside the wider clickable hit area */}
      <div
        className={`w-full h-full flex items-center justify-center pointer-events-none`}
      >
        <div
          className={`transition-all duration-75 ${
            isVertical ? 'w-[1px] h-full' : 'h-[1px] w-full'
          }`}
          style={{
            backgroundColor: isDragging
              ? theme.accentPrimary
              : theme.borderPrimary,
          }}
        />
      </div>
    </div>
  );
};
