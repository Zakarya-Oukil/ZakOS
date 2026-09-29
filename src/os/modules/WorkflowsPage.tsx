import { Placeholder } from './Placeholder';

export default function WorkflowsPage() {
  return (
    <Placeholder
      title="Workflows"
      phase="Planned, phase 3"
      summary="An orchestrator splits a task across sub-agents, a reviewer checks their results, and you get one final report. This page will show that team working live."
      plan={[
        'Orchestrator and sub-agents run through the same session bridge as the Agents page',
        'A reviewer pass before anything comes back to you',
        'Reusable workflows saved from tasks you repeat',
      ]}
    />
  );
}
