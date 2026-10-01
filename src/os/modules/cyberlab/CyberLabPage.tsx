import { useCallback, useEffect, useState } from 'react';
import type { ModuleProps } from '../registry';
import { PageFrame } from '../../shell/PageFrame';
import { Tabs } from '../../ui';
import { cyberApi, type CaseRow } from './api';
import { ToolsTab } from './ToolsTab';
import { CasesTab } from './CasesTab';
import { CatalogueTab } from './CatalogueTab';
import { StudyTab } from './StudyTab';
import './cyberlab.css';

const CASE_KEY = 'zakos_cyberlab_case';
const TABS = [
  { id: 'tools', label: 'Tools' },
  { id: 'cases', label: 'Cases' },
  { id: 'catalogue', label: 'Catalogue' },
  { id: 'study', label: 'Study' },
];

/** Route: #/cyberlab/<tab>/<id>. Tools take a tool id, Cases take a case id. */
export default function CyberLabPage({ route, navigate }: ModuleProps) {
  const tab = TABS.some((t) => t.id === route[0]) ? route[0] : 'tools';
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [caseId, setCaseId] = useState(() => {
    try {
      return window.localStorage.getItem(CASE_KEY) ?? '';
    } catch {
      return '';
    }
  });

  const loadCases = useCallback(() => {
    cyberApi.cases().then((r) => setCases(r.cases)).catch(() => undefined);
  }, []);
  useEffect(loadCases, [loadCases]);
  useEffect(() => {
    try {
      window.localStorage.setItem(CASE_KEY, caseId);
    } catch {
      /* storage blocked */
    }
  }, [caseId]);
  // A case that was deleted cannot stay selected.
  useEffect(() => {
    if (caseId && cases.length && !cases.some((c) => c.id === caseId)) setCaseId('');
  }, [cases, caseId]);

  return (
    <PageFrame title="CyberLab" leading={<Tabs aria-label="CyberLab" className="border-b-0" tabs={TABS} value={tab} onChange={(id) => navigate('cyberlab', id)} />}>
      <div className="h-full overflow-y-auto">
        {tab === 'tools' && <div className="h-full"><ToolsTab cases={cases} caseId={caseId} onCase={setCaseId} toolId={route[1]} onTool={(id) => navigate('cyberlab', 'tools', id)} onRan={loadCases} /></div>}
        {tab === 'cases' && (
          <CasesTab
            cases={cases}
            openId={route[1]}
            onOpen={(id) => (id ? navigate('cyberlab', 'cases', id) : navigate('cyberlab', 'cases'))}
            onChanged={loadCases}
            onUseCase={(id) => {
              setCaseId(id);
              navigate('cyberlab', 'tools');
            }}
          />
        )}
        {tab === 'catalogue' && <CatalogueTab />}
        {tab === 'study' && <StudyTab />}
      </div>
    </PageFrame>
  );
}
