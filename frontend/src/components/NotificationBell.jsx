import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationApi } from '../lib/api';
import { timeAgo } from '../lib/format';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panel = useRef(null);
  const queryClient = useQueryClient();

  const unread = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: async () => (await notificationApi.unreadCount()).data.unreadCount,
    refetchInterval: 15000,
  });
  const list = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: async () => (await notificationApi.mine()).data,
    enabled: open,
  });
  const markAll = useMutation({
    mutationFn: notificationApi.markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  useEffect(() => {
    if (!open) return undefined;
    const close = e => { if (!panel.current?.contains(e.target)) setOpen(false); };
    const esc = e => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const count = unread.data || 0;

  return (
    <div className="relative" ref={panel}>
      <button className="btn-quiet relative px-2" onClick={() => setOpen(o => !o)}
        aria-label={`Notifications${count ? `, ${count} unread` : ''}`} aria-expanded={open}>
        <Bell size={18} strokeWidth={1.75} />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-accent px-1 text-center font-mono text-[10px] leading-[18px] text-accent-on">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
      {open && (
        <div className="card absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] shadow-lg animate-fade">
          <div className="flex items-center justify-between border-b border-rule px-4 py-2.5">
            <p className="eyebrow">Notices</p>
            <button className="text-xs text-accent hover:underline disabled:opacity-40" disabled={!count || markAll.isPending}
              onClick={() => markAll.mutate()}>Mark all read</button>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {list.isLoading && <li className="px-4 py-6 text-center text-sm text-ink-muted">Loading…</li>}
            {list.data?.length === 0 && <li className="px-4 py-6 text-center text-sm text-ink-muted">Nothing yet.</li>}
            {list.data?.slice(0, 8).map(n => (
              <li key={n.id} className={`border-b border-rule px-4 py-3 last:border-0 ${n.readStatus ? '' : 'bg-accent-wash/50'}`}>
                <p className="text-sm font-medium">{n.title}</p>
                <p className="mt-0.5 text-xs text-ink-soft">{n.message}</p>
                <p className="mt-1 font-mono text-[10px] text-ink-muted">{timeAgo(n.createdAt)}</p>
              </li>
            ))}
          </ul>
          <Link to="/notifications" onClick={() => setOpen(false)} className="block border-t border-rule px-4 py-2.5 text-center text-xs text-accent hover:underline">
            All notifications
          </Link>
        </div>
      )}
    </div>
  );
}
