import { api } from './api';
import { openWindow } from './windows';

/**
 * Turns "open youtube.com", "play lofi on youtube" or "open spotify" into an action. Links, videos and pages open in a
 * floating window. Anything that names an installed app asks the server to start that app on this PC.
 */
export interface OpenResult {
  ok: boolean;
  message: string;
}

const SITES: Record<string, { url: string; title: string }> = {
  youtube: { url: 'https://www.youtube.com/', title: 'YouTube' },
  github: { url: 'https://github.com/', title: 'GitHub' },
  wikipedia: { url: 'https://en.wikipedia.org/', title: 'Wikipedia' },
  'hacker news': { url: 'https://news.ycombinator.com/', title: 'Hacker News' },
  'hackernews': { url: 'https://news.ycombinator.com/', title: 'Hacker News' },
  'mdn': { url: 'https://developer.mozilla.org/', title: 'MDN' },
  'stack overflow': { url: 'https://stackoverflow.com/', title: 'Stack Overflow' },
};

const LEAD = /^(?:please\s+|hey\s+jarvis[, ]*|jarvis[, ]*)?(?:can you\s+)?(?:open up|open|launch|start|run|bring up|pull up|go to|show me|show|play)\s+/i;

/** Rewrites a page address into one that is allowed to sit inside a frame, when the site publishes such an address. */
export function embedFor(raw: string): { src: string; title?: string } {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { src: raw };
  }
  const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '');
  if (host === 'youtu.be') return { src: `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}?autoplay=1&rel=0`, title: 'YouTube' };
  if (host === 'youtube.com') {
    const v = u.searchParams.get('v');
    const list = u.searchParams.get('list');
    if (u.pathname === '/watch' && v) return { src: `https://www.youtube-nocookie.com/embed/${v}?autoplay=1&rel=0${list ? `&list=${list}` : ''}`, title: 'YouTube' };
    if (u.pathname.startsWith('/shorts/')) return { src: `https://www.youtube-nocookie.com/embed/${u.pathname.split('/')[2]}?autoplay=1&rel=0`, title: 'YouTube' };
    if (u.pathname === '/playlist' && list) return { src: `https://www.youtube-nocookie.com/embed/videoseries?list=${list}&autoplay=1`, title: 'YouTube playlist' };
  }
  if (host === 'vimeo.com' && /^\/\d+/.test(u.pathname)) return { src: `https://player.vimeo.com/video/${u.pathname.split('/')[1]}?autoplay=1`, title: 'Vimeo' };
  if (host === 'open.spotify.com' && !u.pathname.startsWith('/embed')) return { src: `https://open.spotify.com/embed${u.pathname}`, title: 'Spotify' };
  if (host === 'twitch.tv' && /^\/[\w]+$/.test(u.pathname)) return { src: `https://player.twitch.tv/?channel=${u.pathname.slice(1)}&parent=${window.location.hostname}`, title: 'Twitch' };
  return { src: u.toString() };
}

/** "example.com", "www.foo.org/path" or a full address. Returns a full https address, or null when it is not a link. */
function asUrl(text: string): string | null {
  const t = text.trim().replace(/[.,!?]+$/, '');
  if (/^https?:\/\//i.test(t)) return t;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/\S*)?$/i.test(t) && !/\s/.test(t)) return `https://${t}`;
  return null;
}

function openLink(url: string, title?: string): OpenResult {
  const { src, title: t } = embedFor(url);
  let name = title ?? t;
  if (!name) {
    try {
      name = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      name = 'Window';
    }
  }
  openWindow({ title: name, src, original: url });
  return { ok: true, message: `Opened ${name} in a window` };
}

async function openYouTube(query: string): Promise<OpenResult> {
  try {
    const hit = await api<{ id: string; title: string }>(`/api/launcher/youtube?q=${encodeURIComponent(query)}`);
    openWindow({ title: hit.title, src: `https://www.youtube-nocookie.com/embed/${hit.id}?autoplay=1&rel=0`, original: `https://www.youtube.com/watch?v=${hit.id}` });
    return { ok: true, message: `Playing "${hit.title}"` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not find a video' };
  }
}

export async function openFromText(text: string): Promise<OpenResult> {
  const raw = text.trim();
  if (!raw) return { ok: false, message: 'Say what to open' };

  const yt = /^(?:play\s+)?(.+?)\s+(?:on|in)\s+youtube$/i.exec(raw) ?? /^(?:search\s+youtube\s+for|youtube\s+search|youtube)\s+(.+)$/i.exec(raw);
  if (yt) return openYouTube(yt[1]);

  const target = raw.replace(LEAD, '').replace(/^(?:the\s+)?(?:app\s+|website\s+|site\s+)?/i, '').trim();
  if (!target) return { ok: false, message: 'Say what to open' };

  const link = asUrl(target);
  if (link) return openLink(link);

  // "play X" with no site named: look it up on YouTube.
  if (/^play\s+/i.test(raw)) return openYouTube(raw.replace(/^play\s+/i, ''));

  // An installed app wins, so "open spotify" starts Spotify when it is on this PC.
  try {
    const hit = await api<{ app: { name: string } }>('/api/launcher/open-app', { method: 'POST', body: { name: target } });
    return { ok: true, message: `Opening ${hit.app.name}` };
  } catch (e) {
    const site = SITES[target.toLowerCase()];
    if (site) return openLink(site.url, site.title);
    return { ok: false, message: e instanceof Error ? e.message : 'Could not open that' };
  }
}

/** Opens an address in the PC's default browser, for sites that refuse to be shown inside a window. */
export const openInBrowser = (url: string) => api('/api/launcher/open-url', { method: 'POST', body: { url } });
