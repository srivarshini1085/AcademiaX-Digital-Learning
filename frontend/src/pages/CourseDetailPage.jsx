import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { courseApi, enrollmentApi, errorMessage } from '../lib/api';
import { useInstructors } from '../lib/hooks';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatMoney, isPast } from '../lib/format';
import SeatMap from '../components/SeatMap';
import HoldCountdown from '../components/HoldCountdown';
import { ErrorState, Skeleton, StatusPill } from '../components/ui';

const ACTIVE = ['SEAT_HELD', 'CONFIRMED', 'WAITLISTED'];

export default function CourseDetailPage() {
  const { id } = useParams();
  const courseId = Number(id);
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const instructors = useInstructors();

  const course = useQuery({ queryKey: ['course', courseId], queryFn: async () => (await courseApi.get(courseId)).data, refetchInterval: 10000 });
  const mine = useQuery({
    queryKey: ['enrollments', 'mine'],
    queryFn: async () => (await enrollmentApi.mine()).data,
    enabled: user?.role === 'STUDENT',
  });
  const myEnrollment = mine.data?.find(e => e.courseId === courseId && ACTIVE.includes(e.status));

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['course', courseId] });
    queryClient.invalidateQueries({ queryKey: ['enrollments'] });
  };

  const hold = useMutation({
    mutationFn: () => enrollmentApi.hold(courseId),
    onSuccess: ({ data }) => { refresh(); navigate(`/checkout/${data.id}`); },
    onError: error => {
      refresh();
      toast.error(error.response?.status === 409 && /full/i.test(errorMessage(error))
        ? 'Someone took the last seat a moment ago. You can join the waitlist.' : errorMessage(error));
    },
  });
  const waitlist = useMutation({
    mutationFn: () => enrollmentApi.joinWaitlist(courseId),
    onSuccess: ({ data }) => { refresh(); toast.success(`You're #${data.waitlistPosition} on the waitlist. We'll hold a seat for you when one opens.`); },
    onError: error => toast.error(errorMessage(error)),
  });

  if (course.isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-64" /></div>;
  if (course.isError) return <ErrorState error={course.error} onRetry={course.refetch} />;

  const c = course.data;
  const instructor = instructors.data?.get(c.instructorId);
  const closed = isPast(c.enrollmentDeadline);
  const full = c.availableSeats === 0;
  const canManage = user?.role === 'ADMIN' || (user?.role === 'INSTRUCTOR' && user.id === c.instructorId);

  let action;
  if (!user) {
    action = <Link to="/login" state={{ from: `/courses/${courseId}` }} className="btn-primary w-full">Sign in to enroll</Link>;
  } else if (user.role !== 'STUDENT') {
    action = canManage
      ? <Link to={`/courses/${courseId}/edit`} className="btn-secondary w-full">Edit this course</Link>
      : <p className="text-sm text-ink-muted">Only students can enroll.</p>;
  } else if (myEnrollment?.status === 'SEAT_HELD') {
    action = (
      <div className="space-y-4">
        <HoldCountdown expiresAt={myEnrollment.holdExpiresAt} onExpire={refresh} />
        <Link to={`/checkout/${myEnrollment.id}`} className="btn-primary w-full">Continue to payment</Link>
      </div>
    );
  } else if (myEnrollment?.status === 'CONFIRMED') {
    action = <p className="text-sm">You are enrolled. <Link to="/enrollments" className="text-accent hover:underline">View in My enrollments</Link></p>;
  } else if (myEnrollment?.status === 'WAITLISTED') {
    action = <p className="text-sm">You are <strong>#{myEnrollment.waitlistPosition}</strong> on the waitlist. A seat will be held for you automatically.</p>;
  } else if (closed) {
    action = <p className="text-sm text-ink-muted">Enrollment closed on {formatDate(c.enrollmentDeadline)}.</p>;
  } else if (full) {
    action = <button className="btn-secondary w-full" disabled={waitlist.isPending} onClick={() => waitlist.mutate()}>{waitlist.isPending ? 'Joining…' : 'Join the waitlist'}</button>;
  } else {
    action = <button className="btn-primary w-full" disabled={hold.isPending} onClick={() => hold.mutate()}>{hold.isPending ? 'Holding a seat…' : 'Hold my seat for 10 minutes'}</button>;
  }

  return (
    <div className="animate-fade">
      <Link to="/courses" className="mb-6 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink"><ArrowLeft size={14} /> Catalogue</Link>
      <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr]">
        <article>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="font-mono text-lg text-accent">{c.code}</span>
            <span className="eyebrow">{c.department} · {c.level} · {c.semester}</span>
          </div>
          <div className="my-4 border-t border-ink/80" />
          <h1 className="text-4xl leading-tight sm:text-5xl">{c.title}</h1>
          <p className="mt-2 text-ink-soft">Taught by {instructor?.name || 'faculty to be announced'}</p>
          <p className="mt-6 max-w-prose leading-relaxed">{c.description}</p>

          <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-4">
            {[['Credits', c.credits], ['Tuition', formatMoney(c.tuitionFee)], ['Academic year', c.academicYear], ['Enroll by', formatDate(c.enrollmentDeadline)]].map(([k, v]) => (
              <div key={k} className="bg-surface p-4">
                <dt className="eyebrow">{k}</dt>
                <dd className="mt-1 font-mono text-sm">{v}</dd>
              </div>
            ))}
          </dl>

          <section className="mt-10">
            <h2 className="mb-1 text-2xl">Seat map</h2>
            <p className="mb-5 text-sm text-ink-soft">{c.availableSeats} of {c.totalSeats} seats open · updates every few seconds</p>
            <SeatMap total={c.totalSeats} available={c.availableSeats}
              mine={myEnrollment && myEnrollment.status !== 'WAITLISTED' ? myEnrollment.status : null} />
          </section>
        </article>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <p className="eyebrow">Enrollment</p>
            <p className="mt-2 font-display text-3xl">{formatMoney(c.tuitionFee)}</p>
            <p className="text-xs text-ink-muted">Tuition for {c.credits} credits</p>
            {myEnrollment && <div className="mt-3"><StatusPill status={myEnrollment.status} /></div>}
            <div className="my-5 rule-dashed" />
            {action}
          </div>
          {canManage && user.role !== 'STUDENT' && (
            <Link to={user.role === 'ADMIN' ? '/admin?tab=enrollments' : `/instructor?course=${c.id}`} className="mt-3 block text-center text-sm text-accent hover:underline">
              View roster
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
