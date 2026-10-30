import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationApi } from '../lib/api';
import { formatDate, timeAgo } from '../lib/format';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui';

const TYPE_LABEL = {
  SEAT_HELD: 'Hold', CONFIRMED: 'Confirmed', PAYMENT_FAILED: 'Payment', EXPIRED: 'Expired',
  WAITLISTED: 'Waitlist', WAITLIST_PROMOTED: 'Promoted', CANCELLED: 'Cancelled', REFUNDED: 'Refund',
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['notifications', 'list'], queryFn: async () => (await notificationApi.mine()).data });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });
  const markOne = useMutation({ mutationFn: notificationApi.markRead, onSuccess: invalidate });
  const markAll = useMutation({ mutationFn: notificationApi.markAllRead, onSuccess: invalidate });
  const unread = (list.data || []).filter(n => !n.readStatus).length;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Notification service" title="Notices"
        actions={<button className="btn-secondary" disabled={!unread || markAll.isPending} onClick={() => markAll.mutate()}>Mark all read</button>}>
        Written by the notification service whenever your enrollment or payment changes state.
      </PageHeader>
      {list.isLoading ? <div className="space-y-3">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
        : list.isError ? <ErrorState error={list.error} onRetry={list.refetch} />
        : list.data.length === 0 ? <EmptyState title="No notices yet">Hold a seat in a course and the registrar will write to you here.</EmptyState>
        : (
          <ol className="divide-y divide-rule border-y border-rule">
            {list.data.map(n => (
              <li key={n.id} className={`grid grid-cols-[72px_1fr] gap-4 py-4 sm:grid-cols-[96px_1fr_auto] ${n.readStatus ? '' : 'bg-accent-wash/40'}`}>
                <span className="pl-2 font-mono text-[10.5px] uppercase tracking-wider text-ink-muted">{TYPE_LABEL[n.type] || n.type}</span>
                <div>
                  <p className={`text-sm ${n.readStatus ? '' : 'font-medium'}`}>{n.title}</p>
                  <p className="mt-0.5 text-sm text-ink-soft">{n.message}</p>
                  <p className="mt-1 font-mono text-[10.5px] text-ink-muted" title={formatDate(n.createdAt, true)}>{timeAgo(n.createdAt)}</p>
                </div>
                {!n.readStatus && (
                  <button className="btn-quiet btn-sm col-start-2 justify-self-start sm:col-start-auto sm:self-center" onClick={() => markOne.mutate(n.id)}>Mark read</button>
                )}
              </li>
            ))}
          </ol>
        )}
    </div>
  );
}
