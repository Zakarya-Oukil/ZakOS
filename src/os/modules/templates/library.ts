/** The built-in starter library. Everything here is plain text the owner can read before installing. */
export type Kind = 'workflow' | 'skill' | 'prompt' | 'theme' | 'project';

export interface Item {
  id: string;
  kind: Kind;
  title: string;
  blurb: string;
  /** What gets created: shown in the preview. */
  body: string;
  extra?: Record<string, string>;
}

export const KIND_LABEL: Record<Kind, string> = {
  workflow: 'Workflows',
  skill: 'Skills',
  prompt: 'Prompts',
  theme: 'Themes',
  project: 'Project starters',
};

export const LIBRARY: Item[] = [
  {
    id: 'wf-review-changes',
    kind: 'workflow',
    title: 'Review the pending changes',
    blurb: 'Reads the uncommitted diff and reports bugs and risky edits, without changing files.',
    body: 'Review the uncommitted changes in this repository. List real bugs first, then risky or unclear edits, then small cleanups. Do not modify any files.',
  },
  {
    id: 'wf-tests-latest',
    kind: 'workflow',
    title: 'Write tests for the latest commit',
    blurb: 'Adds tests that cover what the newest commit changed.',
    body: 'Look at the latest commit. Write focused tests for the behaviour it changed, run them, and fix the tests (not the code) until they pass. Report what you covered.',
  },
  {
    id: 'wf-readme',
    kind: 'workflow',
    title: 'Bring the README up to date',
    blurb: 'Checks the README against the code and fixes what is stale.',
    body: 'Compare README.md with the current code, scripts and folder layout. Fix anything stale or missing: install steps, commands, structure. Keep the existing tone and do not invent features.',
  },
  {
    id: 'sk-commit-style',
    kind: 'skill',
    title: 'Commit message style',
    blurb: 'Keeps commit messages short, in the imperative, with a clear scope.',
    body: 'When writing a commit message: one subject line under 70 characters in the imperative mood, a blank line, then a short body that says why the change was made. Never mention tools or assistants in the message.',
    extra: { name: 'commit-style', description: 'Use when writing or suggesting a git commit message.' },
  },
  {
    id: 'sk-explain-code',
    kind: 'skill',
    title: 'Explain code plainly',
    blurb: 'Explanations that start with what the code is for, then how it works.',
    body: 'When asked to explain code: first say in one sentence what it is for, then walk through the flow in the order it runs, then list anything surprising. Avoid jargon the reader has not used.',
    extra: { name: 'explain-plainly', description: 'Use when the user asks what a piece of code does or how it works.' },
  },
  {
    id: 'pr-bug-hunt',
    kind: 'prompt',
    title: 'Bug hunt',
    blurb: 'A careful pass for correctness bugs in a file or folder.',
    body: 'Read the code I point at and look for correctness bugs only: wrong conditions, unhandled errors, race conditions, off-by-one errors. For each, show the line, the failing input and the fix. Skip style.',
  },
  {
    id: 'pr-plan',
    kind: 'prompt',
    title: 'Plan before coding',
    blurb: 'Asks for a short plan and waits for approval before editing.',
    body: 'Before changing anything, write a short plan: the files you will touch, the order, and what could break. Wait for me to say go.',
  },
  {
    id: 'th-chartreuse-calm',
    kind: 'theme',
    title: 'Chartreuse, calm',
    blurb: 'A green accent with slower motion.',
    body: 'Accent chartreuse, background contours, calm motion.',
    extra: { accent: 'chartreuse', backdrop: 'contours', motion: 'calm' },
  },
  {
    id: 'th-cobalt-still',
    kind: 'theme',
    title: 'Cobalt, still',
    blurb: 'A blue accent with a static background, easy on the eyes.',
    body: 'Accent cobalt, still background, calm motion.',
    extra: { accent: 'cobalt', backdrop: 'still', motion: 'calm' },
  },
  {
    id: 'th-saffron-plain',
    kind: 'theme',
    title: 'Saffron, plain',
    blurb: 'A warm accent and no background animation at all.',
    body: 'Accent saffron, no background, motion off.',
    extra: { accent: 'saffron', backdrop: 'none', motion: 'off' },
  },
  {
    id: 'pj-node-ts',
    kind: 'project',
    title: 'Node and TypeScript',
    blurb: 'A minimal TypeScript project with a dev script.',
    body: 'package.json, tsconfig.json, src/index.ts, .gitignore, README.md',
    extra: { starter: 'node-ts' },
  },
  {
    id: 'pj-static-site',
    kind: 'project',
    title: 'Static website',
    blurb: 'An HTML page and a stylesheet, no build step.',
    body: 'index.html, styles.css, .gitignore, README.md',
    extra: { starter: 'static-site' },
  },
  {
    id: 'pj-python-cli',
    kind: 'project',
    title: 'Python command line tool',
    blurb: 'A single-file argparse program.',
    body: 'main.py, .gitignore, README.md',
    extra: { starter: 'python-cli' },
  },
];
