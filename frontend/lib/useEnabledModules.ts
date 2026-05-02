'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from './api';

/**
 * Lightweight module-enablement hook for any page that needs to gate UI
 * behind a feature module (reviews, triage, insights, …). The dashboard
 * layout already does its own fetch for the sidebar; this hook is for
 * everywhere else.
 *
 * Returns a Set of enabled slugs, or `null` while still loading. We
 * fall back to `core` if the fetch fails so users don't get locked out
 * of basic surfaces.
 */
export function useEnabledModules(): Set<string> | null {
  const [mods, setMods] = useState<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<Array<{ slug: string; enabled: boolean }>>('/modules')
      .then((rows) => {
        if (cancelled) return;
        setMods(new Set(rows.filter((m) => m.enabled).map((m) => m.slug)));
      })
      .catch(() => {
        if (cancelled) return;
        setMods(new Set(['core']));
      });

    function onChange() {
      apiFetch<Array<{ slug: string; enabled: boolean }>>('/modules')
        .then((rows) => {
          if (cancelled) return;
          setMods(new Set(rows.filter((m) => m.enabled).map((m) => m.slug)));
        })
        .catch(() => {});
    }
    window.addEventListener('agena:modules-changed', onChange);
    return () => {
      cancelled = true;
      window.removeEventListener('agena:modules-changed', onChange);
    };
  }, []);

  return mods;
}
