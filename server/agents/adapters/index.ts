import type { AgentAdapter } from './types';
import { claudeAdapter } from './claude';
import { hermesAdapter } from './hermes';

const adapters: AgentAdapter[] = [claudeAdapter, hermesAdapter];

export function listAdapters(): AgentAdapter[] {
  return adapters;
}

export function getAdapter(id: string): AgentAdapter | undefined {
  return adapters.find((a) => a.id === id);
}
