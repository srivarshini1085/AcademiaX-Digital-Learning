import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { enrollmentApi, paymentApi } from '../lib/api';
import { toast } from 'sonner';
import { CreditCard, Lock, AlertTriangle, CheckCircle } from 'lucide-react';
import HoldCountdown from '../components/HoldCountdown';
import Navbar from '../components/Navbar';

function CardInput({ value, onChange, placeholder, maxLength, pattern, className = '' }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      className={`field-input font-mono ${className}`}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      maxLength={maxLength}
      pattern={pattern}
    />
  );
}

export default function CheckoutPage() {
  const { enrollmentId } = useParams();
  const navigate = useNavigate();

  const { data: enrollment, isLoading } = useQuery({
    queryKey: ['enrollment', enrollmentId],
    queryFn: () => enrollmentApi.getEnrollment(enrollmentId).then(r => r.data),
    refetchInterval: 60000,
  });

  const [card, setCard] = useState({ number: '', holder: '', expiry: '', cvv: '' });
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(null);
  const [success, setSuccess] = useState(null);

  const formatCardNumber = (v) => v.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim().slice(0, 19);

  const handlePay = async (e) => {
    e.preventDefault();
    setFailed(null);
    setLoading(true);
    const idempotencyKey = `${enrollmentId}-${Date.now()}`;
    try {
      const { data } = await paymentApi.process({
        enrollmentId: Number(enrollmentId),
        amount: enrollment?.tuitionFee,
        cardNumber: card.number.replace(/\s/g, ''),
        cardHolder: card.holder,
        expiry: card.expiry,
        cvv: card.cvv,
      }, idempotencyKey);

      if (data.status === 'SUCCESS') {
        setSuccess(data);
        toast.success('Payment successful! Enrollment confirmed.');
      } else {
        setFailed(data.failureReason || 'Payment declined');
        toast.error('Payment declined');
      }
    } catch (err) {
      setFailed(err.response?.data?.message || 'Payment failed');
      toast.error('Payment failed');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-paper">
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <CheckCircle size={48} className="text-success mx-auto mb-4" />
          <h1 className="font-display text-3xl text-ink mb-2">Payment Confirmed</h1>
          <p className="text-ink-muted mb-6">Your enrollment has been confirmed.</p>
          <p className="font-mono text-xs text-ink-muted mb-8">TXN: {success.transactionRef}</p>
          <button onClick={() => navigate('/student/enrollments')} className="btn-primary w-full justify-center">
            View My Enrollments
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <Navbar />
      <div className="max-w-md mx-auto px-4 py-10">
        <div className="page-header">
          <p className="font-mono text-xs text-accent tracking-widest uppercase mb-2">Tuition Payment</p>
          <h1 className="font-display text-3xl text-ink font-light">Complete Payment</h1>
        </div>

        {/* Countdown */}
        {enrollment?.holdExpiresAt && (
          <div className="mb-6 p-4 border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 rounded-sm">
            <HoldCountdown holdExpiresAt={enrollment.holdExpiresAt} secondsRemaining={enrollment.secondsRemaining}
              onExpired={() => { toast.error('Seat hold expired'); navigate('/courses'); }} />
          </div>
        )}

        {/* Summary */}
        <div className="index-card mb-6">
          <p className="text-xs text-ink-muted uppercase tracking-wide mb-2">Enrollment Summary</p>
          <p className="font-display text-lg text-ink">{enrollment?.courseTitle || '—'}</p>
          <p className="mono-badge text-accent">{enrollment?.courseCode}</p>
          <div className="rule" />
          <div className="flex justify-between font-mono text-sm">
            <span className="text-ink-muted">Tuition fee</span>
            <span className="text-ink font-medium">₹{enrollment?.tuitionFee ? Number(enrollment.tuitionFee).toLocaleString('en-IN') : '—'}</span>
          </div>
        </div>

        {/* Failure card alert */}
        <div className="mb-4 p-3 bg-surface border border-hairline rounded-sm text-xs text-ink-muted font-mono">
          Demo: card <span className="text-danger">4000 0000 0000 0002</span> always fails. Use <span className="text-success">4111 1111 1111 1111</span> to succeed.
        </div>

        <form onSubmit={handlePay} className="space-y-4">
          <div>
            <label className="field-label">Card Number</label>
            <CardInput value={card.number} placeholder="4111 1111 1111 1111" maxLength={19}
              onChange={e => setCard(c => ({ ...c, number: formatCardNumber(e.target.value) }))} />
          </div>
          <div>
            <label className="field-label">Card Holder Name</label>
            <input type="text" className="field-input" placeholder="Alice Johnson"
              value={card.holder} onChange={e => setCard(c => ({ ...c, holder: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Expiry (MM/YY)</label>
              <CardInput value={card.expiry} placeholder="12/28" maxLength={5}
                onChange={e => setCard(c => ({ ...c, expiry: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">CVV</label>
              <CardInput value={card.cvv} placeholder="123" maxLength={4}
                onChange={e => setCard(c => ({ ...c, cvv: e.target.value.replace(/\D/g, '') }))} />
            </div>
          </div>

          {failed && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-sm text-sm text-danger">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>{failed}</span>
            </div>
          )}

          <button type="submit" disabled={loading || !enrollment} className="btn-primary w-full justify-center py-3 text-base">
            <Lock size={14} />
            {loading ? 'Processing…' : `Pay ₹${enrollment?.tuitionFee ? Number(enrollment.tuitionFee).toLocaleString('en-IN') : '—'}`}
          </button>
        </form>

        <p className="text-center text-[10px] text-ink-muted mt-4 font-mono">
          This is a simulated payment. No real charges are made.
        </p>
      </div>
    </div>
  );
}

