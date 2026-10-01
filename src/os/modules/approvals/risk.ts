/**
 * A plain-language risk label for an action an agent was refused. It is a heuristic over the tool name and the
 * command text, meant to help the owner triage, never to replace reading the action itself.
 */
export type Risk = 'safe' | 'caution' | 'dangerous';

export interface RiskInfo {
  level: Risk;
  reason: string;
}

const DANGEROUS: Array<[RegExp, string]> = [
  [/\brm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r|--recursive)\b/i, 'Deletes files recursively'],
  [/\b(del|erase)\s+.*\/s\b|Remove-Item\b.*-Recurse/i, 'Deletes files recursively'],
  [/\bgit\s+push\b.*(--force|-f\b)/i, 'Force-pushes and can overwrite remote history'],
  [/\bgit\s+reset\s+--hard\b|\bgit\s+clean\s+-[a-z]*f/i, 'Throws away uncommitted work'],
  [/\b(curl|wget|iwr|Invoke-WebRequest)\b[^|]*\|\s*(sh|bash|iex|powershell)/i, 'Runs a script downloaded from the internet'],
  [/\bsudo\b|\bchmod\s+(-R\s+)?777\b|\bchown\s+-R\b/i, 'Changes permissions or runs as administrator'],
  [/\b(drop|truncate)\s+(table|database)\b/i, 'Destroys database contents'],
  [/\b(mkfs|format\s+[a-z]:|diskpart)\b/i, 'Can erase a disk'],
  [/\.ssh\b|id_rsa|\.aws[\\/]credentials|\.env\b.*(curl|wget|nc)\b/i, 'Touches credentials'],
];

const CAUTION: Array<[RegExp, string]> = [
  [/\bgit\s+push\b/i, 'Publishes commits'],
  [/\b(npm|pnpm|yarn|pip|pip3|cargo|go)\s+(install|add|get|i)\b/i, 'Installs packages that run third-party code'],
  [/\b(rm|del|unlink|rmdir)\b/i, 'Deletes files'],
  [/\b(curl|wget|Invoke-WebRequest|iwr)\b/i, 'Makes a network request'],
  [/\b(docker|kubectl|ssh|scp)\b/i, 'Reaches containers or other machines'],
  [/\bgit\s+(checkout|switch|merge|rebase|stash)\b/i, 'Changes the working tree'],
];

const SAFE_TOOLS = new Set(['Read', 'Glob', 'Grep', 'LS', 'NotebookRead', 'WebSearch', 'TodoWrite']);
const SAFE_COMMANDS = /^\s*(ls|dir|cat|type|pwd|echo|head|tail|wc|git\s+(status|log|diff|show|branch)|node\s+--version|npm\s+(run\s+)?(test|lint|build)|tsc\b.*--noEmit)\b/i;

export function assess(tool: string, summary: string, rule: string): RiskInfo {
  const text = `${summary}\n${rule}`;
  for (const [re, reason] of DANGEROUS) if (re.test(text)) return { level: 'dangerous', reason };
  if (SAFE_TOOLS.has(tool) || tool === 'WebFetch') return { level: 'safe', reason: 'Only reads information' };
  if (tool === 'Bash' && SAFE_COMMANDS.test(summary.replace(/^Bash:?\s*/i, ''))) return { level: 'safe', reason: 'A read-only or check command' };
  for (const [re, reason] of CAUTION) if (re.test(text)) return { level: 'caution', reason };
  if (tool === 'Write' || tool === 'Edit' || tool === 'MultiEdit' || tool === 'NotebookEdit') return { level: 'caution', reason: 'Changes a file in the project' };
  return { level: 'caution', reason: 'Runs a command that is not on the known-safe list' };
}

export const RISK_ORDER: Record<Risk, number> = { dangerous: 0, caution: 1, safe: 2 };
export const RISK_LABEL: Record<Risk, string> = { safe: 'Safe', caution: 'Caution', dangerous: 'Dangerous' };
