import { formatDate } from '../lib/format';

/**
 * Vertical stepper of the enrollment saga: Held → Paid → Confirmed, or a branch to Expired / Failed / Cancelled / Refunded.
 * Built from the enrollment's current status (the service stores state, not an event log).
 */
function stepsFor(e) {
  const held = { key: 'held', label: 'Seat held', note: 'Ten-minute hold placed on a seat' };
  switch (e.status) {
    case 'WAITLISTED':
      return [{ key: 'wait', label: `Waitlisted · position ${e.waitlistPosition ?? '—'}`, note: 'Promoted automatically when a seat frees up', state: 'current' },
        { ...held, state: 'todo' }, { key: 'paid', label: 'Tuition paid', state: 'todo' }, { key: 'done', label: 'Confirmed', state: 'todo' }];
    case 'SEAT_HELD':
      return [{ ...held, state: 'done', when: e.enrolledAt }, { key: 'paid', label: 'Awaiting payment', note: 'Pay before the hold expires', state: 'current' },
        { key: 'done', label: 'Confirmed', state: 'todo' }];
    case 'CONFIRMED':
      return [{ ...held, state: 'done', when: e.enrolledAt }, { key: 'paid', label: 'Tuition paid', state: 'done' },
        { key: 'done', label: 'Enrollment confirmed', note: 'Seat is yours for the term', state: 'done', when: e.updatedAt }];
    case 'PAYMENT_FAILED':
      return [{ ...held, state: 'done', when: e.enrolledAt }, { key: 'fail', label: 'Payment declined', note: 'Seat released back to the course', state: 'stopped', when: e.updatedAt }];
    case 'EXPIRED':
      return [{ ...held, state: 'done', when: e.enrolledAt }, { key: 'exp', label: 'Hold expired', note: 'No payment within 10 minutes; seat released', state: 'stopped', when: e.updatedAt }];
    case 'REFUNDED':
      return [{ ...held, state: 'done', when: e.enrolledAt }, { key: 'paid', label: 'Tuition paid', state: 'done' }, { key: 'done', label: 'Confirmed', state: 'done' },
        { key: 'ref', label: 'Refunded', note: 'Tuition returned; seat released', state: 'stopped', when: e.updatedAt }];
    case 'CANCELLED':
    default:
      return [{ ...held, state: 'done', when: e.enrolledAt }, { key: 'can', label: 'Cancelled', note: e.cancellationReason, state: 'stopped', when: e.updatedAt }];
  }
}

const DOT = {
  done: 'bg-ink border-ink',
  current: 'bg-surface border-accent ring-4 ring-accent/15',
  stopped: 'bg-accent border-accent',
  todo: 'bg-surface border-ink/30',
};

export default function EnrollmentTimeline({ enrollment }) {
  const steps = stepsFor(enrollment);
  return (
    <ol className="relative" aria-label="Enrollment progress">
      {steps.map((step, i) => (
        <li key={step.key} className="relative flex gap-3 pb-4 last:pb-0">
          {i < steps.length - 1 && <span aria-hidden="true" className={`absolute left-[5px] top-3 h-full w-px ${step.state === 'done' ? 'bg-ink' : 'bg-rule'}`} />}
          <span aria-hidden="true" className={`relative z-10 mt-1 h-[11px] w-[11px] shrink-0 rounded-full border-2 ${DOT[step.state]}`} />
          <div className="min-w-0">
            <p className={`text-sm ${step.state === 'todo' ? 'text-ink-muted' : step.state === 'stopped' ? 'text-accent' : 'text-ink'}`}>{step.label}</p>
            {(step.note || step.when) && (
              <p className="text-xs text-ink-muted">
                {step.note}{step.note && step.when ? ' · ' : ''}{step.when && <span className="font-mono">{formatDate(step.when, true)}</span>}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
