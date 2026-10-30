const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const moneyExact = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });

export const formatMoney = (value, exact = false) => (value == null ? '—' : (exact ? moneyExact : money).format(Number(value)));

export function formatDate(value, withTime = false) {
  if (!value) return '—';
  const d = new Date(value);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function timeAgo(value) {
  if (!value) return '';
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return `${Math.floor(seconds / 86400)} d ago`;
}

export const isPast = value => value && new Date(value).getTime() < Date.now();

export const STATUS_LABEL = {
  SEAT_HELD: 'Seat held',
  CONFIRMED: 'Confirmed',
  PAYMENT_FAILED: 'Payment failed',
  EXPIRED: 'Hold expired',
  CANCELLED: 'Cancelled',
  WAITLISTED: 'Waitlisted',
  REFUNDED: 'Refunded',
  SUCCESS: 'Paid',
  FAILED: 'Declined',
  PENDING: 'Pending',
};

export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
