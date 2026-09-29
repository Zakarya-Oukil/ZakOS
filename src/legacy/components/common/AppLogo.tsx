import React from 'react';

export type AppLogoType =
  | 'obsidian'
  | 'wireshark'
  | 'forensics'
  | 'kali'
  | 'cyber'
  | 'terminal'
  | 'tmux'
  | 'docker'
  | 'git'
  | 'vscode'
  | 'monaco'
  | 'python'
  | 'algorithms'
  | 'postman'
  | 'api'
  | 'notion'
  | 'study'
  | 'redis'
  | 'buildx'
  | 'sysdesign'
  | 'projects'
  | 'jarvis'
  | 'socrates'
  | 'cve'
  | 'payload';

interface AppLogoProps {
  name: string | AppLogoType;
  className?: string;
  size?: number | string;
}

export const AppLogo: React.FC<AppLogoProps> = ({ name, className = 'w-5 h-5', size }) => {
  const normalized = (name || '').toLowerCase().trim();
  const style = size ? { width: size, height: size } : undefined;

  // 1. OBSIDIAN (Faceted Amethyst Gemstone)
  if (normalized.includes('obsidian') || normalized.includes('vault')) {
    return (
      <svg
        viewBox="0 0 100 100"
        className={`inline-block flex-shrink-0 ${className}`}
        style={style}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M50 5 L82 28 L68 88 L32 88 L18 28 Z" fill="#6D28D9" />
        <path d="M50 5 L68 88 L50 95 L32 88 Z" fill="#8B5CF6" />
        <path d="M50 5 L82 28 L68 55 L50 35 Z" fill="#A78BFA" />
        <path d="M50 5 L18 28 L32 55 L50 35 Z" fill="#4C1D95" />
        <path d="M32 55 L50 35 L68 55 L50 95 Z" fill="#7C3AED" />
      </svg>
    );
  }

  // 2. WIRESHARK / DIGITAL FORENSICS (Shark Fin & Oceanic Wave)
  if (
    normalized.includes('wireshark') ||
    normalized.includes('forensic') ||
    normalized.includes('pcap') ||
    normalized.includes('packet')
  ) {
    return (
      <svg
        viewBox="0 0 100 100"
        className={`inline-block flex-shrink-0 ${className}`}
        style={style}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="100" height="100" rx="18" fill="#0A192F" />
        {/* Shark Fin */}
        <path
          d="M20 78 C35 78 50 68 58 48 C64 33 62 18 60 14 C66 22 75 36 76 52 C78 72 65 78 82 78 Z"
          fill="url(#ws-grad)"
        />
        {/* Ocean Wave lines */}
        <path d="M12 82 C28 80 40 84 56 82 C72 80 84 84 92 82" stroke="#00B4D8" strokeWidth="4" strokeLinecap="round" />
        <defs>
          <linearGradient id="ws-grad" x1="20" y1="14" x2="82" y2="78" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00B4D8" />
            <stop offset="1" stopColor="#0F52BA" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  // 3. KALI LINUX / CYBER C2 (Cyber Dragon & Stark Shield)
  if (
    normalized.includes('kali') ||
    normalized.includes('cyber') ||
    normalized.includes('admin') ||
    normalized.includes('c2') ||
    normalized.includes('recon') ||
    normalized.includes('spider')
  ) {
    return (
      <svg
        viewBox="0 0 100 100"
        className={`inline-block flex-shrink-0 ${className}`}
        style={style}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="100" height="100" rx="18" fill="#0D1117" />
        <path
          d="M50 12 L84 26 V52 C84 72 68 87 50 92 C32 87 16 72 16 52 V26 L50 12 Z"
          fill="#161B22"
          stroke="#30363D"
          strokeWidth="3"
        />
        <path
          d="M50 20 L76 32 V52 C76 68 64 80 50 84 C36 80 24 68 24 52 V32 L50 20 Z"
          fill="url(#kali-grad)"
        />
        <path
          d="M38 42 C44 38 56 38 62 42 C64 48 58 56 50 62 C42 56 36 48 38 42 Z"
          fill="#FFFFFF"
          opacity="0.9"
        />
        <circle cx="50" cy="50" r="4" fill="#0D1117" />
        <defs>
          <linearGradient id="kali-grad" x1="24" y1="20" x2="76" y2="84" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2F80ED" />
            <stop offset="1" stopColor="#001845" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  // 4. DOCKER (Modular Blue Containers Whale)
  if (normalized.includes('docker') || normalized.includes('container')) {
    return (
      <svg
        viewBox="0 0 100 100"
        className={`inline-block flex-shrink-0 ${className}`}
        style={style}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="100" height="100" rx="18" fill="#0B1A2E" />
        {/* Containers */}
        <rect x="22" y="40" width="10" height="10" rx="1.5" fill="#2496ED" />
        <rect x="35" y="40" width="10" height="10" rx="1.5" fill="#2496ED" />
        <rect x="48" y="40" width="10" height="10" rx="1.5" fill="#2496ED" />
        <rect x="35" y="27" width="10" height="10" rx="1.5" fill="#2496ED" />
        <rect x="48" y="27" width="10" height="10" rx="1.5" fill="#2496ED" />
        <rect x="48" y="14" width="10" height="10" rx="1.5" fill="#2496ED" />
        {/* Whale body */}
        <path
          d="M84 52 C82 52 74 53 70 57 C64 49 50 49 46 51 C32 51 22 58 16 67 C20 74 36 78 52 78 C76 78 86 66 88 56 C88 54 86 52 84 52 Z"
          fill="#2496ED"
        />
        <circle cx="28" cy="62" r="2.5" fill="#0B1A2E" />
      </svg>
    );
  }

  // 5. GIT (Orange Branching Tree Diamond)
  if (normalized.includes('git') || normalized.includes('repo')) {
    return (
      <svg
        viewBox="0 0 100 100"
        className={`inline-block flex-shrink-0 ${className}`}
        style={style}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="100" height="100" rx="18" fill="#1C1412" />
        <g transform="translate(14, 14)">
          <rect x="0" y="0" width="72" height="72" rx="12" transform="rotate(45 36 36)" fill="#F05032" />
          {/* Git branches */}
          <line x1="26" y1="26" x2="46" y2="46" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />
          <line x1="46" y1="46" x2="46" y2="22" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />
          <circle cx="26" cy="26" r="6" fill="#FFFFFF" />
          <circle cx="46" cy="46" r="6" fill="#FFFFFF" />
          <circle cx="46" cy="22" r="6" fill="#FFFFFF" />
        </g>
      </svg>
    );
  }

  // 6. VS CODE / MONACO (Folding Blue Tech Ribbon)
  if (normalized.includes('code') || normalized.includes('monaco') || normalized.includes('ide')) {
    return (
      <svg
        viewBox="0 0 100 100"
        className={`inline-block flex-shrink-0 ${className}`}
        style={style}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="100" height="100" rx="18" fill="#0C141F" />
        <path d="M72 14 L28 48 L72 84 L90 74 V24 L72 14 Z" fill="#0065A9" />
        <path d="M72 84 L28 48 L14 58 L24 68 L72 84 Z" fill="#007ACC" />
        <path d="M72 14 L28 48 L14 38 L24 28 L72 14 Z" fill="#1F9CF0" />
        <path d="M90 24 L72 50 L90 74 V24 Z" fill="#005A9E" opacity="0.8" />
      </svg>
    );
  }

  // 7. PYTHON / THE ALGORITHMS (Yellow & Blue Interlocking Serpents)
  if (normalized.includes('python') || normalized.includes('algo') || normalized.includes('math')) {
    return (
      <svg
        viewBox="0 0 100 100"
        className={`inline-block flex-shrink-0 ${className}`}
        style={style}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="100" height="100" rx="18" fill="#121820" />
        {/* Blue Snake */}
        <path
          d="M49 16 C32 16 33 24 33 24 L33 32 L50 32 L50 35 L26 35 C18 35 14 42 14 52 C14 62 20 63 20 63 L26 63 L26 55 C26 46 34 46 34 46 L51 46 C59 46 65 40 65 31 C65 22 59 16 49 16 Z M40 22 C42 22 43 23 43 25 C43 27 42 28 40 28 C38 28 37 27 37 25 C37 23 38 22 40 22 Z"
          fill="#3776AB"
        />
        {/* Yellow Snake */}
        <path
          d="M51 84 C68 84 67 76 67 76 L67 68 L50 68 L50 65 L74 65 C82 65 86 58 86 48 C86 38 80 37 80 37 L74 37 L74 45 C74 54 66 54 66 54 L49 54 C41 54 35 60 35 69 C35 78 41 84 51 84 Z M60 78 C58 78 57 77 57 75 C57 73 58 72 60 72 C62 72 63 73 63 75 C63 77 62 78 60 78 Z"
          fill="#FFD438"
        />
      </svg>
    );
  }

  // 8. NOTION / STUDY / CURRICULUM (Minimalist Editorial 'N' Monograph)
  if (
    normalized.includes('notion') ||
    normalized.includes('study') ||
    normalized.includes('curriculum') ||
    normalized.includes('student') ||
    normalized.includes('notes')
  ) {
    return (
      <svg
        viewBox="0 0 100 100"
        className={`inline-block flex-shrink-0 ${className}`}
        style={style}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="100" height="100" rx="18" fill="#1C1C1E" stroke="#38383A" strokeWidth="2" />
        <path
          d="M26 24 C24 24 22 25 21 27 L20 28 V76 L32 74 V36 L56 76 H76 V28 L64 30 V64 L38 24 H26 Z"
          fill="#FFFFFF"
        />
        <rect x="23" y="30" width="3" height="42" fill="#2C2C2E" opacity="0.3" />
      </svg>
    );
  }

  // 9. POSTMAN / API LAB (Energetic Orange Astronaut Helmet)
  if (normalized.includes('api') || normalized.includes('postman') || normalized.includes('rest')) {
    return (
      <svg
        viewBox="0 0 100 100"
        className={`inline-block flex-shrink-0 ${className}`}
        style={style}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="100" height="100" rx="18" fill="#221208" />
        <circle cx="50" cy="50" r="32" fill="#FF6C37" />
        {/* Astronaut Visor */}
        <path
          d="M34 46 C34 40 41 36 50 36 C59 36 66 40 66 46 C66 54 59 58 50 58 C41 58 34 54 34 46 Z"
          fill="#1C1B22"
        />
        <ellipse cx="44" cy="43" rx="4" ry="2" fill="#FFFFFF" opacity="0.8" />
        {/* Antennas / Gear */}
        <rect x="47" y="14" width="6" height="8" rx="2" fill="#FF6C37" />
      </svg>
    );
  }

  // 10. REDIS / BUILD-YOUR-OWN-X (Layered Isometric Crimson Cache Cube)
  if (normalized.includes('redis') || normalized.includes('build') || normalized.includes('buildx')) {
    return (
      <svg
        viewBox="0 0 100 100"
        className={`inline-block flex-shrink-0 ${className}`}
        style={style}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="100" height="100" rx="18" fill="#1F0E0D" />
        {/* Isometric Cube layers */}
        <polygon points="50,18 78,32 50,46 22,32" fill="#FF4438" />
        <polygon points="22,32 50,46 50,78 22,64" fill="#DC382D" />
        <polygon points="78,32 50,46 50,78 78,64" fill="#A82319" />
        {/* White core highlight */}
        <polygon points="50,28 62,34 50,40 38,34" fill="#FFFFFF" opacity="0.7" />
      </svg>
    );
  }

  // 11. SYSTEM DESIGN PRIMER (Distributed Blueprint Nodes Topology)
  if (normalized.includes('system') || normalized.includes('design') || normalized.includes('primer')) {
    return (
      <svg
        viewBox="0 0 100 100"
        className={`inline-block flex-shrink-0 ${className}`}
        style={style}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="100" height="100" rx="18" fill="#0E1326" />
        {/* Connection lines */}
        <line x1="28" y1="36" x2="50" y2="24" stroke="#6366F1" strokeWidth="3" />
        <line x1="72" y1="36" x2="50" y2="24" stroke="#6366F1" strokeWidth="3" />
        <line x1="50" y1="24" x2="50" y2="68" stroke="#6366F1" strokeWidth="3" />
        <line x1="28" y1="74" x2="50" y2="68" stroke="#6366F1" strokeWidth="3" />
        <line x1="72" y1="74" x2="50" y2="68" stroke="#6366F1" strokeWidth="3" />
        {/* Nodes */}
        <circle cx="50" cy="24" r="10" fill="#4F46E5" stroke="#818CF8" strokeWidth="2.5" />
        <circle cx="28" cy="36" r="8" fill="#1E1B4B" stroke="#6366F1" strokeWidth="2" />
        <circle cx="72" cy="36" r="8" fill="#1E1B4B" stroke="#6366F1" strokeWidth="2" />
        <circle cx="50" cy="68" r="12" fill="#4F46E5" stroke="#A5B4FC" strokeWidth="2.5" />
        <circle cx="28" cy="74" r="8" fill="#1E1B4B" stroke="#6366F1" strokeWidth="2" />
        <circle cx="72" cy="74" r="8" fill="#1E1B4B" stroke="#6366F1" strokeWidth="2" />
      </svg>
    );
  }

  // 12. PAYLOAD MATRIX / PAYLOADS-ALL-THE-THINGS (Exploit Dagger / Injector)
  if (normalized.includes('payload') || normalized.includes('forge') || normalized.includes('cve')) {
    return (
      <svg
        viewBox="0 0 100 100"
        className={`inline-block flex-shrink-0 ${className}`}
        style={style}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="100" height="100" rx="18" fill="#1F0D0E" />
        {/* Exploitation lightning/dagger */}
        <path
          d="M54 14 L30 50 H48 L44 86 L70 46 H52 L54 14 Z"
          fill="url(#payload-grad)"
          stroke="#EF4444"
          strokeWidth="2"
        />
        <defs>
          <linearGradient id="payload-grad" x1="30" y1="14" x2="70" y2="86" gradientUnits="userSpaceOnUse">
            <stop stopColor="#EF4444" />
            <stop offset="1" stopColor="#991B1B" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  // 13. PROJECTS TRACKER (Tactile Manila Folder with Document Tab)
  if (normalized.includes('project') || normalized.includes('pipeline') || normalized.includes('folder')) {
    return (
      <svg
        viewBox="0 0 100 100"
        className={`inline-block flex-shrink-0 ${className}`}
        style={style}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="100" height="100" rx="18" fill="#1C180A" />
        {/* Manila tab */}
        <path d="M18 36 L24 26 H46 L52 36 H82 V74 H18 Z" fill="#D97706" />
        {/* Document sheet */}
        <rect x="26" y="30" width="48" height="34" rx="2" fill="#FEF3C7" />
        <line x1="32" y1="38" x2="62" y2="38" stroke="#B45309" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="32" y1="46" x2="54" y2="46" stroke="#B45309" strokeWidth="2.5" strokeLinecap="round" />
        {/* Folder front flap */}
        <path d="M16 42 L24 76 H76 L84 42 Z" fill="#F59E0B" />
      </svg>
    );
  }

  // 14. JARVIS / AI CORE (Quantum Arc Reactor)
  if (normalized.includes('jarvis') || normalized.includes('agent') || normalized.includes('ai') || normalized.includes('core')) {
    return (
      <svg
        viewBox="0 0 100 100"
        className={`inline-block flex-shrink-0 ${className}`}
        style={style}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="100" height="100" rx="18" fill="#051524" />
        <circle cx="50" cy="50" r="34" stroke="#0284C7" strokeWidth="3" strokeDasharray="6 4" />
        <circle cx="50" cy="50" r="22" fill="#0C4A6E" stroke="#38BDF8" strokeWidth="3" />
        <circle cx="50" cy="50" r="10" fill="#E0F2FE" />
        {/* 4 Tech ticks */}
        <line x1="50" y1="12" x2="50" y2="20" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" />
        <line x1="50" y1="80" x2="50" y2="88" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" />
        <line x1="12" y1="50" x2="20" y2="50" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" />
        <line x1="80" y1="50" x2="88" y2="50" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }

  // 15. TERMINAL / TMUX / SHELL LAB (Phosphor Terminal Prompt)
  return (
    <svg
      viewBox="0 0 100 100"
      className={`inline-block flex-shrink-0 ${className}`}
      style={style}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="100" height="100" rx="18" fill="#0A0F0D" />
      <rect x="8" y="8" width="84" height="84" rx="14" stroke="#1F2937" strokeWidth="2" />
      {/* Prompt symbol >_ */}
      <path d="M28 34 L46 50 L28 66" stroke="#10B981" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="54" y1="66" x2="72" y2="66" stroke="#10B981" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
};
