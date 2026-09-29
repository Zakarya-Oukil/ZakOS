import { useEffect, useState } from 'react';
import { TacticalTerminalView } from '../../legacy/components/terminal/TacticalTerminalView';
import type { ProjectInfo } from '../../legacy/types';
import { PageFrame } from '../shell/PageFrame';

/** Phase 1: reuses the legacy shell view until a native terminal module replaces it. */
export default function TerminalPage() {
  const [projects, setProjects] = useState<ProjectInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/project/list')
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []))
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <PageFrame title="Terminal">
      <div className="h-full overflow-hidden">
        {error && <p className="p-6 text-sm text-os-danger">Could not load projects: {error}</p>}
        {!error && !projects && <p className="p-6 text-sm text-os-muted">Loading projects</p>}
        {projects && <TacticalTerminalView projects={projects} />}
      </div>
    </PageFrame>
  );
}
