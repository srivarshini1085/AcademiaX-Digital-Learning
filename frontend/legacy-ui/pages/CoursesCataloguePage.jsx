import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { courseApi } from '../lib/api';
import IndexCard from '../components/IndexCard';
import SkeletonLoader from '../components/SkeletonLoader';
import Navbar from '../components/Navbar';

const DEPARTMENTS = ['All', 'Computer Science', 'Mathematics', 'Physics', 'Electrical Engineering', 'Mechanical Engineering'];
const LEVELS = ['All', 'Undergraduate', 'Graduate'];

export default function CoursesCataloguePage() {
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('');
  const [level, setLevel] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const params = { keyword: search || undefined, department: dept || undefined, level: level || undefined, availableOnly: availableOnly || undefined, page, size: 12 };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['courses', params],
    queryFn: () => courseApi.list(params).then(r => r.data),
    keepPreviousData: true,
  });

  const courses = data?.content ?? data ?? [];
  const totalPages = data?.totalPages ?? 1;

  const clearFilters = () => { setSearch(''); setDept(''); setLevel(''); setAvailableOnly(false); setPage(0); };
  const hasFilters = search || dept || level || availableOnly;

  return (
    <div className="min-h-screen bg-paper">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="page-header">
          <div className="flex items-end justify-between">
            <div>
              <p className="font-mono text-xs text-accent tracking-widest uppercase mb-2">Fall 2026</p>
              <h1 className="font-display text-4xl text-ink font-light">Course Catalogue</h1>
            </div>
            {data?.totalElements !== undefined && (
              <span className="font-mono text-sm text-ink-muted">{data.totalElements} courses</span>
            )}
          </div>
        </div>

        {/* Search + filter bar */}
        <div className="flex gap-3 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              className="field-input pl-9"
              placeholder="Search courses, codes, departments…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
            />
          </div>
          <button onClick={() => setShowFilters(f => !f)} className={`btn-ghost text-sm ${showFilters ? 'border-accent text-accent' : ''}`}>
            <SlidersHorizontal size={14} /> Filters
          </button>
          {hasFilters && (
            <button onClick={clearFilters} className="btn-ghost text-sm text-ink-muted">
              <X size={14} /> Clear
            </button>
          )}
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="border border-hairline rounded-sm p-4 mb-5 bg-surface grid grid-cols-2 md:grid-cols-4 gap-4 animate-slide-up">
            <div>
              <label className="field-label">Department</label>
              <select className="field-input" value={dept} onChange={e => { setDept(e.target.value === 'All' ? '' : e.target.value); setPage(0); }}>
                {DEPARTMENTS.map(d => <option key={d} value={d === 'All' ? '' : d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Level</label>
              <select className="field-input" value={level} onChange={e => { setLevel(e.target.value === 'All' ? '' : e.target.value); setPage(0); }}>
                {LEVELS.map(l => <option key={l} value={l === 'All' ? '' : l}>{l}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 col-span-2 md:col-span-2">
              <input type="checkbox" id="availOnly" checked={availableOnly} onChange={e => { setAvailableOnly(e.target.checked); setPage(0); }} className="accent-accent" />
              <label htmlFor="availOnly" className="text-sm text-ink cursor-pointer">Show available seats only</label>
            </div>
          </div>
        )}

        {/* Results */}
        {isLoading ? (
          <SkeletonLoader rows={9} type="card" />
        ) : isError ? (
          <div className="text-center py-16 text-ink-muted">
            <p className="font-display text-2xl mb-2">Could not load courses</p>
            <p className="text-sm">Ensure the backend is running on port 8080.</p>
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-16 text-ink-muted">
            <p className="font-display text-2xl mb-2">No courses found</p>
            <p className="text-sm">Try different search terms or clear the filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map(c => <IndexCard key={c.id} course={c} />)}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="btn-ghost text-sm disabled:opacity-30">← Prev</button>
            <span className="font-mono text-xs text-ink-muted">Page {page + 1} of {totalPages}</span>
            <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="btn-ghost text-sm disabled:opacity-30">Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}

