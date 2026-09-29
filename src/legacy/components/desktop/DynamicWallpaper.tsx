import React, { useEffect, useRef } from 'react';
import { OperatingSystemId } from '../../types/desktop';

interface DynamicWallpaperProps {
  os: OperatingSystemId;
}

const WALLPAPER_MAP: Record<OperatingSystemId, { image: string; tint: string; glow: string; name: string }> = {
  agentic: {
    image: '/wallpapers/agentic_os.png',
    tint: 'rgba(6, 182, 212, 0.12)',
    glow: 'rgba(99, 102, 241, 0.25)',
    name: 'AGENTIC_CORE // JARVIS AI'
  },
  cyber: {
    image: '/wallpapers/cyber_os.png',
    tint: 'rgba(34, 197, 94, 0.15)',
    glow: 'rgba(239, 68, 68, 0.2)',
    name: 'CYBER_OS // ZAK SPIDER PENTEST'
  },
  dev: {
    image: '/wallpapers/dev_os.png',
    tint: 'rgba(56, 189, 248, 0.12)',
    glow: 'rgba(16, 185, 129, 0.18)',
    name: 'DEV_OS // TACTICAL WORKBENCH'
  },
  study: {
    image: '/wallpapers/study_os.png',
    tint: 'rgba(168, 85, 247, 0.12)',
    glow: 'rgba(234, 179, 8, 0.18)',
    name: 'STUDY_OS // SOCRATES ACADEMY'
  },
  founder: {
    image: '/wallpapers/founder_os.png',
    tint: 'rgba(245, 158, 11, 0.12)',
    glow: 'rgba(217, 119, 6, 0.22)',
    name: 'FOUNDER_OS // VENTURE COMMAND'
  }
};

export const DynamicWallpaper: React.FC<DynamicWallpaperProps> = ({ os }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentConfig = WALLPAPER_MAP[os] || WALLPAPER_MAP.agentic;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Particle setups based on OS
    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      alpha: number;
      char?: string;
      life?: number;
    }

    const particles: Particle[] = [];
    const count = os === 'cyber' ? 45 : os === 'agentic' ? 50 : 35;
    const codeChars = ['0', '1', '<', '>', '/', '{', '}', ';', '0x', '&&', '||', '$', '=>'];
    const matrixChars = ['0', '1', '7', 'F', 'X', 'Z', 'A', 'K', '9', 'C', '#', '@', '%', '*'];

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * (os === 'cyber' ? 0.3 : 0.6),
        vy: os === 'cyber' ? Math.random() * 2.5 + 1 : (Math.random() - 0.5) * 0.6,
        size: os === 'cyber' ? Math.random() * 12 + 10 : Math.random() * 2.5 + 1,
        alpha: Math.random() * 0.7 + 0.2,
        char: os === 'cyber' 
          ? matrixChars[Math.floor(Math.random() * matrixChars.length)] 
          : os === 'dev' 
            ? codeChars[Math.floor(Math.random() * codeChars.length)] 
            : undefined,
        life: Math.random() * 100
      });
    }

    let frame = 0;

    const render = () => {
      frame++;
      ctx.clearRect(0, 0, width, height);

      if (os === 'agentic') {
        // Quantum Neural Nodes & Connecting Synapses
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.12)';
        ctx.fillStyle = 'rgba(6, 182, 212, 0.8)';
        
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(6, 182, 212, ${p.alpha * 0.6})`;
          ctx.shadowColor = '#06b6d4';
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;

          // Connect nearby nodes
          for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const dx = p.x - p2.x;
            const dy = p.y - p2.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 120) {
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = `rgba(99, 102, 241, ${(1 - dist / 120) * 0.15})`;
              ctx.stroke();
            }
          }
        }
      } else if (os === 'cyber') {
        // Matrix Rain Drops & Cyber Scan
        ctx.font = '12px monospace';
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.y += p.vy;
          if (p.y > height) {
            p.y = 0;
            p.x = Math.random() * width;
            p.char = matrixChars[Math.floor(Math.random() * matrixChars.length)];
          }

          if (frame % 15 === 0 && Math.random() > 0.6) {
            p.char = matrixChars[Math.floor(Math.random() * matrixChars.length)];
          }

          ctx.fillStyle = `rgba(34, 197, 94, ${p.alpha * 0.75})`;
          ctx.shadowColor = '#22c55e';
          ctx.shadowBlur = 6;
          ctx.fillText(p.char || '0', p.x, p.y);
          ctx.shadowBlur = 0;
        }

        // Occasional horizontal glitch slice
        if (Math.random() > 0.96) {
          const sliceY = Math.random() * height;
          ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
          ctx.fillRect(0, sliceY, width, Math.random() * 8 + 2);
        }
      } else if (os === 'dev') {
        // Code Syntax Floating Particles
        ctx.font = '11px monospace';
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;

          ctx.fillStyle = `rgba(56, 189, 248, ${p.alpha * 0.5})`;
          ctx.fillText(p.char || '<>', p.x, p.y);
        }
      } else if (os === 'study') {
        // Golden Study Bokeh & Ambient Dust
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.x += p.vx * 0.4;
          p.y -= 0.3; // rising dust

          if (p.y < 0) {
            p.y = height;
            p.x = Math.random() * width;
          }
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 1.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(234, 179, 8, ${p.alpha * 0.4})`;
          ctx.shadowColor = '#eab308';
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      } else {
        // Founder OS - Executive Luxury Gold Particles
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.x += p.vx * 0.5;
          p.y += p.vy * 0.5;

          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(245, 158, 11, ${p.alpha * 0.45})`;
          ctx.shadowColor = '#f59e0b';
          ctx.shadowBlur = 6;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [os]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none transition-opacity duration-1000">
      {/* 1. Base Image Layer with Subtle Zoom & High Definition Cover */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-1000 scale-[1.01]"
        style={{
          backgroundImage: `url(${currentConfig.image})`,
          filter: os === 'cyber' ? 'contrast(1.15) brightness(0.85)' : os === 'founder' ? 'contrast(1.05) brightness(0.9)' : 'contrast(1.08) brightness(0.9)'
        }}
      />

      {/* 2. Atmospheric Themed Shader Color Tint */}
      <div 
        className="absolute inset-0 transition-all duration-700 backdrop-blur-[1.5px]"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${currentConfig.tint}, rgba(3, 7, 18, 0.75) 85%)`
        }}
      />

      {/* 3. OS Atmospheric Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.85)_100%)] pointer-events-none" />

      {/* 4. Canvas Shader Particles */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-10" />

      {/* 5. CRT Scanline & Grain Shader Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.35)_50%)] bg-[length:100%_4px] opacity-20 pointer-events-none z-20" />

      {/* 6. OS Watermark Identification */}
      <div className="absolute bottom-16 right-8 text-[11px] font-mono tracking-[0.25em] text-white/20 uppercase select-none z-10 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-pulse" />
        {currentConfig.name}
      </div>
    </div>
  );
};
