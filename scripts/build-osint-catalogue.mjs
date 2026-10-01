// Builds server/os/cyberlab/catalogue.json from jivoi/awesome-osint (CC BY-SA 4.0).
// Usage: node scripts/build-osint-catalogue.mjs [path-to-README.md]
// Only the sections useful for junior offensive security work are kept, each mapped to a recon phase.
import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2];
const md = src ? fs.readFileSync(src, 'utf8') : await (await fetch('https://raw.githubusercontent.com/jivoi/awesome-osint/master/README.md')).text();

const KEEP = {
  'Data Breach Search Engines': ['identity', 'Breach and leak'],
  'Username Check': ['identity', 'Username'],
  'People Investigations': ['identity', 'People'],
  'Email Search / Email Check': ['identity', 'Email'],
  'Phone Number Research': ['identity', 'Phone'],
  'Company Research': ['organisation', 'Company'],
  'Domain and IP Research': ['infrastructure', 'Domain and IP'],
  DNS: ['infrastructure', 'DNS'],
  'Web History and Website Capture': ['infrastructure', 'Web history'],
  'Code Search': ['code', 'Code search'],
  GitHub: ['code', 'GitHub'],
  Pastebins: ['code', 'Pastes'],
  'File Search': ['files', 'File search'],
  'Document and Slides Search': ['files', 'Documents'],
  'Image Search': ['media', 'Image search'],
  'Image Analysis': ['media', 'Image analysis'],
  'Threat Actor Search': ['threat', 'Threat actors'],
  'Threat Intelligence': ['threat', 'Threat intelligence'],
  'Speciality Search Engines': ['search', 'Specialist search'],
  'Web Monitoring': ['infrastructure', 'Monitoring'],
  'Other Tools': ['misc', 'Other tools'],
};

const lines = md.split(/\r?\n/);
const out = [];
let current = null;
for (const line of lines) {
  const h = line.match(/^#{2,4}\s+(?:\[[^\]]*\]\([^)]*\)\s*)?(.+?)\s*$/);
  if (h) {
    const name = h[1].replace(/^[^\w]+/, '').trim();
    current = KEEP[name] ? { phase: KEEP[name][0], group: KEEP[name][1] } : null;
    continue;
  }
  if (!current) continue;
  const m = line.match(/^\*\s+\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)\s*(?:[-–]\s*(.*))?$/);
  if (!m) continue;
  out.push({ name: m[1].trim(), url: m[2], note: (m[3] ?? '').replace(/\s+/g, ' ').trim().slice(0, 300), phase: current.phase, group: current.group });
}

const seen = new Set();
const unique = out.filter((e) => (seen.has(e.url) ? false : seen.add(e.url)));
const dest = path.resolve('server/os/cyberlab/catalogue.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(
  dest,
  JSON.stringify({ source: 'https://github.com/jivoi/awesome-osint', licence: 'CC BY-SA 4.0', fetched: new Date().toISOString().slice(0, 10), entries: unique }, null, 1),
);
const byGroup = {};
for (const e of unique) byGroup[e.group] = (byGroup[e.group] ?? 0) + 1;
console.log(unique.length, 'entries', JSON.stringify(byGroup));
