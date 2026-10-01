import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

export type Plan = 'free' | 'pro' | 'team';
const RANK: Record<Plan, number> = { free: 0, pro: 1, team: 2 };

export interface LicenceInfo {
  plan: Plan;
  licensee: string | null;
  expires: number | null;
  reason: string | null;
  version: string;
  buyUrl: string;
  manifestUrl: string;
  hasPublicKey: boolean;
}

export const planAtLeast = (have: Plan, need: Plan) => RANK[have] >= RANK[need];

/** Reload everywhere a licence is shown after it changes. */
export const LICENCE_EVENT = 'zakos:licence-changed';

export function useLicence() {
  const [info, setInfo] = useState<LicenceInfo | null>(null);
  const refresh = useCallback(() => {
    api<LicenceInfo>('/api/licence')
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);
  useEffect(() => {
    refresh();
    window.addEventListener(LICENCE_EVENT, refresh);
    return () => window.removeEventListener(LICENCE_EVENT, refresh);
  }, [refresh]);
  return { info, plan: info?.plan ?? 'free', refresh };
}
