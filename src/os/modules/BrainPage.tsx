import { Placeholder } from './Placeholder';

export default function BrainPage() {
  return (
    <Placeholder
      title="Brain"
      phase="Planned, phase 2"
      summary="A 3D neural-galaxy view of the Obsidian vault. Notes are stars, links are edges, and clicking a note opens it beside the graph."
      plan={[
        'Read the graph from the existing /api/vault/graph endpoint',
        'Port the legacy galaxy renderer onto three.js',
        'Open and edit notes in a side reader',
      ]}
    />
  );
}
