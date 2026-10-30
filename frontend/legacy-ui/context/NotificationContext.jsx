import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { notificationApi } from '../lib/api';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const intervalRef = useRef(null);

  const isLoggedIn = () => !!localStorage.getItem('accessToken');

  const fetchUnreadCount = useCallback(async () => {
    if (!isLoggedIn()) return;
    try {
      const { data } = await notificationApi.getUnreadCount();
      setUnreadCount(data.count ?? 0);
    } catch {
      // ignore — backend may be starting
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!isLoggedIn()) return;
    try {
      const { data } = await notificationApi.getAll();
      setNotifications(data.content ?? data ?? []);
    } catch {
      setNotifications([]);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await notificationApi.markAllRead();
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {}
  }, []);

  useEffect(() => {
    if (isLoggedIn()) {
      fetchUnreadCount();
      intervalRef.current = setInterval(fetchUnreadCount, 30000);
    }
    return () => clearInterval(intervalRef.current);
  }, [fetchUnreadCount]);

  return (
    <NotificationContext.Provider value={{ unreadCount, notifications, fetchNotifications, markAllRead, setUnreadCount }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be inside NotificationProvider');
  return ctx;
};

