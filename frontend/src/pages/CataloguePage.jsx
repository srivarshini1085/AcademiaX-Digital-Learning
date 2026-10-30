import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { courseApi } from '../lib/api';
import { useInstructors } from '../lib/hooks';
import IndexCard from '../components/IndexCard';
import { EmptyState, ErrorState, PageHeader, Pagination, SkeletonCards } from '../components/ui';

const SORTS = [
  ['code,asc', 'Course code'],
  ['enrollmentDeadline,asc', 'Deadline, soonest'],
  ['tuitionFee,asc', 'Tuition, low to high'],
  ['tuitionFee,desc', 'Tuition, high to low'],
  ['availableSeats,desc', 'Most seats open'],
];

export default function CataloguePage() {
  const [params, setParams] = useSearchParams();
  const [keyword, setKeyword] = useState(params.get('q') || '');
  const filters = {
    keyword: params.get('q') || undefined,
    department: params.get('department') || undefined,
    semester: params.get('semester') || undefined,
    level: params.get('level') || undefined,
    availableOnly: params.get('open') === '1' || undefined,
    sort: params.get('sort') || 'code,asc',
    page: Number(params.get('page') || 0),
    size: 9,
  };

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  // Debounce the search box so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => { if ((params.get('q') || '') !== keyword) update({ q: keyword }); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword]);

  const instructors = useInstructors();
  const facets = useQuery({
    queryKey: ['courses', 'facets'],
    queryFn: async () => {
      const all = (await courseApi.list({ size: 200 })).data.content;
      const distinct = key => [...new Set(all.map(c => c[key]))].sort();
      return { departments: distinct('department'), semesters: distinct('semester'), levels: [...new Set(all.map(c => (c.level || '').toUpperCase()))].sort() };
    },
    staleTime: 5 * 60 * 1000,
  });
  const result = useQuery({
    queryKey: ['courses', 'catalogue', filters],
    queryFn: async () => (await courseApi.list(filters)).data,
    placeholderData: keepPreviousData,
  });

  const select = (key, label, options) => (
    <label className="block">
      <span className="field-label">{label}</span>
      <select className="field-input" value={params.get(key) || ''} onChange={e => update({ [key]: e.target.value })}>
        <option value="">All</option>
        {options?.map(o => <option key={o} value={o}>{key === 'level' ? o.charAt(0) + o.slice(1).toLowerCase() : o}</option>)}
      </select>
    </label>
  );

  return (
    <div>
      <PageHeader eyebrow="Fall term 2026" title="Course catalogue">
        Every course offered this term. Holding a seat reserves it for ten minutes while you pay.
      </PageHeader>

      <section aria-label="Filters" className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
        <label className="block sm:col-span-2 lg:col-span-1">
          <span className="field-label">Search</span>
          <span className="relative block">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input type="search" className="field-input pl-9" placeholder="Title, code or keyword" value={keyword} onChange={e => setKeyword(e.target.value)} />
          </span>
        </label>
        {select('department', 'Department', facets.data?.departments)}
        {select('semester', 'Semester', facets.data?.semesters)}
        {select('level', 'Level', facets.data?.levels)}
        <label className="block">
          <span className="field-label">Sort by</span>
          <select className="field-input" value={filters.sort} onChange={e => update({ sort: e.target.value })}>
            {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-soft sm:col-span-2 lg:col-span-5">
          <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={params.get('open') === '1'} onChange={e => update({ open: e.target.checked ? '1' : '' })} />
          Only show courses with open seats
        </label>
      </section>

      <div className="mb-4 flex items-baseline justify-between font-mono text-xs text-ink-muted">
        <span>{result.data ? `${result.data.totalElements} course${result.data.totalElements === 1 ? '' : 's'}` : ' '}</span>
        {result.isFetching && !result.isLoading && <span>Updating…</span>}
      </div>

      {result.isLoading ? <SkeletonCards /> : result.isError ? <ErrorState error={result.error} onRetry={result.refetch} /> :
        result.data.content.length === 0 ? (
          <EmptyState title="No courses match" action={<button className="btn-secondary" onClick={() => { setKeyword(''); setParams({}); }}>Clear filters</button>}>
            Try a different department or turn off “open seats only”.
          </EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.data.content.map(c => <IndexCard key={c.id} course={c} instructor={instructors.data?.get(c.instructorId)} />)}
          </div>
        )}

      <Pagination page={filters.page} totalPages={result.data?.totalPages} onChange={p => update({ page: String(p) })} />
    </div>
  );
}
