import { useCallback, useEffect, useState } from 'react';

/** Minimal hash router: `#/agents/claude/<sessionId>` -> ['agents', 'claude', '<sessionId>'] */
function parse(hash: string): string[] {
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
}

export function useHashRoute() {
  const [segments, setSegments] = useState<string[]>(() => parse(window.location.hash));

  useEffect(() => {
    const onChange = () => setSegments(parse(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((...parts: string[]) => {
    window.location.hash = '/' + parts.map(encodeURIComponent).join('/');
  }, []);

  return { segments, navigate };
}
