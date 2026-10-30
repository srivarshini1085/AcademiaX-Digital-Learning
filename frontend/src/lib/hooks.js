import { useQuery } from '@tanstack/react-query';
import { authApi } from './api';

/** Public faculty list as a Map(id -> {name, department}); cached for the session. */
export function useInstructors() {
  return useQuery({
    queryKey: ['instructors'],
    queryFn: async () => new Map((await authApi.instructors()).data.map(i => [i.id, i])),
    staleTime: 10 * 60 * 1000,
  });
}

/** Names for user IDs (staff only). Returns a Map(id -> user). */
export function useDirectory(ids, enabled = true) {
  const unique = [...new Set(ids.filter(Boolean))].sort((a, b) => a - b);
  return useQuery({
    queryKey: ['directory', unique.join(',')],
    queryFn: async () => new Map((await authApi.directory(unique)).data.map(u => [u.id, u])),
    enabled: enabled && unique.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
