import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { courseApi, enrollmentApi, notificationApi, paymentApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatMoney, isPast, timeAgo } from '../lib/format';
import HoldCountdown from '../components/HoldCountdown';
import { ErrorState, PageHeader, Skeleton, Stat, StatusPill } from '../components/ui';

export default function StudentDashboard() {
  const { user } = useAuth();
  const enrollments = useQuery({ queryKey: ['enrollments', 'mine'], queryFn: async () => (await enrollmentApi.mine()).data });
  const payments = useQuery({ queryKey: ['payments', 'mine'], queryFn: async () => (await paymentApi.mine()).data });
  const notices = useQuery({ queryKey: ['notifications', 'list'], queryFn: async () => (await notificationApi.mine()).data });
  const closing = useQuery({
    queryKey: ['courses', 'closing'],
    queryFn: async () => (await courseApi.list({ availableOnly: true, sort: 'enrollmentDeadline,asc', size: 20 })).data.content,
  });

  const list = enrollments.data || [];
  const confirmed = list.filter(e => e.status === 'CONFIRMED');
  const holds = list.filter(e => e.status === 'SEAT_HELD');
  const waitlisted = list.filter(e => e.status === 'WAITLISTED');
  const credits = confirmed.reduce((sum, e) => sum + (e.credits || 0), 0);
  const paid = (payments.data || []).filter(p => p.status === 'SUCCESS').reduce((sum, p) => sum + Number(p.amount), 0);
  const enrolledIds = new Set(list.map(e => e.courseId));
  const deadlines = (closing.data || []).filter(c => !isPast(c.enrollmentDeadline) && !enrolledIds.has(c.id)).slice(0, 5);

  return (
    <div>
      <PageHeader eyebrow={`${user.department} · student`} title={`Good day, ${user.name.split(' ')[0]}.`}
        actions={<Link to="/courses" className="btn-primary">Browse courses</Link>} />

      {enrollments.isError && <ErrorState error={enrollments.error} onRetry={enrollments.refetch} />}

      <section className="mb-10 grid grid-cols-2 gap-6 md:grid-cols-4">
        {enrollments.isLoading ? [0, 1, 2, 3].map(i => <Skeleton key={i} className="h-16" />) : <>
          <Stat label="Enrolled courses" value={confirmed.length} />
          <Stat label="Credits this term" value={credits} />
          <Stat label="Tuition paid" value={formatMoney(paid)} />
          <Stat label="Waitlists" value={waitlisted.length} note={waitlisted.length ? `#${waitlisted.map(w => w.waitlistPosition).join(', #')}` : undefined} />
        </>}
      </section>

      {holds.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-2xl">Awaiting payment</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {holds.map(h => (
              <div key={h.id} className="card border-accent/40 p-5">
                <div className="flex items-baseline justify-between"><span className="font-mono text-accent">{h.courseCode}</span><span className="font-mono text-sm">{formatMoney(h.tuitionFee)}</span></div>
                <p className="mb-4 mt-1 font-display text-lg">{h.courseTitle}</p>
                <HoldCountdown expiresAt={h.holdExpiresAt} onExpire={() => enrollments.refetch()} compact />
                <Link to={`/checkout/${h.id}`} className="btn-primary btn-sm mt-4">Pay now</Link>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <div className="mb-3 flex items-baseline justify-between border-b border-ink/80 pb-2">
            <h2 className="text-2xl">Your timetable</h2>
            <Link to="/enrollments" className="text-sm text-accent hover:underline">All enrollments →</Link>
          </div>
          {confirmed.length === 0 && !enrollments.isLoading ? <p className="py-6 text-sm text-ink-muted">No confirmed courses yet.</p> : (
            <table className="table-ledger">
              <thead><tr><th>Code</th><th>Course</th><th className="text-right">Credits</th><th className="hidden sm:table-cell">Status</th></tr></thead>
              <tbody>
                {confirmed.map(e => (
                  <tr key={e.id}>
                    <td className="font-mono text-accent"><Link to={`/courses/${e.courseId}`}>{e.courseCode}</Link></td>
                    <td>{e.courseTitle}</td>
                    <td className="text-right font-mono">{e.credits}</td>
                    <td className="hidden sm:table-cell"><StatusPill status={e.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h2 className="mb-3 mt-10 border-b border-ink/80 pb-2 text-2xl">Deadlines approaching</h2>
          <ul className="divide-y divide-rule">
            {deadlines.map(c => (
              <li key={c.id} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                <Link to={`/courses/${c.id}`} className="hover:text-accent"><span className="font-mono text-accent">{c.code}</span> {c.title}</Link>
                <span className="shrink-0 font-mono text-xs text-ink-muted">{formatDate(c.enrollmentDeadline)}</span>
              </li>
            ))}
          </ul>
        </section>

        <aside>
          <div className="mb-3 flex items-baseline justify-between border-b border-ink/80 pb-2">
            <h2 className="text-2xl">Notices</h2>
            <Link to="/notifications" className="text-sm text-accent hover:underline">All →</Link>
          </div>
          <ul className="space-y-4">
            {(notices.data || []).slice(0, 5).map(n => (
              <li key={n.id} className={`border-l-2 pl-3 ${n.readStatus ? 'border-rule' : 'border-accent'}`}>
                <p className="text-sm font-medium">{n.title}</p>
                <p className="text-xs text-ink-soft">{n.message}</p>
                <p className="mt-0.5 font-mono text-[10px] text-ink-muted">{timeAgo(n.createdAt)}</p>
              </li>
            ))}
            {notices.data?.length === 0 && <li className="text-sm text-ink-muted">No notices yet.</li>}
          </ul>
        </aside>
      </div>
    </div>
  );
}
