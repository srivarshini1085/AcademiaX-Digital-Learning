import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { courseApi, enrollmentApi } from '../lib/api';
import { useDirectory } from '../lib/hooks';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatMoney } from '../lib/format';
import { EmptyState, ErrorState, PageHeader, Skeleton, Stat, StatusPill } from '../components/ui';

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="card px-3 py-2 text-xs shadow-md">
      <p className="font-mono text-accent">{d.code}</p>
      <p>{d.taken} of {d.total} seats filled · <span className="font-mono">{d.pct}%</span></p>
    </div>
  );
}

function Roster({ course }) {
  const roster = useQuery({ queryKey: ['roster', course.id], queryFn: async () => (await enrollmentApi.roster(course.id)).data });
  const people = useDirectory((roster.data || []).map(r => r.studentId), !!roster.data);
  const order = { CONFIRMED: 0, SEAT_HELD: 1, WAITLISTED: 2 };
  const rows = [...(roster.data || [])].sort((a, b) => order[a.status] - order[b.status] || (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0));

  if (roster.isLoading) return <Skeleton className="h-40" />;
  if (roster.isError) return <ErrorState error={roster.error} onRetry={roster.refetch} />;
  if (!rows.length) return <p className="py-6 text-sm text-ink-muted">No students yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="table-ledger min-w-[520px]">
        <thead><tr><th>Student</th><th>Email</th><th>Status</th><th className="text-right">Since</th></tr></thead>
        <tbody>
          {rows.map(r => {
            const p = people.data?.get(r.studentId);
            return (
              <tr key={r.id}>
                <td>{p?.name || `Student #${r.studentId}`}</td>
                <td className="font-mono text-xs text-ink-soft">{p?.email || '—'}</td>
                <td><StatusPill status={r.status} />{r.status === 'WAITLISTED' && <span className="ml-2 font-mono text-xs text-ink-muted">#{r.waitlistPosition}</span>}</td>
                <td className="text-right font-mono text-xs text-ink-muted">{formatDate(r.enrolledAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function InstructorDashboard() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const courses = useQuery({
    queryKey: ['courses', 'mine', user.id],
    queryFn: async () => (await courseApi.list({ size: 200, sort: 'code,asc' })).data.content.filter(c => c.instructorId === user.id),
  });

  const mine = courses.data || [];
  const selected = mine.find(c => String(c.id) === params.get('course')) || mine[0];
  const seats = mine.reduce((s, c) => s + c.totalSeats, 0);
  const taken = mine.reduce((s, c) => s + c.totalSeats - c.availableSeats, 0);
  const chart = mine.map(c => ({ code: c.code, total: c.totalSeats, taken: c.totalSeats - c.availableSeats, pct: Math.round(((c.totalSeats - c.availableSeats) / c.totalSeats) * 100) }));

  return (
    <div>
      <PageHeader eyebrow={`${user.department} · faculty`} title="My courses" actions={<Link to="/courses/new" className="btn-primary">Add a course</Link>}>
        Seat fill, rosters and waitlists for the courses you teach. You can edit only your own courses.
      </PageHeader>

      {courses.isLoading ? <Skeleton className="h-64" /> : courses.isError ? <ErrorState error={courses.error} onRetry={courses.refetch} /> : mine.length === 0 ? (
        <EmptyState title="You aren't teaching any courses yet" action={<Link to="/courses/new" className="btn-primary">Add your first course</Link>} />
      ) : (
        <>
          <section className="mb-10 grid grid-cols-2 gap-6 md:grid-cols-4">
            <Stat label="Courses" value={mine.length} />
            <Stat label="Seats filled" value={`${taken}/${seats}`} />
            <Stat label="Average fill" value={`${seats ? Math.round((taken / seats) * 100) : 0}%`} />
            <Stat label="Full courses" value={mine.filter(c => c.availableSeats === 0).length} />
          </section>

          <section className="mb-10">
            <h2 className="mb-1 text-2xl">Seat fill rate</h2>
            <p className="mb-4 text-sm text-ink-soft">Share of seats taken (held or confirmed) in each course.</p>
            <div className="card h-64 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="rgb(var(--rule))" />
                  <XAxis dataKey="code" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono', fill: 'rgb(var(--ink-muted))' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: 'rgb(var(--ink-muted))' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgb(var(--sunken))' }} />
                  <Bar dataKey="pct" fill="rgb(var(--accent))" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="grid gap-8 lg:grid-cols-[1fr_2fr]">
            <div>
              <h2 className="mb-3 border-b border-ink/80 pb-2 text-2xl">Courses</h2>
              <ul className="divide-y divide-rule">
                {mine.map(c => (
                  <li key={c.id}>
                    <button onClick={() => setParams({ course: String(c.id) })}
                      className={`w-full px-2 py-3 text-left transition-colors ${selected?.id === c.id ? 'bg-accent-wash/60' : 'hover:bg-sunken'}`}>
                      <span className="flex items-baseline justify-between">
                        <span className="font-mono text-sm text-accent">{c.code}</span>
                        <span className="font-mono text-xs text-ink-muted">{c.totalSeats - c.availableSeats}/{c.totalSeats}</span>
                      </span>
                      <span className="block text-sm">{c.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            {selected && (
              <div>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/80 pb-2">
                  <h2 className="text-2xl">Roster · <span className="font-mono text-xl text-accent">{selected.code}</span></h2>
                  <div className="flex gap-2">
                    <Link to={`/courses/${selected.id}`} className="btn-quiet btn-sm">View</Link>
                    <Link to={`/courses/${selected.id}/edit`} className="btn-secondary btn-sm">Edit</Link>
                  </div>
                </div>
                <p className="mb-3 text-xs text-ink-muted">{formatMoney(selected.tuitionFee)} · closes {formatDate(selected.enrollmentDeadline)}</p>
                <Roster course={selected} />
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
