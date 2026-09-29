import type { AgentAdapter } from './types';
import { claudeAdapter } from './claude';
import { hermesAdapter } from './hermes';
import { antigravityAdapter } from './antigravity';

const adapters: AgentAdapter[] = [claudeAdapter, hermesAdapter, antigravityAdapter];

export function listAdapters(): AgentAdapter[] {
  return adapters;
}

export function getAdapter(id: string): AgentAdapter | undefined {
  return adapters.find((a) => a.id === id);
}
