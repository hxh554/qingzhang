import { useEffect, useState } from 'react';

export function useRoute(): string {
  const [route, setRoute] = useState(() => location.hash.replace(/^#/, '') || '/');
  useEffect(() => {
    const on = () => { setRoute(location.hash.replace(/^#/, '') || '/'); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const navigate = (r: string) => { location.hash = r; };
