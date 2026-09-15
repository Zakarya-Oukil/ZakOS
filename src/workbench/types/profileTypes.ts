export type ContextProfileId = 'CYBER' | 'STUDY' | 'DEV';

export interface ProfileThemeTokens {
  id: ContextProfileId;
  name: string;
  tagline: string;
  glyph: string;
  bgPrimary: string;
  bgSecondary: string;
  bgPanel: string;
  borderPrimary: string;
  borderActive: string;
  accentPrimary: string;
  accentSecondary: string;
  textPrimary: string;
  textMuted: string;
  fontMono: string;
  fontHeader: string;
  borderRadius: string;
  statusBarBg: string;
}

export const CONTEXT_PROFILES: Record<ContextProfileId, ProfileThemeTokens> = {
  CYBER: {
    id: 'CYBER',
    name: 'Cyber Operations',
    tagline: 'OFFENSIVE C2 & RECON WORKBENCH',
    glyph: '❯_',
    bgPrimary: '#030712', // Stark, deep void black
    bgSecondary: '#080d1a',
    bgPanel: '#040711',
    borderPrimary: '#1e293b',
    borderActive: '#f59e0b', // Phosphor Amber focus
    accentPrimary: '#f59e0b',
    accentSecondary: '#10b981', // Terminal Green
    textPrimary: '#f8fafc',
    textMuted: '#64748b',
    fontMono: "'JetBrains Mono', monospace",
    fontHeader: "'JetBrains Mono', monospace",
    borderRadius: '0px', // Brutalist sharp corners
    statusBarBg: '#02040a'
  },
  STUDY: {
    id: 'STUDY',
    name: 'Study & Academics',
    tagline: 'EDITORIAL MIND & CS LAB',
    glyph: '0x',
    bgPrimary: '#111317', // Warm charcoal
    bgSecondary: '#181b20',
    bgPanel: '#13161c',
    borderPrimary: '#252932',
    borderActive: '#38bdf8', // Serene Sky Blue
    accentPrimary: '#38bdf8',
    accentSecondary: '#a78bfa',
    textPrimary: '#f1f5f9',
    textMuted: '#94a3b8',
    fontMono: "'JetBrains Mono', monospace",
    fontHeader: "'Newsreader', Georgia, serif", // Refined editorial serif for notes/reading
    borderRadius: '3px',
    statusBarBg: '#0d0f13'
  },
  DEV: {
    id: 'DEV',
    name: 'Systems Engineering',
    tagline: 'DISTRIBUTED SYSTEMS WORKBENCH',
    glyph: '⎇',
    bgPrimary: '#09090b', // Industrial Zinc
    bgSecondary: '#121215',
    bgPanel: '#0e0e11',
    borderPrimary: '#27272a',
    borderActive: '#e4e4e7', // Crisp Silver / Monokai
    accentPrimary: '#f97316', // Industrial Orange
    accentSecondary: '#06b6d4',
    textPrimary: '#fafafa',
    textMuted: '#71717a',
    fontMono: "'JetBrains Mono', monospace",
    fontHeader: "'Inter', -apple-system, sans-serif",
    borderRadius: '2px',
    statusBarBg: '#050507'
  }
};
