import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { courseApi } from '../lib/api';
import { useInstructors } from '../lib/hooks';
import { useAuth, homeFor } from '../context/AuthContext';
import IndexCard from '../components/IndexCard';
import { Skeleton } from '../components/ui';
import { isPast } from '../lib/format';

const STEPS = [
  ['I.', 'Hold a seat', 'Choose a course and the registrar sets one seat aside for you for ten minutes. Nobody else can take it.'],
  ['II.', 'Pay tuition', 'Settle the fee with a card. A double click is safe: each payment carries an idempotency key.'],
  ['III.', 'Confirmed', 'Your seat is yours for the term. If payment fails or time runs out, the seat goes to the next student on the waitlist.'],
];

export default function LandingPage() {
  const { user } = useAuth();
  const instructors = useInstructors();
  const catalogue = useQuery({
    queryKey: ['courses', 'landing'],
    queryFn: async () => (await courseApi.list({ size: 100, sort: 'enrollmentDeadline,asc' })).data,
  });

  const courses = catalogue.data?.content || [];
  const open = courses.filter(c => !isPast(c.enrollmentDeadline));
  const seatsOpen = open.reduce((sum, c) => sum + c.availableSeats, 0);
  const departments = new Set(courses.map(c => c.department)).size;
  const closingSoon = open.filter(c => c.availableSeats > 0).slice(0, 3);

  return (
    <div className="space-y-16">
      <section className="grid gap-10 pt-2 lg:grid-cols-[1.4fr_1fr] lg:items-end animate-fade">
        <div>
          <p className="eyebrow mb-4">Fall term 2026 · Course catalogue</p>
          <h1 className="text-[2.6rem] font-normal leading-[1.05] sm:text-6xl">
            Enroll in a seat that is <em className="text-accent">actually yours</em>.
          </h1>
          <p className="mt-5 max-w-xl text-base text-ink-soft">
            AcademiaX is the registrar's enrollment desk: browse the catalogue, hold a seat, settle tuition, and see your place
            confirmed. Seats are allocated atomically, so the course you paid for can never be oversold.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/courses" className="btn-primary">Browse the catalogue <ArrowRight size={15} /></Link>
            {user ? <Link to={homeFor(user.role)} className="btn-secondary">Go to your desk</Link>
              : <Link to="/register" className="btn-secondary">Create a student account</Link>}
          </div>
        </div>

        <aside className="card p-6">
          <p className="eyebrow">This term, at a glance</p>
          <dl className="mt-4 divide-y divide-rule">
            {[['Courses offered', courses.length], ['Seats still open', seatsOpen], ['Departments', departments]].map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between py-3">
                <dt className="text-sm text-ink-soft">{label}</dt>
                <dd className="font-display text-3xl tabular-nums">{catalogue.isLoading ? <Skeleton className="h-7 w-12" /> : value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 font-mono text-[10.5px] text-ink-muted">Live from the course service</p>
        </aside>
      </section>

      <section>
        <div className="mb-6 flex items-end justify-between border-b border-ink/80 pb-3">
          <h2 className="text-2xl">Closing soon</h2>
          <Link to="/courses" className="text-sm text-accent hover:underline">Full catalogue →</Link>
        </div>
        {catalogue.isLoading ? <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-60" />)}</div> : (
          <div className="grid gap-4 md:grid-cols-3">
            {closingSoon.map(c => <IndexCard key={c.id} course={c} instructor={instructors.data?.get(c.instructorId)} />)}
          </div>
        )}
      </section>

      <section className="grid gap-8 border-t border-ink/80 pt-8 md:grid-cols-3">
        {STEPS.map(([numeral, title, body]) => (
          <div key={title}>
            <p className="font-display text-3xl italic text-accent">{numeral}</p>
            <h3 className="mt-2 text-xl">{title}</h3>
            <p className="mt-2 text-sm text-ink-soft">{body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
