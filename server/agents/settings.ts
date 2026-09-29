import fs from 'node:fs';
import path from 'node:path';

export type PermissionMode = 'acceptEdits' | 'default';

export interface AgentSettings {
  /**
   * acceptEdits: file edits are auto-approved, everything else follows the CLI's own rules.
   * default: each CLI's own default (asks for most things).
   */
  permissionMode: PermissionMode;
  /** Model passed to Hermes with -m. Blank uses whatever Hermes has configured. */
  hermesModel: string;
}

const FILE = path.resolve(process.cwd(), 'data', 'agent-settings.json');
const MODES: PermissionMode[] = ['acceptEdits', 'default'];

const DEFAULTS: AgentSettings = { permissionMode: 'acceptEdits', hermesModel: '' };

export function getSettings(): AgentSettings {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return {
      permissionMode: MODES.includes(raw.permissionMode) ? raw.permissionMode : DEFAULTS.permissionMode,
      hermesModel: typeof raw.hermesModel === 'string' ? raw.hermesModel.slice(0, 120) : DEFAULTS.hermesModel,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function updateSettings(patch: Partial<AgentSettings>): AgentSettings {
  const next = { ...getSettings() };
  if (patch.permissionMode !== undefined) {
    if (!MODES.includes(patch.permissionMode)) throw new Error('Invalid permission mode');
    next.permissionMode = patch.permissionMode;
  }
  if (patch.hermesModel !== undefined) {
    const m = String(patch.hermesModel).trim();
    // Model ids are simple tokens; reject anything that could be read as a flag or contain spaces.
    if (m && !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/.test(m)) throw new Error('Invalid model id');
    next.hermesModel = m;
  }
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2));
  return next;
}
