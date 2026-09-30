/** Patterns for credentials that commonly end up in agent output. */
const PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{20,}\b/g, // OpenAI / Anthropic style keys
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g, // GitHub tokens
  /\bgithub_pat_[A-Za-z0-9_]{30,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g, // AWS access key id
  /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, // Slack tokens
  /\bAIza[0-9A-Za-z_-]{35}\b/g, // Google API keys
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /(\bBearer\s+)[A-Za-z0-9._~+/=-]{20,}/gi,
  /((?:api[_-]?key|secret|token|password|passwd)["']?\s*[:=]\s*["']?)[^\s"',;]{8,}/gi,
];

/** Replaces anything that looks like a credential. Used before text is written to notes, PRs or logs. */
export function scrubSecrets(text: string): string {
  let out = text;
  for (const re of PATTERNS) {
    out = out.replace(re, (match, prefix?: unknown) => (typeof prefix === 'string' ? `${prefix}[redacted]` : '[redacted]'));
  }
  return out;
}
