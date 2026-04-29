'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Read the `?repo=N` query param and keep local state in sync with it.
 *
 * Used by every DORA subpage so the hub's per-repo deep-link
 * (`/dashboard/dora/development?repo=5`) lands on a single-repo view
 * instead of an org-wide one. The picker on each subpage still updates
 * the same state via `setRepoId`.
 */
export function useRepoIdParam(): [string | null, (next: string | null) => void] {
  const searchParams = useSearchParams();
  const [repoId, setRepoId] = useState<string | null>(() => {
    const v = searchParams?.get('repo');
    return v ? String(v) : null;
  });
  useEffect(() => {
    const v = searchParams?.get('repo');
    if (v && v !== repoId) setRepoId(String(v));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  return [repoId, setRepoId];
}
