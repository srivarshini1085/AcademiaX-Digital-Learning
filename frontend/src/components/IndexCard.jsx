import { Link } from 'react-router-dom';
import { formatDate, formatMoney, isPast } from '../lib/format';

/** A course as a library index card: mono call number, a rule, serif title, then a small facts grid. */
export default function IndexCard({ course, instructor }) {
  const full = course.availableSeats === 0;
  const closed = isPast(course.enrollmentDeadline);
  const taken = course.totalSeats - course.availableSeats;

  let availability = `${course.availableSeats} of ${course.totalSeats} seats open`;
  let tone = 'text-ink-soft';
  if (closed) { availability = 'Enrollment closed'; tone = 'text-ink-muted'; }
  else if (full) { availability = 'Full · waitlist open'; tone = 'text-accent'; }
  else if (course.availableSeats <= 3) { availability = `Only ${course.availableSeats} seat${course.availableSeats === 1 ? '' : 's'} left`; tone = 'text-accent'; }

  return (
    <Link to={`/courses/${course.id}`}
      className="card group relative flex flex-col p-5 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_rgb(var(--rule))] animate-fade">
      {/* the punched hole of a catalogue card */}
      <span aria-hidden="true" className="absolute bottom-3 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full border border-rule bg-paper" />
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-sm font-medium tracking-wide text-accent">{course.code}</span>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-muted">{course.department}</span>
      </div>
      <div className="my-3 border-t border-ink/70" />
      <h3 className="font-display text-xl leading-snug group-hover:text-accent">{course.title}</h3>
      <p className="mt-1 text-sm text-ink-soft">{instructor?.name || 'Faculty to be announced'}</p>

      <dl className="mt-4 grid grid-cols-3 gap-x-3 gap-y-1 border-t border-dashed border-rule pt-3 text-xs">
        <div><dt className="text-ink-muted">Credits</dt><dd className="font-mono text-ink">{course.credits}</dd></div>
        <div><dt className="text-ink-muted">Tuition</dt><dd className="font-mono text-ink">{formatMoney(course.tuitionFee)}</dd></div>
        <div><dt className="text-ink-muted">Level</dt><dd className="text-ink">{/^grad/i.test(course.level || '') ? 'Graduate' : 'Undergrad'}</dd></div>
      </dl>

      <div className="mt-4 pb-3">
        <div className="flex h-1 gap-px overflow-hidden" aria-hidden="true">
          {Array.from({ length: Math.min(course.totalSeats, 60) }).map((_, i) => (
            <span key={i} className={`flex-1 ${i < Math.round((taken / course.totalSeats) * Math.min(course.totalSeats, 60)) ? 'bg-ink/70' : 'bg-rule'}`} />
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className={tone}>{availability}</span>
          <span className="font-mono text-ink-muted">closes {formatDate(course.enrollmentDeadline)}</span>
        </div>
      </div>
    </Link>
  );
}
