import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { CreditCard, XCircle } from 'lucide-react';
import { courseApi, enrollmentApi, errorMessage, paymentApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { formatMoney, newId } from '../lib/format';
import HoldCountdown from '../components/HoldCountdown';
import SeatMap from '../components/SeatMap';
import TuitionReceipt from '../components/TuitionReceipt';
import EnrollmentTimeline from '../components/EnrollmentTimeline';
import { ErrorState, Field, Skeleton, StatusPill } from '../components/ui';

const schema = z.object({
  cardHolder: z.string().trim().min(2, 'Name as printed on the card'),
  cardNumber: z.string().transform(v => v.replace(/\s+/g, '')).pipe(z.string().regex(/^\d{12,19}$/, 'Card number must be 12–19 digits')),
  expiry: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Use MM/YY'),
  cvv: z.string().regex(/^\d{3,4}$/, '3 or 4 digits'),
});

const TEST_CARDS = [['4242 4242 4242 4242', 'approves'], ['4000 0000 0000 0002', 'is always declined']];

export default function CheckoutPage() {
  const { enrollmentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // One key per checkout visit: a double click or a retried request can never charge twice.
  const idempotencyKey = useRef(newId());
  const [outcome, setOutcome] = useState(null);

  const enrollment = useQuery({ queryKey: ['enrollment', enrollmentId], queryFn: async () => (await enrollmentApi.get(enrollmentId)).data });
  const courseId = enrollment.data?.courseId;
  const course = useQuery({ queryKey: ['course', courseId], queryFn: async () => (await courseApi.get(courseId)).data, enabled: !!courseId });

  const { register, handleSubmit, setValue, formState: { errors } } = useForm({ resolver: zodResolver(schema), defaultValues: { cardHolder: user?.name || '' } });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['enrollment', enrollmentId] });
    queryClient.invalidateQueries({ queryKey: ['enrollments'] });
    queryClient.invalidateQueries({ queryKey: ['course', courseId] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const pay = useMutation({
    mutationFn: card => paymentApi.pay({ enrollmentId: Number(enrollmentId), ...card }, idempotencyKey.current),
    onSuccess: ({ data }) => { setOutcome(data); refreshAll(); if (data.status === 'SUCCESS') toast.success('Payment received. Your enrollment is confirmed.'); },
    onError: error => { refreshAll(); toast.error(errorMessage(error)); },
  });

  const rehold = useMutation({
    mutationFn: () => enrollmentApi.hold(courseId),
    onSuccess: ({ data }) => { idempotencyKey.current = newId(); setOutcome(null); refreshAll(); navigate(`/checkout/${data.id}`, { replace: true }); },
    onError: error => toast.error(errorMessage(error)),
  });

  if (enrollment.isLoading) return <div className="grid gap-8 lg:grid-cols-2"><Skeleton className="h-96" /><Skeleton className="h-96" /></div>;
  if (enrollment.isError) return <ErrorState error={enrollment.error} onRetry={enrollment.refetch} />;

  const e = enrollment.data;
  const c = course.data;

  if (outcome?.status === 'SUCCESS' || outcome?.status === 'REFUNDED') {
    return (
      <div className="mx-auto max-w-3xl animate-fade">
        <p className="eyebrow mb-2 text-center">Payment {outcome.status === 'SUCCESS' ? 'received' : 'reversed'}</p>
        <h1 className="mb-8 text-center text-4xl">{outcome.status === 'SUCCESS' ? 'You are enrolled.' : 'The hold expired before confirmation.'}</h1>
        {outcome.status === 'REFUNDED' && <p className="mb-6 text-center text-sm text-ink-soft">{outcome.failureReason}</p>}
        <div className="grid gap-10 md:grid-cols-[1fr_1fr] md:items-start">
          <TuitionReceipt payment={outcome} enrollment={e} student={user} />
          <div className="card p-6">
            <p className="eyebrow mb-4">Enrollment E-{String(e.id).padStart(6, '0')}</p>
            <EnrollmentTimeline enrollment={e} />
            <Link to="/enrollments" className="btn-secondary mt-6 w-full">My enrollments</Link>
          </div>
        </div>
      </div>
    );
  }

  const declined = outcome?.status === 'FAILED' || e.status === 'PAYMENT_FAILED';

  return (
    <div className="animate-fade">
      <p className="eyebrow mb-2">Checkout · enrollment E-{String(e.id).padStart(6, '0')}</p>
      <h1 className="mb-8 text-4xl">{e.courseCode} <span className="text-ink-soft">{e.courseTitle}</span></h1>

      <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
        <section className="space-y-6">
          {e.status === 'SEAT_HELD' && <HoldCountdown expiresAt={e.holdExpiresAt} onExpire={refreshAll} />}
          <div className="card p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="eyebrow">Amount due</p>
                <p className="mt-1 font-display text-4xl tabular-nums">{formatMoney(e.tuitionFee, true)}</p>
                <p className="text-xs text-ink-muted">Set by the registrar from the course's tuition, not by this page.</p>
              </div>
              <StatusPill status={e.status} />
            </div>
            <div className="my-5 rule-dashed" />
            {c ? <SeatMap total={c.totalSeats} available={c.availableSeats} mine={['SEAT_HELD', 'CONFIRMED'].includes(e.status) ? e.status : null} /> : <Skeleton className="h-24" />}
          </div>
          <div className="card p-6"><EnrollmentTimeline enrollment={e} /></div>
        </section>

        <section>
          {declined ? (
            <div role="alert" className="card border-bad/50 p-6">
              <XCircle className="mb-3 text-bad" size={28} strokeWidth={1.5} />
              <h2 className="text-2xl">Payment declined</h2>
              <p className="mt-2 text-sm text-ink-soft">{outcome?.failureReason || e.cancellationReason}</p>
              <p className="mt-4 text-sm">
                Your held seat was <strong>released back to the course</strong> as a compensating step, so another student can take it.
                {c && <> The course now has <span className="font-mono">{c.availableSeats}</span> open seat{c.availableSeats === 1 ? '' : 's'}.</>}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {c?.availableSeats > 0 && <button className="btn-primary" disabled={rehold.isPending} onClick={() => rehold.mutate()}>Hold a seat again</button>}
                <Link to={`/courses/${e.courseId}`} className="btn-secondary">Back to course</Link>
              </div>
            </div>
          ) : e.status !== 'SEAT_HELD' ? (
            <div className="card p-6">
              <h2 className="text-2xl">Nothing to pay</h2>
              <p className="mt-2 text-sm text-ink-soft">This enrollment is {e.status.toLowerCase().replace('_', ' ')}.</p>
              <Link to="/enrollments" className="btn-secondary mt-5">My enrollments</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(card => pay.mutate(card))} className="card space-y-5 p-6 sm:p-8" noValidate>
              <div className="flex items-center gap-2"><CreditCard size={18} /><h2 className="text-2xl">Card details</h2></div>
              <p className="text-xs text-ink-muted">Simulated gateway: no real card is charged.</p>
              <Field label="Cardholder name" id="cardHolder" error={errors.cardHolder?.message}>
                <input id="cardHolder" autoComplete="cc-name" className="field-input" {...register('cardHolder')} />
              </Field>
              <Field label="Card number" id="cardNumber" error={errors.cardNumber?.message}>
                <input id="cardNumber" inputMode="numeric" autoComplete="cc-number" className="field-input font-mono" placeholder="4242 4242 4242 4242" {...register('cardNumber')} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Expiry" id="expiry" error={errors.expiry?.message}>
                  <input id="expiry" autoComplete="cc-exp" className="field-input font-mono" placeholder="MM/YY" {...register('expiry')} />
                </Field>
                <Field label="CVV" id="cvv" error={errors.cvv?.message}>
                  <input id="cvv" inputMode="numeric" autoComplete="cc-csc" className="field-input font-mono" placeholder="123" {...register('cvv')} />
                </Field>
              </div>
              <div className="border border-dashed border-rule p-3 text-xs">
                <p className="eyebrow mb-1.5">Test cards</p>
                {TEST_CARDS.map(([number, note]) => (
                  <button type="button" key={number} className="block py-0.5 text-left text-ink-soft hover:text-accent"
                    onClick={() => { setValue('cardNumber', number); setValue('expiry', '12/30'); setValue('cvv', '123'); }}>
                    <span className="font-mono text-ink">{number}</span> {note}
                  </button>
                ))}
              </div>
              <button className="btn-primary w-full" disabled={pay.isPending}>
                {pay.isPending ? 'Processing…' : `Pay ${formatMoney(e.tuitionFee, true)}`}
              </button>
              <p className="text-center font-mono text-[10px] text-ink-muted">Idempotency-Key {idempotencyKey.current.slice(0, 8)}…</p>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
