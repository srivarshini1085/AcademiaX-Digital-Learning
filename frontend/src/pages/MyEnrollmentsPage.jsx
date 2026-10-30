import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { enrollmentApi, errorMessage, paymentApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { formatMoney } from '../lib/format';
import EnrollmentTimeline from '../components/EnrollmentTimeline';
import HoldCountdown from '../components/HoldCountdown';
import TuitionReceipt from '../components/TuitionReceipt';
import { EmptyState, ErrorState, Modal, PageHeader, Skeleton, StatusPill } from '../components/ui';

const ACTIVE = ['SEAT_HELD', 'CONFIRMED', 'WAITLISTED'];

function ReceiptModal({ enrollment, onClose }) {
  const { user } = useAuth();
  const payment = useQuery({
    queryKey: ['payment', enrollment?.paymentId],
    queryFn: async () => (await paymentApi.get(enrollment.paymentId)).data,
    enabled: !!enrollment?.paymentId,
  });
  return (
    <Modal open={!!enrollment} title="Tuition receipt" onClose={onClose}>
      {payment.isLoading ? <Skeleton className="h-80" /> : payment.isError ? <ErrorState error={payment.error} /> :
        payment.data && <TuitionReceipt payment={payment.data} enrollment={enrollment} student={user} />}
    </Modal>
  );
}

export default function MyEnrollmentsPage() {
  const queryClient = useQueryClient();
  const [view, setView] = useState('active');
  const [receiptFor, setReceiptFor] = useState(null);
  const [confirming, setConfirming] = useState(null);

  const list = useQuery({ queryKey: ['enrollments', 'mine'], queryFn: async () => (await enrollmentApi.mine()).data, refetchInterval: 15000 });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['enrollments'] });
    queryClient.invalidateQueries({ queryKey: ['course'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const cancel = useMutation({
    mutationFn: e => enrollmentApi.cancel(e.id),
    onSuccess: () => { toast.success('Enrollment cancelled. The seat is back in the pool.'); invalidate(); },
    onError: error => toast.error(errorMessage(error)),
    onSettled: () => setConfirming(null),
  });
  const refund = useMutation({
    mutationFn: e => paymentApi.refund(e.paymentId),
    onSuccess: () => { toast.success('Tuition refunded and seat released.'); invalidate(); },
    onError: error => toast.error(errorMessage(error)),
    onSettled: () => setConfirming(null),
  });

  const all = list.data || [];
  const shown = all.filter(e => (view === 'active' ? ACTIVE.includes(e.status) : !ACTIVE.includes(e.status)));

  return (
    <div>
      <PageHeader eyebrow="Student record" title="My enrollments">
        Every enrollment and where it stands in the hold → pay → confirm process.
      </PageHeader>

      <div className="mb-6 flex gap-1 border-b border-rule" role="tablist">
        {[['active', 'Current'], ['history', 'History']].map(([key, label]) => (
          <button key={key} role="tab" aria-selected={view === key} onClick={() => setView(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${view === key ? 'border-accent text-ink' : 'border-transparent text-ink-soft hover:text-ink'}`}>
            {label} <span className="font-mono text-xs text-ink-muted">({all.filter(e => (key === 'active') === ACTIVE.includes(e.status)).length})</span>
          </button>
        ))}
      </div>

      {list.isLoading ? <div className="space-y-4">{[0, 1, 2].map(i => <Skeleton key={i} className="h-40" />)}</div>
        : list.isError ? <ErrorState error={list.error} onRetry={list.refetch} />
        : shown.length === 0 ? (
          <EmptyState title={view === 'active' ? 'No current enrollments' : 'Nothing here yet'}
            action={view === 'active' && <Link to="/courses" className="btn-primary">Browse the catalogue</Link>}>
            {view === 'active' ? 'Hold a seat in a course to get started.' : 'Cancelled, expired and refunded enrollments appear here.'}
          </EmptyState>
        ) : (
          <ul className="space-y-4">
            {shown.map(e => (
              <li key={e.id} className="card grid gap-6 p-5 sm:p-6 md:grid-cols-[1.2fr_1fr] animate-fade">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link to={`/courses/${e.courseId}`} className="font-mono text-accent hover:underline">{e.courseCode || `Course #${e.courseId}`}</Link>
                    <StatusPill status={e.status} />
                  </div>
                  <h2 className="mt-1 text-xl">{e.courseTitle}</h2>
                  <p className="mt-1 font-mono text-xs text-ink-muted">E-{String(e.id).padStart(6, '0')} · {e.credits ?? '—'} credits · {formatMoney(e.tuitionFee)}</p>
                  {e.status === 'SEAT_HELD' && <div className="mt-4 max-w-sm"><HoldCountdown expiresAt={e.holdExpiresAt} onExpire={invalidate} compact /></div>}
                  <div className="mt-5 flex flex-wrap gap-2">
                    {e.status === 'SEAT_HELD' && <Link to={`/checkout/${e.id}`} className="btn-primary btn-sm">Pay now</Link>}
                    {e.paymentId && ['CONFIRMED', 'REFUNDED'].includes(e.status) && <button className="btn-secondary btn-sm" onClick={() => setReceiptFor(e)}>Receipt</button>}
                    {e.status === 'CONFIRMED' && <button className="btn-quiet btn-sm" onClick={() => setConfirming({ type: 'refund', e })}>Request refund</button>}
                    {['SEAT_HELD', 'WAITLISTED'].includes(e.status) && <button className="btn-quiet btn-sm" onClick={() => setConfirming({ type: 'cancel', e })}>{e.status === 'WAITLISTED' ? 'Leave waitlist' : 'Release seat'}</button>}
                  </div>
                </div>
                <div className="border-t border-dashed border-rule pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                  <EnrollmentTimeline enrollment={e} />
                </div>
              </li>
            ))}
          </ul>
        )}

      <ReceiptModal enrollment={receiptFor} onClose={() => setReceiptFor(null)} />

      <Modal open={!!confirming} title={confirming?.type === 'refund' ? 'Refund tuition?' : 'Cancel this enrollment?'} onClose={() => setConfirming(null)}>
        <p className="text-sm text-ink-soft">
          {confirming?.type === 'refund'
            ? `${formatMoney(confirming?.e.tuitionFee)} will be returned and your seat in ${confirming?.e.courseCode} released. The first student on the waitlist is promoted automatically.`
            : `Your place in ${confirming?.e.courseCode} will be given up.`}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-quiet" onClick={() => setConfirming(null)}>Keep it</button>
          <button className="btn-danger" disabled={cancel.isPending || refund.isPending}
            onClick={() => (confirming.type === 'refund' ? refund.mutate(confirming.e) : cancel.mutate(confirming.e))}>
            {confirming?.type === 'refund' ? 'Refund' : 'Cancel enrollment'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
