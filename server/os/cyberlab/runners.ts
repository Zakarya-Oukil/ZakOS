import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import zlib from 'node:zlib';

/**
 * Built-in CyberLab tools. Every one calls a real public source or inspects real input; nothing is simulated.
 * A tool returns entities and edges as well as its raw data, so a case can build a link graph from the run.
 */
export type EntityType = 'domain' | 'ip' | 'email' | 'username' | 'url' | 'asn' | 'hash' | 'org' | 'host' | 'service' | 'account' | 'file';
export interface Entity {
  type: EntityType;
  value: string;
}
export interface Edge {
  a: string;
  b: string;
  rel: string;
}
export interface RunResult {
  summary: string;
  data: unknown;
  entities: Entity[];
  edges: Edge[];
}
export interface RunContext {
  key?: string;
  file?: Buffer;
  fileName?: string;
}
export type InputKind = 'domain' | 'ip' | 'email' | 'username' | 'url' | 'file' | 'text';
export interface Runner {
  id: string;
  name: string;
  group: 'Domain and DNS' | 'IP and ASN' | 'Identity' | 'Files' | 'Web' | 'Keyed sources';
  blurb: string;
  /** passive: reads public records. active: sends requests to the target itself. */
  mode: 'passive' | 'active';
  input: { kind: InputKind; label: string; placeholder: string };
  /** Name of the secret in the encrypted store this tool needs. */
  needsKey?: string;
  /** Who receives the target when the tool runs, besides this machine. */
  sendsTo: string;
  run(input: string, ctx: RunContext): Promise<RunResult>;
}

// ---------------------------------------------------------------------------------------------- helpers

const UA = 'ZakOS-CyberLab/1.0 (+local research tool)';
const key = (type: EntityType, value: string) => `${type}:${value}`;
const ent = (type: EntityType, value: string): Entity => ({ type, value });
const edge = (a: Entity, b: Entity, rel: string): Edge => ({ a: key(a.type, a.value), b: key(b.type, b.value), rel });
const uniq = (list: Entity[]) => [...new Map(list.map((e) => [key(e.type, e.value), e])).values()];

const DOMAIN = /^(?=.{1,253}$)(?!-)([a-z0-9-]{1,63}(?<!-)\.)+[a-z]{2,63}$/i;
export function cleanDomain(v: string): string {
  const d = v.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/?#].*$/, '').replace(/\.$/, '');
  if (!DOMAIN.test(d)) throw new Error('Enter a domain like example.com');
  return d;
}
export function cleanIp(v: string): string {
  const ip = v.trim();
  if (!net.isIP(ip)) throw new Error('Enter a valid IPv4 or IPv6 address');
  return ip;
}
export function cleanEmail(v: string): string {
  const e = v.trim().toLowerCase();
  if (!/^[^\s@]{1,64}@[^\s@]{1,255}$/.test(e)) throw new Error('Enter an email address');
  cleanDomain(e.split('@')[1]);
  return e;
}
export function cleanUsername(v: string): string {
  const u = v.trim().replace(/^@/, '');
  if (!/^[A-Za-z0-9._-]{1,39}$/.test(u)) throw new Error('Usernames use letters, numbers, dot, dash and underscore (up to 39)');
  return u;
}
export function cleanUrl(v: string): URL {
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(v.trim()) ? v.trim() : `https://${v.trim()}`);
  } catch {
    throw new Error('Enter a web address');
  }
  if (!/^https?:$/.test(u.protocol)) throw new Error('Only http and https addresses');
  return u;
}

async function http(url: string, opts: { method?: string; headers?: Record<string, string>; timeout?: number; max?: number; redirect?: RequestRedirect } = {}) {
  const res = await fetch(url, { method: opts.method ?? 'GET', redirect: opts.redirect ?? 'follow', headers: { 'user-agent': UA, accept: 'application/json, text/plain, */*', ...opts.headers }, signal: AbortSignal.timeout(opts.timeout ?? 20_000) });
  const max = opts.max ?? 2_000_000;
  const reader = res.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader && opts.method !== 'HEAD') {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
  }
  return { status: res.status, headers: res.headers, url: res.url, text: Buffer.concat(chunks).toString('utf8') };
}
async function json<T = unknown>(url: string, opts: Parameters<typeof http>[1] = {}): Promise<{ status: number; body: T | null }> {
  const r = await http(url, opts);
  try {
    return { status: r.status, body: JSON.parse(r.text) as T };
  } catch {
    return { status: r.status, body: null };
  }
}
/** Public archives are often busy. Retries a few times on a server error before giving up. */
async function jsonRetry<T = unknown>(url: string, opts: Parameters<typeof http>[1] = {}, tries = 3) {
  let last = await json<T>(url, opts);
  for (let i = 1; i < tries && !last.body && last.status >= 500; i++) {
    await new Promise((r) => setTimeout(r, 2500 * i));
    last = await json<T>(url, opts);
  }
  return last;
}
const settle = async <T>(p: Promise<T>): Promise<T | null> => p.catch(() => null);

// ---------------------------------------------------------------------------------------------- Domain and DNS

const dnsRecords: Runner = {
  id: 'dns-records',
  name: 'DNS records',
  group: 'Domain and DNS',
  blurb: 'A, AAAA, MX, NS, TXT, CNAME, SOA and CAA records from your system resolver.',
  mode: 'passive',
  input: { kind: 'domain', label: 'Domain', placeholder: 'example.com' },
  sendsTo: 'your DNS resolver',
  async run(input) {
    const domain = cleanDomain(input);
    const d = ent('domain', domain);
    const [a, aaaa, mx, ns, txt, cname, soa, caa] = await Promise.all([
      settle(dns.resolve4(domain)),
      settle(dns.resolve6(domain)),
      settle(dns.resolveMx(domain)),
      settle(dns.resolveNs(domain)),
      settle(dns.resolveTxt(domain)),
      settle(dns.resolveCname(domain)),
      settle(dns.resolveSoa(domain)),
      settle(dns.resolveCaa(domain)),
    ]);
    const entities: Entity[] = [d];
    const edges: Edge[] = [];
    for (const ip of [...(a ?? []), ...(aaaa ?? [])]) {
      const e = ent('ip', ip);
      entities.push(e);
      edges.push(edge(d, e, 'resolves to'));
    }
    for (const m of mx ?? []) {
      const e = ent('host', m.exchange.toLowerCase());
      entities.push(e);
      edges.push(edge(d, e, `mail (priority ${m.priority})`));
    }
    for (const n of ns ?? []) {
      const e = ent('host', n.toLowerCase());
      entities.push(e);
      edges.push(edge(d, e, 'name server'));
    }
    for (const c of cname ?? []) {
      const e = ent('domain', c.toLowerCase());
      entities.push(e);
      edges.push(edge(d, e, 'alias of'));
    }
    const count = (a?.length ?? 0) + (aaaa?.length ?? 0) + (mx?.length ?? 0) + (ns?.length ?? 0) + (txt?.length ?? 0);
    return { summary: `${count} records for ${domain}`, data: { a, aaaa, mx, ns, txt: txt?.map((t) => t.join('')), cname, soa, caa }, entities: uniq(entities), edges };
  },
};

const emailAuth: Runner = {
  id: 'email-auth',
  name: 'Email security (SPF, DMARC, DKIM)',
  group: 'Domain and DNS',
  blurb: 'Reads SPF, DMARC, MTA-STS and BIMI records and checks a short list of common DKIM selectors. A missing selector does not prove DKIM is off.',
  mode: 'passive',
  input: { kind: 'domain', label: 'Domain', placeholder: 'example.com' },
  sendsTo: 'your DNS resolver',
  async run(input) {
    const domain = cleanDomain(input);
    const txt = async (name: string) => ((await settle(dns.resolveTxt(name))) ?? []).map((t) => t.join(''));
    const [root, dmarc, mtasts, bimi] = await Promise.all([txt(domain), txt(`_dmarc.${domain}`), txt(`_mta-sts.${domain}`), txt(`default._bimi.${domain}`)]);
    const spf = root.find((t) => /^v=spf1\b/i.test(t));
    const dmarcRec = dmarc.find((t) => /^v=DMARC1\b/i.test(t));
    const selectors = ['default', 'google', 'selector1', 'selector2', 'k1', 'k2', 'mail', 'dkim', 's1', 's2', 'mandrill', 'smtp'];
    const found: Array<{ selector: string; record: string }> = [];
    await Promise.all(
      selectors.map(async (s) => {
        const r = (await txt(`${s}._domainkey.${domain}`)).find((t) => /v=DKIM1|p=/i.test(t));
        if (r) found.push({ selector: s, record: r.slice(0, 200) });
      }),
    );
    const findings: Array<{ level: 'good' | 'warn' | 'bad'; text: string }> = [];
    if (!spf) findings.push({ level: 'bad', text: 'No SPF record: anyone can claim to send mail as this domain without an SPF check failing.' });
    else if (/\+all\b/.test(spf)) findings.push({ level: 'bad', text: 'SPF ends in +all, which allows every server.' });
    else if (/~all\b/.test(spf)) findings.push({ level: 'warn', text: 'SPF uses ~all (soft fail). Mail from other servers is flagged, not rejected.' });
    else if (/-all\b/.test(spf)) findings.push({ level: 'good', text: 'SPF uses -all (hard fail).' });
    else if (/\?all\b/.test(spf)) findings.push({ level: 'warn', text: 'SPF uses ?all (neutral), which gives no protection.' });
    if (!dmarcRec) findings.push({ level: 'bad', text: 'No DMARC record: receivers have no published policy for spoofed mail.' });
    else {
      const p = /\bp=(none|quarantine|reject)/i.exec(dmarcRec)?.[1]?.toLowerCase();
      if (p === 'none') findings.push({ level: 'warn', text: 'DMARC policy is p=none (monitor only).' });
      else if (p) findings.push({ level: 'good', text: `DMARC policy is p=${p}.` });
      if (!/\brua=/i.test(dmarcRec)) findings.push({ level: 'warn', text: 'DMARC has no rua reporting address.' });
    }
    if (found.length === 0) findings.push({ level: 'warn', text: 'No DKIM record found on the common selectors tried. The real selector may be a different name.' });
    return { summary: `${findings.filter((f) => f.level === 'bad').length} problems, ${findings.filter((f) => f.level === 'warn').length} warnings`, data: { spf, dmarc: dmarcRec, mtaSts: mtasts[0], bimi: bimi[0], dkim: found, selectorsTried: selectors, findings }, entities: [ent('domain', domain)], edges: [] };
  },
};

interface RdapDoc {
  ldhName?: string;
  handle?: string;
  status?: string[];
  events?: Array<{ eventAction: string; eventDate: string }>;
  nameservers?: Array<{ ldhName?: string }>;
  entities?: Array<{ roles?: string[]; vcardArray?: [string, Array<[string, unknown, string, string]>] }>;
  name?: string;
  country?: string;
  startAddress?: string;
  endAddress?: string;
  type?: string;
}
const vcardName = (e: NonNullable<RdapDoc['entities']>[number]) => e.vcardArray?.[1]?.find((p) => p[0] === 'fn')?.[3];

const rdapDomain: Runner = {
  id: 'rdap-domain',
  name: 'WHOIS (RDAP)',
  group: 'Domain and DNS',
  blurb: 'Registration data from the registry over RDAP: registrar, dates, status and name servers. Personal fields are usually redacted.',
  mode: 'passive',
  input: { kind: 'domain', label: 'Domain', placeholder: 'example.com' },
  sendsTo: 'rdap.org and the registry',
  async run(input) {
    const domain = cleanDomain(input);
    const r = await json<RdapDoc>(`https://rdap.org/domain/${encodeURIComponent(domain)}`);
    if (r.status === 404) throw new Error('No registration found for that domain');
    if (!r.body) throw new Error(`The registry did not return data (HTTP ${r.status})`);
    const b = r.body;
    const registrar = b.entities?.find((e) => e.roles?.includes('registrar'));
    const events = Object.fromEntries((b.events ?? []).map((e) => [e.eventAction, e.eventDate]));
    const ns = (b.nameservers ?? []).map((n) => n.ldhName?.toLowerCase()).filter((x): x is string => !!x);
    const d = ent('domain', domain);
    const entities: Entity[] = [d, ...ns.map((n) => ent('host', n))];
    const edges = ns.map((n) => edge(d, ent('host', n), 'name server'));
    const reg = registrar ? vcardName(registrar) : undefined;
    if (reg) {
      entities.push(ent('org', reg));
      edges.push(edge(d, ent('org', reg), 'registrar'));
    }
    return { summary: `${reg ?? 'Registrar not listed'}, registered ${events.registration?.slice(0, 10) ?? 'date not listed'}`, data: { domain: b.ldhName, status: b.status, registrar: reg, events, nameservers: ns }, entities: uniq(entities), edges };
  },
};

const ctSubdomains: Runner = {
  id: 'ct-subdomains',
  name: 'Subdomains (certificate transparency)',
  group: 'Domain and DNS',
  blurb: 'Hostnames that appear in public TLS certificates for the domain, from crt.sh. Passive, and it finds names that were never published in DNS listings.',
  mode: 'passive',
  input: { kind: 'domain', label: 'Domain', placeholder: 'example.com' },
  sendsTo: 'crt.sh',
  async run(input) {
    const domain = cleanDomain(input);
    const r = await jsonRetry<Array<{ name_value: string; not_before: string; issuer_name: string }>>(`https://crt.sh/?q=${encodeURIComponent('%.' + domain)}&output=json`, { timeout: 45_000, max: 12_000_000 });
    if (!r.body) throw new Error(`crt.sh did not answer with data (HTTP ${r.status}). It is often busy, so try again in a minute.`);
    const names = new Map<string, string>();
    for (const row of r.body)
      for (const n of row.name_value.split('\n')) {
        const h = n.trim().toLowerCase().replace(/^\*\./, '');
        if (h.endsWith(domain) && !names.has(h)) names.set(h, row.not_before?.slice(0, 10));
      }
    const list = [...names.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([host, firstSeen]) => ({ host, firstSeen }));
    const d = ent('domain', domain);
    const entities = [d, ...list.filter((x) => x.host !== domain).map((x) => ent('domain', x.host))];
    return { summary: `${list.length} hostnames from ${r.body.length} certificates`, data: { hostnames: list, certificates: r.body.length }, entities: entities.slice(0, 400), edges: entities.slice(1, 400).map((e) => edge(d, e, 'subdomain')) };
  },
};

const wayback: Runner = {
  id: 'wayback-urls',
  name: 'Archived URLs (Wayback)',
  group: 'Domain and DNS',
  blurb: 'Unique URLs the Internet Archive has captured for the domain. Useful for old paths, parameters and forgotten files.',
  mode: 'passive',
  input: { kind: 'domain', label: 'Domain', placeholder: 'example.com' },
  sendsTo: 'web.archive.org',
  async run(input) {
    const domain = cleanDomain(input);
    const r = await jsonRetry<string[][]>(`https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(domain)}/*&output=json&fl=original,timestamp,statuscode&collapse=urlkey&limit=500`, { timeout: 40_000, max: 6_000_000 });
    if (!r.body) throw new Error(`The Internet Archive did not return data (HTTP ${r.status})`);
    const rows = r.body.slice(1).map(([url, ts, code]) => ({ url, captured: `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`, status: code }));
    const d = ent('domain', domain);
    return { summary: `${rows.length} archived URLs${rows.length === 500 ? ' (first 500)' : ''}`, data: { urls: rows }, entities: [d], edges: [] };
  },
};

// ---------------------------------------------------------------------------------------------- IP and ASN

const reverseV4 = (ip: string) => ip.split('.').reverse().join('.');

const ipIntel: Runner = {
  id: 'ip-intel',
  name: 'IP, ASN and exposed ports',
  group: 'IP and ASN',
  blurb: 'Reverse DNS, origin ASN (Team Cymru), network registration (RDAP) and the ports, CPEs and CVEs Shodan InternetDB has seen on the address. No key needed.',
  mode: 'passive',
  input: { kind: 'ip', label: 'IP address', placeholder: '8.8.8.8' },
  sendsTo: 'rdap.org, Team Cymru DNS and internetdb.shodan.io',
  async run(input) {
    const ip = cleanIp(input);
    const ipE = ent('ip', ip);
    const entities: Entity[] = [ipE];
    const edges: Edge[] = [];
    const ptr = (await settle(dns.reverse(ip))) ?? [];
    let asn: { asn: string; prefix: string; country: string; registry: string; name?: string } | null = null;
    if (net.isIPv4(ip)) {
      const o = (await settle(dns.resolveTxt(`${reverseV4(ip)}.origin.asn.cymru.com`)))?.[0]?.join('');
      if (o) {
        const [a, prefix, country, registry] = o.split('|').map((s) => s.trim());
        const first = a.split(' ')[0];
        const nm = (await settle(dns.resolveTxt(`AS${first}.asn.cymru.com`)))?.[0]?.join('').split('|').pop()?.trim();
        asn = { asn: first, prefix, country, registry, name: nm };
      }
    }
    const [rdap, idb] = await Promise.all([
      settle(json<RdapDoc>(`https://rdap.org/ip/${encodeURIComponent(ip)}`)),
      settle(json<{ ports: number[]; cpes: string[]; hostnames: string[]; vulns: string[]; tags: string[] }>(`https://internetdb.shodan.io/${encodeURIComponent(ip)}`)),
    ]);
    for (const h of ptr) {
      const e = ent('host', h.toLowerCase());
      entities.push(e);
      edges.push(edge(ipE, e, 'reverse DNS'));
    }
    if (asn) {
      const e = ent('asn', `AS${asn.asn}`);
      entities.push(e);
      edges.push(edge(ipE, e, 'announced by'));
      if (asn.name) {
        const o = ent('org', asn.name);
        entities.push(o);
        edges.push(edge(e, o, 'operated by'));
      }
    }
    const idbData = idb?.status === 200 ? idb.body : null;
    for (const h of idbData?.hostnames ?? []) {
      const e = ent('host', h.toLowerCase());
      entities.push(e);
      edges.push(edge(ipE, e, 'hostname seen'));
    }
    for (const p of idbData?.ports ?? []) {
      const e = ent('service', `${ip}:${p}`);
      entities.push(e);
      edges.push(edge(ipE, e, 'open port'));
    }
    const net_ = rdap?.body;
    return {
      summary: `${asn ? `AS${asn.asn} ${asn.name ?? ''}`.trim() : 'ASN unknown'}, ${idbData ? `${idbData.ports.length} ports, ${idbData.vulns.length} CVEs listed` : 'no InternetDB record'}`,
      data: { reverseDns: ptr, asn, network: net_ ? { name: net_.name, country: net_.country, range: `${net_.startAddress ?? ''} - ${net_.endAddress ?? ''}`, type: net_.type, handle: net_.handle } : null, internetDb: idbData, notes: 'InternetDB lists what Shodan has observed. It is not a live scan, and an empty result does not mean the host is closed.' },
      entities: uniq(entities),
      edges,
    };
  },
};

// ---------------------------------------------------------------------------------------------- Identity

const emailProfile: Runner = {
  id: 'email-profile',
  name: 'Email address check',
  group: 'Identity',
  blurb: 'Syntax, the domain’s mail servers, whether a Gravatar exists for the address, and public breach exposure from XposedOrNot (free, no key). It never sends mail to the address.',
  mode: 'passive',
  input: { kind: 'email', label: 'Email address', placeholder: 'name@example.com' },
  sendsTo: 'gravatar.com and api.xposedornot.com',
  async run(input) {
    const email = cleanEmail(input);
    const domain = email.split('@')[1];
    const e = ent('email', email);
    const [mx, gravatar, xon] = await Promise.all([
      settle(dns.resolveMx(domain)),
      settle(http(`https://gravatar.com/avatar/${crypto.createHash('md5').update(email).digest('hex')}?d=404`, { method: 'HEAD', timeout: 10_000 })),
      settle(json<{ breaches?: string[][]; Error?: string }>(`https://api.xposedornot.com/v1/check-email/${encodeURIComponent(email)}`, { timeout: 15_000 })),
    ]);
    const breaches = xon?.status === 200 ? (xon.body?.breaches?.flat() ?? []) : [];
    const entities: Entity[] = [e, ent('domain', domain)];
    const edges: Edge[] = [edge(e, ent('domain', domain), 'at domain')];
    for (const m of mx ?? []) {
      entities.push(ent('host', m.exchange.toLowerCase()));
      edges.push(edge(ent('domain', domain), ent('host', m.exchange.toLowerCase()), 'mail'));
    }
    return {
      summary: `${mx?.length ? 'Domain accepts mail' : 'No mail servers'}, ${gravatar?.status === 200 ? 'Gravatar exists' : 'no Gravatar'}, ${breaches.length} known breaches`,
      data: { email, mailServers: mx?.sort((a, b) => a.priority - b.priority), gravatar: gravatar?.status === 200, breaches, breachSource: xon ? `XposedOrNot (HTTP ${xon.status})` : 'XposedOrNot did not answer' },
      entities: uniq(entities),
      edges,
    };
  },
};

interface SiteCheck {
  site: string;
  url: string;
  check: (u: string) => Promise<'found' | 'missing' | 'unknown'>;
  profile: (u: string) => string;
}
const status = async (url: string, found: number[] = [200], missing: number[] = [404]): Promise<'found' | 'missing' | 'unknown'> => {
  const r = await http(url, { timeout: 12_000, max: 20_000, headers: { accept: 'application/json, text/html' } });
  return found.includes(r.status) ? 'found' : missing.includes(r.status) ? 'missing' : 'unknown';
};
const SITES: SiteCheck[] = [
  { site: 'GitHub', url: 'https://github.com/{u}', profile: (u) => `https://github.com/${u}`, check: (u) => status(`https://api.github.com/users/${u}`) },
  { site: 'GitLab', url: 'https://gitlab.com/{u}', profile: (u) => `https://gitlab.com/${u}`, check: async (u) => { const r = await json<unknown[]>(`https://gitlab.com/api/v4/users?username=${u}`, { timeout: 12_000 }); return r.status === 200 && Array.isArray(r.body) ? (r.body.length ? 'found' : 'missing') : 'unknown'; } },
  { site: 'Codeberg', url: 'https://codeberg.org/{u}', profile: (u) => `https://codeberg.org/${u}`, check: (u) => status(`https://codeberg.org/api/v1/users/${u}`) },
  { site: 'Reddit', url: 'https://www.reddit.com/user/{u}', profile: (u) => `https://www.reddit.com/user/${u}`, check: (u) => status(`https://www.reddit.com/user/${u}/about.json`) },
  { site: 'Hacker News', url: 'https://news.ycombinator.com/user?id={u}', profile: (u) => `https://news.ycombinator.com/user?id=${u}`, check: async (u) => { const r = await http(`https://hacker-news.firebaseio.com/v0/user/${u}.json`, { timeout: 12_000, max: 20_000 }); return r.status === 200 ? (r.text.trim() === 'null' ? 'missing' : 'found') : 'unknown'; } },
  { site: 'Keybase', url: 'https://keybase.io/{u}', profile: (u) => `https://keybase.io/${u}`, check: async (u) => { const r = await json<{ them?: Array<unknown | null> }>(`https://keybase.io/_/api/1.0/user/lookup.json?usernames=${u}&fields=basics`, { timeout: 12_000 }); return r.body?.them ? (r.body.them[0] ? 'found' : 'missing') : 'unknown'; } },
  { site: 'Docker Hub', url: 'https://hub.docker.com/u/{u}', profile: (u) => `https://hub.docker.com/u/${u}`, check: (u) => status(`https://hub.docker.com/v2/users/${u}/`) },
  { site: 'npm', url: 'https://www.npmjs.com/~{u}', profile: (u) => `https://www.npmjs.com/~${u}`, check: async (u) => { const r = await json<{ total?: number }>(`https://registry.npmjs.org/-/v1/search?text=maintainer:${u}&size=1`, { timeout: 12_000 }); return r.body && typeof r.body.total === 'number' ? (r.body.total > 0 ? 'found' : 'missing') : 'unknown'; } },
  { site: 'PyPI', url: 'https://pypi.org/user/{u}/', profile: (u) => `https://pypi.org/user/${u}/`, check: (u) => status(`https://pypi.org/user/${u}/`) },
  { site: 'DEV Community', url: 'https://dev.to/{u}', profile: (u) => `https://dev.to/${u}`, check: (u) => status(`https://dev.to/api/users/by_username?url=${u}`) },
];

const usernameCheck: Runner = {
  id: 'username-check',
  name: 'Username across developer sites',
  group: 'Identity',
  blurb: 'Checks the name on sites that publish a public lookup API (GitHub, GitLab, Codeberg, Reddit, Hacker News, Keybase, Docker Hub, npm, PyPI, DEV). A match means the name is taken, not that it is the same person.',
  mode: 'passive',
  input: { kind: 'username', label: 'Username', placeholder: 'octocat' },
  sendsTo: 'each site listed in the result',
  async run(input) {
    const u = cleanUsername(input);
    const results = await Promise.all(SITES.map(async (s) => ({ site: s.site, profile: s.profile(u), result: await s.check(u).catch(() => 'unknown' as const) })));
    const found = results.filter((r) => r.result === 'found');
    const un = ent('username', u);
    const entities: Entity[] = [un, ...found.map((f) => ent('account', f.profile))];
    return { summary: `${found.length} of ${results.length} sites have this name`, data: { results }, entities, edges: found.map((f) => edge(un, ent('account', f.profile), 'name taken on')) };
  },
};

interface GhUser {
  login: string;
  name?: string;
  company?: string;
  blog?: string;
  location?: string;
  email?: string;
  bio?: string;
  created_at: string;
  public_repos: number;
  followers: number;
  twitter_username?: string;
}
interface GhEvent {
  type: string;
  repo: { name: string };
  payload?: { commits?: Array<{ author?: { name?: string; email?: string } }> };
}
const githubRecon: Runner = {
  id: 'github-recon',
  name: 'GitHub account recon',
  group: 'Identity',
  blurb: 'Public profile, repositories and the author emails and names that appear in recent public push events (GitHub no-reply addresses are marked).',
  mode: 'passive',
  input: { kind: 'username', label: 'GitHub username', placeholder: 'octocat' },
  sendsTo: 'api.github.com',
  async run(input) {
    const u = cleanUsername(input);
    const [prof, repos, events] = await Promise.all([
      json<GhUser>(`https://api.github.com/users/${u}`),
      json<Array<{ name: string; language: string | null; fork: boolean; pushed_at: string; html_url: string }>>(`https://api.github.com/users/${u}/repos?per_page=100&sort=pushed`),
      json<GhEvent[]>(`https://api.github.com/users/${u}/events/public?per_page=100`),
    ]);
    if (prof.status === 404) throw new Error('No GitHub account with that name');
    if (prof.status === 403) throw new Error('GitHub rate limit reached for unauthenticated requests. Try again later.');
    if (!prof.body) throw new Error(`GitHub did not return data (HTTP ${prof.status})`);
    const authors = new Map<string, Set<string>>();
    for (const ev of Array.isArray(events.body) ? events.body : [])
      for (const c of ev.payload?.commits ?? []) {
        const em = c.author?.email?.toLowerCase();
        if (em) (authors.get(em) ?? authors.set(em, new Set()).get(em)!).add(c.author?.name ?? '');
      }
    const emails = [...authors.entries()].map(([email, names]) => ({ email, names: [...names], noreply: /users\.noreply\.github\.com$/.test(email) }));
    const un = ent('username', u);
    const entities: Entity[] = [un, ent('account', `https://github.com/${u}`)];
    const edges: Edge[] = [edge(un, ent('account', `https://github.com/${u}`), 'account')];
    for (const e of emails.filter((x) => !x.noreply)) {
      entities.push(ent('email', e.email));
      edges.push(edge(un, ent('email', e.email), 'commit author email'));
    }
    if (prof.body.blog) {
      try {
        const host = new URL(/^https?:/.test(prof.body.blog) ? prof.body.blog : `https://${prof.body.blog}`).hostname;
        entities.push(ent('domain', host));
        edges.push(edge(un, ent('domain', host), 'profile website'));
      } catch {
        /* not a URL */
      }
    }
    return {
      summary: `${prof.body.public_repos} repos, ${emails.length} commit author addresses in recent events`,
      data: { profile: prof.body, repositories: (repos.body ?? []).slice(0, 30), commitAuthors: emails, note: 'Only the last 90 days of public events are available from GitHub.' },
      entities: uniq(entities),
      edges,
    };
  },
};

// ---------------------------------------------------------------------------------------------- Files

const MAGIC: Array<[string, number[], string]> = [
  ['PNG image', [0x89, 0x50, 0x4e, 0x47], 'image/png'],
  ['JPEG image', [0xff, 0xd8, 0xff], 'image/jpeg'],
  ['GIF image', [0x47, 0x49, 0x46, 0x38], 'image/gif'],
  ['PDF document', [0x25, 0x50, 0x44, 0x46], 'application/pdf'],
  ['ZIP container (also docx, xlsx, pptx, jar, apk)', [0x50, 0x4b, 0x03, 0x04], 'application/zip'],
  ['Windows executable (PE)', [0x4d, 0x5a], 'application/vnd.microsoft.portable-executable'],
  ['ELF executable', [0x7f, 0x45, 0x4c, 0x46], 'application/x-elf'],
  ['gzip archive', [0x1f, 0x8b], 'application/gzip'],
  ['7-Zip archive', [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c], 'application/x-7z-compressed'],
  ['RAR archive', [0x52, 0x61, 0x72, 0x21], 'application/vnd.rar'],
  ['SQLite database', [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65], 'application/vnd.sqlite3'],
  ['OLE2 document (legacy Office)', [0xd0, 0xcf, 0x11, 0xe0], 'application/x-ole-storage'],
];
function sniff(buf: Buffer): { type: string; mime: string } {
  for (const [type, sig, mime] of MAGIC) if (sig.every((b, i) => buf[i] === b)) return { type, mime };
  if (buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return { type: 'WebP image', mime: 'image/webp' };
  const head = buf.subarray(0, 512).toString('utf8');
  if (/^#!/.test(head)) return { type: 'Script (shebang)', mime: 'text/x-script' };
  return { type: buf.subarray(0, 2048).every((b) => b === 9 || b === 10 || b === 13 || (b >= 32 && b < 127) || b >= 128) ? 'Text' : 'Unknown binary', mime: 'application/octet-stream' };
}

function exif(buf: Buffer): Record<string, unknown> | null {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let p = 2;
  while (p + 4 < buf.length) {
    if (buf[p] !== 0xff) break;
    const marker = buf[p + 1];
    const len = buf.readUInt16BE(p + 2);
    if (marker === 0xe1 && buf.subarray(p + 4, p + 10).toString('latin1') === 'Exif\0\0') return parseTiff(buf.subarray(p + 10, p + 2 + len));
    if (marker === 0xda) break;
    p += 2 + len;
  }
  return null;
}
function parseTiff(t: Buffer): Record<string, unknown> | null {
  const le = t.toString('latin1', 0, 2) === 'II';
  const u16 = (o: number) => (le ? t.readUInt16LE(o) : t.readUInt16BE(o));
  const u32 = (o: number) => (le ? t.readUInt32LE(o) : t.readUInt32BE(o));
  const size = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8];
  const read = (e: number, type: number, count: number, off: number): unknown => {
    const bytes = (size[type] ?? 1) * count;
    const at = bytes <= 4 ? e + 8 : u32(e + 8);
    void off;
    if (at + bytes > t.length) return undefined;
    if (type === 2) return t.toString('latin1', at, at + count).replace(/\0.*$/, '').trim();
    if (type === 3) return count === 1 ? u16(at) : Array.from({ length: count }, (_, i) => u16(at + i * 2));
    if (type === 4) return count === 1 ? u32(at) : Array.from({ length: count }, (_, i) => u32(at + i * 4));
    if (type === 5) return Array.from({ length: count }, (_, i) => u32(at + i * 8) / (u32(at + i * 8 + 4) || 1));
    return undefined;
  };
  const ifd = (start: number): Map<number, unknown> => {
    const m = new Map<number, unknown>();
    if (start + 2 > t.length) return m;
    const n = u16(start);
    for (let i = 0; i < n; i++) {
      const e = start + 2 + i * 12;
      if (e + 12 > t.length) break;
      m.set(u16(e), read(e, u16(e + 2), u32(e + 4), start));
    }
    return m;
  };
  try {
    const i0 = ifd(u32(4));
    const exifPtr = i0.get(0x8769);
    const gpsPtr = i0.get(0x8825);
    const ex = typeof exifPtr === 'number' ? ifd(exifPtr) : new Map();
    const gps = typeof gpsPtr === 'number' ? ifd(gpsPtr) : new Map();
    const dms = (v: unknown, ref: unknown) => {
      if (!Array.isArray(v) || v.length < 3) return undefined;
      const d = (v[0] as number) + (v[1] as number) / 60 + (v[2] as number) / 3600;
      return ref === 'S' || ref === 'W' ? -d : d;
    };
    const lat = dms(gps.get(2), gps.get(1));
    const lon = dms(gps.get(4), gps.get(3));
    return {
      make: i0.get(0x010f),
      model: i0.get(0x0110),
      software: i0.get(0x0131),
      artist: i0.get(0x013b),
      copyright: i0.get(0x8298),
      dateTime: i0.get(0x0132),
      dateTimeOriginal: ex.get(0x9003),
      lens: ex.get(0xa434),
      bodySerial: ex.get(0xa431),
      gps: lat !== undefined && lon !== undefined ? { latitude: Number(lat.toFixed(6)), longitude: Number(lon.toFixed(6)), map: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}` } : undefined,
    };
  } catch {
    return null;
  }
}

function zipEntries(buf: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--)
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  if (eocd < 0) return out;
  let p = buf.readUInt32LE(eocd + 16);
  const total = buf.readUInt16LE(eocd + 10);
  for (let n = 0; n < total && p + 46 <= buf.length && buf.readUInt32LE(p) === 0x02014b50; n++) {
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28);
    const elen = buf.readUInt16LE(p + 30);
    const clen = buf.readUInt16LE(p + 32);
    const lho = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    p += 46 + nlen + elen + clen;
    if (!/^docProps\/(core|app)\.xml$/.test(name) || csize > 1_000_000) continue;
    const dataAt = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
    const raw = buf.subarray(dataAt, dataAt + csize);
    try {
      out.set(name, method === 8 ? zlib.inflateRawSync(raw) : raw);
    } catch {
      /* corrupt entry */
    }
  }
  return out;
}
const xmlTag = (xml: string, tag: string) => new RegExp(`<(?:\\w+:)?${tag}[^>]*>([^<]*)</(?:\\w+:)?${tag}>`, 'i').exec(xml)?.[1]?.trim() || undefined;

const fileForensics: Runner = {
  id: 'file-forensics',
  name: 'File metadata and hashes',
  group: 'Files',
  blurb: 'MD5, SHA-1 and SHA-256, true file type from the header, JPEG EXIF (camera, dates, GPS), PDF Info fields and Office author and dates. The file is read in memory and is not stored.',
  mode: 'passive',
  input: { kind: 'file', label: 'File', placeholder: 'Choose a file (up to 25 MB)' },
  sendsTo: 'nobody; it stays on this machine',
  async run(_input, ctx) {
    const buf = ctx.file;
    if (!buf?.length) throw new Error('Choose a file first');
    const h = (a: string) => crypto.createHash(a).update(buf).digest('hex');
    const kind = sniff(buf);
    const sha256 = h('sha256');
    const data: Record<string, unknown> = { name: ctx.fileName, bytes: buf.length, type: kind.type, mime: kind.mime, md5: h('md5'), sha1: h('sha1'), sha256, entropy: Number(entropy(buf).toFixed(3)) };
    const entities: Entity[] = [ent('hash', sha256), ent('file', ctx.fileName ?? 'file')];
    const edges: Edge[] = [edge(ent('file', ctx.fileName ?? 'file'), ent('hash', sha256), 'sha256')];
    const ex = exif(buf);
    if (ex) data.exif = ex;
    if (kind.mime === 'application/pdf') {
      const text = buf.subarray(0, 200_000).toString('latin1') + buf.subarray(Math.max(0, buf.length - 200_000)).toString('latin1');
      const f = (k: string) => new RegExp(`/${k}\\s*\\(([^)]{0,200})\\)`).exec(text)?.[1];
      data.pdf = { title: f('Title'), author: f('Author'), creator: f('Creator'), producer: f('Producer'), created: f('CreationDate'), modified: f('ModDate'), note: 'Read from the Info dictionary. Compressed XMP metadata is not parsed.' };
    }
    if (kind.mime === 'application/zip') {
      const z = zipEntries(buf);
      const core = z.get('docProps/core.xml')?.toString('utf8');
      const app = z.get('docProps/app.xml')?.toString('utf8');
      if (core || app)
        data.office = { creator: core && xmlTag(core, 'creator'), lastModifiedBy: core && xmlTag(core, 'lastModifiedBy'), created: core && xmlTag(core, 'created'), modified: core && xmlTag(core, 'modified'), title: core && xmlTag(core, 'title'), application: app && xmlTag(app, 'Application'), company: app && xmlTag(app, 'Company') };
    }
    const lat = (ex as { gps?: { latitude: number } } | null)?.gps;
    return { summary: `${kind.type}, ${buf.length} bytes, sha256 ${sha256.slice(0, 12)}…${lat ? ', contains GPS location' : ''}`, data, entities, edges };
  },
};
function entropy(b: Buffer): number {
  const c = new Array<number>(256).fill(0);
  for (const x of b) c[x]++;
  return -c.reduce((s, n) => (n ? s + (n / b.length) * Math.log2(n / b.length) : s), 0);
}

// ---------------------------------------------------------------------------------------------- Web (active)

const SEC_HEADERS: Array<[string, string]> = [
  ['strict-transport-security', 'Forces HTTPS on later visits.'],
  ['content-security-policy', 'Limits where scripts and other content may load from.'],
  ['x-frame-options', 'Stops the page being framed (clickjacking). frame-ancestors in CSP also covers this.'],
  ['x-content-type-options', 'Stops MIME sniffing.'],
  ['referrer-policy', 'Controls what the Referer header leaks.'],
  ['permissions-policy', 'Limits browser features such as camera and geolocation.'],
  ['cross-origin-opener-policy', 'Isolates the window from cross-origin openers.'],
];
const webAudit: Runner = {
  id: 'web-headers',
  name: 'Security headers and exposed files',
  group: 'Web',
  blurb: 'One GET to the site for headers and cookies, plus requests for robots.txt, security.txt and sitemap.xml. It touches the target, so use it only on systems you are allowed to test.',
  mode: 'active',
  input: { kind: 'url', label: 'URL', placeholder: 'https://example.com' },
  sendsTo: 'the target itself',
  async run(input) {
    const u = cleanUrl(input);
    const main = await http(u.href, { timeout: 15_000, max: 200_000 });
    const h = main.headers;
    const present = SEC_HEADERS.map(([name, why]) => ({ header: name, value: h.get(name) ?? null, why }));
    const cookies = (h.getSetCookie?.() ?? []).map((c) => ({ name: c.split('=')[0], secure: /;\s*secure/i.test(c), httpOnly: /;\s*httponly/i.test(c), sameSite: /samesite=(\w+)/i.exec(c)?.[1] ?? null }));
    const probe = async (p: string) => {
      const r = await settle(http(new URL(p, u.origin).href, { timeout: 10_000, max: 4000 }));
      return { path: p, status: r?.status ?? null, preview: r && r.status === 200 ? r.text.slice(0, 600) : undefined };
    };
    const files = await Promise.all(['/robots.txt', '/.well-known/security.txt', '/sitemap.xml'].map(probe));
    const missing = present.filter((x) => !x.value).length;
    return {
      summary: `HTTP ${main.status}, ${missing} of ${present.length} security headers missing`,
      data: { finalUrl: main.url, status: main.status, server: h.get('server'), poweredBy: h.get('x-powered-by'), headers: present, cookies, files },
      entities: [ent('url', u.href), ent('domain', u.hostname)],
      edges: [edge(ent('url', u.href), ent('domain', u.hostname), 'on')],
    };
  },
};

// ---------------------------------------------------------------------------------------------- Keyed sources

const shodanHost: Runner = {
  id: 'shodan-host',
  name: 'Shodan host lookup',
  group: 'Keyed sources',
  blurb: 'Banners, services and vulnerabilities Shodan has stored for an IP. Needs your Shodan API key in the vault under the name “shodan”.',
  mode: 'passive',
  needsKey: 'shodan',
  input: { kind: 'ip', label: 'IP address', placeholder: '8.8.8.8' },
  sendsTo: 'api.shodan.io',
  async run(input, ctx) {
    const ip = cleanIp(input);
    const r = await json<{ ports?: number[]; org?: string; isp?: string; os?: string; hostnames?: string[]; vulns?: string[]; data?: Array<{ port: number; transport: string; product?: string; version?: string }>; error?: string }>(`https://api.shodan.io/shodan/host/${ip}?key=${encodeURIComponent(ctx.key ?? '')}`, { timeout: 25_000 });
    if (r.status === 401) throw new Error('Shodan rejected the key');
    if (r.status === 404) throw new Error('Shodan has no record for that address');
    if (!r.body || r.body.error) throw new Error(r.body?.error ?? `Shodan did not return data (HTTP ${r.status})`);
    const ipE = ent('ip', ip);
    const entities: Entity[] = [ipE, ...(r.body.ports ?? []).map((p) => ent('service', `${ip}:${p}`))];
    return { summary: `${r.body.ports?.length ?? 0} ports, ${r.body.vulns?.length ?? 0} CVEs, ${r.body.org ?? 'organisation unknown'}`, data: r.body, entities, edges: entities.slice(1).map((e) => edge(ipE, e, 'open port')) };
  },
};

const virusTotal: Runner = {
  id: 'virustotal',
  name: 'VirusTotal reputation',
  group: 'Keyed sources',
  blurb: 'Detection counts for a domain, IP address or file hash. Needs your VirusTotal key in the vault under the name “virustotal”. Only the indicator is sent, never a file.',
  mode: 'passive',
  needsKey: 'virustotal',
  input: { kind: 'text', label: 'Domain, IP or hash', placeholder: 'example.com, 8.8.8.8 or a SHA-256' },
  sendsTo: 'www.virustotal.com',
  async run(input, ctx) {
    const v = input.trim();
    const kind = net.isIP(v) ? 'ip_addresses' : /^[a-f0-9]{32}$|^[a-f0-9]{40}$|^[a-f0-9]{64}$/i.test(v) ? 'files' : 'domains';
    const target = kind === 'domains' ? cleanDomain(v) : v.toLowerCase();
    const r = await json<{ data?: { attributes?: { last_analysis_stats?: Record<string, number>; reputation?: number; last_analysis_date?: number; categories?: Record<string, string> } }; error?: { message: string } }>(`https://www.virustotal.com/api/v3/${kind}/${encodeURIComponent(target)}`, { headers: { 'x-apikey': ctx.key ?? '' }, timeout: 25_000 });
    if (r.status === 401 || r.status === 403) throw new Error('VirusTotal rejected the key');
    if (r.status === 404) throw new Error('VirusTotal has no record for that indicator');
    if (r.status === 429) throw new Error('VirusTotal rate limit reached (free keys allow 4 requests a minute)');
    const a = r.body?.data?.attributes;
    if (!a) throw new Error(r.body?.error?.message ?? `VirusTotal did not return data (HTTP ${r.status})`);
    const s = a.last_analysis_stats ?? {};
    const type: EntityType = kind === 'ip_addresses' ? 'ip' : kind === 'files' ? 'hash' : 'domain';
    return { summary: `${s.malicious ?? 0} malicious, ${s.suspicious ?? 0} suspicious of ${Object.values(s).reduce((x, y) => x + y, 0)} engines`, data: { indicator: target, stats: s, reputation: a.reputation, categories: a.categories, lastAnalysis: a.last_analysis_date ? new Date(a.last_analysis_date * 1000).toISOString() : null }, entities: [ent(type, target)], edges: [] };
  },
};

const hibp: Runner = {
  id: 'hibp',
  name: 'Have I Been Pwned',
  group: 'Keyed sources',
  blurb: 'Breaches an email address appears in, from the HIBP API. Needs a paid HIBP key in the vault under the name “hibp”.',
  mode: 'passive',
  needsKey: 'hibp',
  input: { kind: 'email', label: 'Email address', placeholder: 'name@example.com' },
  sendsTo: 'haveibeenpwned.com',
  async run(input, ctx) {
    const email = cleanEmail(input);
    const r = await json<Array<{ Name: string; BreachDate: string; DataClasses: string[]; IsVerified: boolean }>>(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`, { headers: { 'hibp-api-key': ctx.key ?? '' }, timeout: 20_000 });
    if (r.status === 401) throw new Error('HIBP rejected the key');
    if (r.status === 429) throw new Error('HIBP rate limit reached, try again shortly');
    const list = r.status === 404 ? [] : r.body;
    if (!list) throw new Error(`HIBP did not return data (HTTP ${r.status})`);
    return { summary: `${list.length} breaches`, data: { email, breaches: list.map((b) => ({ name: b.Name, date: b.BreachDate, verified: b.IsVerified, data: b.DataClasses })) }, entities: [ent('email', email)], edges: [] };
  },
};

export const RUNNERS: Runner[] = [dnsRecords, emailAuth, rdapDomain, ctSubdomains, wayback, ipIntel, emailProfile, usernameCheck, githubRecon, fileForensics, webAudit, shodanHost, virusTotal, hibp];
export const findRunner = (id: string) => RUNNERS.find((r) => r.id === id);
