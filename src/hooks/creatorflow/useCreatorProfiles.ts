import React from 'react';
import {
  fetchApprovedCreators,
  fetchCreatorProfile,
  fetchFeaturedCreators,
  fetchPublicCreatorProfile,
  getCreatorAvailability,
  listCreatorChildren,
  updateCreatorProfile,
  upsertCreatorAvailability,
  upsertCreatorChild,
  deleteCreatorChild,
} from '@/lib/creatorflow/creatorProfiles';

type AsyncState<T> = { data: T | null; loading: boolean; error: Error | null; reload: () => Promise<void>; isEmpty: boolean };

function useAsync<T>(load: () => Promise<T>, deps: React.DependencyList): AsyncState<T> {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const reload = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setData(await load()); } catch (err) { setError(err as Error); } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  React.useEffect(() => { void reload(); }, [reload]);
  return { data, loading, error, reload, isEmpty: Array.isArray(data) ? data.length === 0 : !data };
}

export function useCreatorProfile() {
  const state = useAsync(fetchCreatorProfile, []);
  const { reload } = state;
  const update = React.useCallback(async (input: Parameters<typeof updateCreatorProfile>[0]) => {
    const updated = await updateCreatorProfile(input);
    await reload();
    return updated;
  }, [reload]);
  return { ...state, update };
}

export function useCreatorServices() { return useCreatorCollection('creator_services'); }
export function useCreatorPortfolio() { return useCreatorCollection('creator_portfolio'); }
export function useCreatorPlatforms() { return useCreatorCollection('creator_platforms'); }
export function useCreatorNiches() { return useCreatorCollection('creator_niches'); }

function useCreatorCollection(table: Parameters<typeof listCreatorChildren>[0]) {
  const state = useAsync(() => listCreatorChildren(table), [table]);
  const { reload } = state;
  const save = React.useCallback(async (input: Record<string, unknown>) => { const row = await upsertCreatorChild(table, input); await reload(); return row; }, [reload, table]);
  const remove = React.useCallback(async (id: string) => { await deleteCreatorChild(table, id); await reload(); }, [reload, table]);
  return { ...state, save, remove };
}

export function useCreatorAvailability() {
  const state = useAsync(getCreatorAvailability, []);
  const { reload } = state;
  const save = React.useCallback(async (input: Record<string, unknown>) => { const row = await upsertCreatorAvailability(input); await reload(); return row; }, [reload]);
  return { ...state, save };
}

export function usePublicCreatorProfile(slugOrId: string) { return useAsync(() => fetchPublicCreatorProfile(slugOrId), [slugOrId]); }
export function useFeaturedCreators(limit = 8) { return useAsync(() => fetchFeaturedCreators(limit), [limit]); }
export function useApprovedCreators() { return useAsync(fetchApprovedCreators, []); }
