import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Bell, Sun, Moon, BookOpen, Menu, X, LogOut, User, LayoutDashboard } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggle = () => {
    document.documentElement.classList.toggle('dark');
    setDark(d => !d);
  };
  return (
    <button onClick={toggle} className="p-1.5 rounded-sm hover:bg-hairline/50 text-ink-muted transition-colors" aria-label="Toggle theme">
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const dashboardLink = () => {
    if (!user) return '/';
    if (user.role === 'STUDENT') return '/student/dashboard';
    if (user.role === 'INSTRUCTOR') return '/instructor/dashboard';
    if (user.role === 'ADMIN') return '/admin/dashboard';
    return '/';
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  return (
    <header className="border-b border-hairline bg-surface/90 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <BookOpen size={18} className="text-accent" />
          <span className="font-display text-ink font-semibold tracking-tight">AcademiaX</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 text-sm">
          <Link to="/courses" className="px-3 py-1.5 rounded-sm text-ink-light hover:text-ink hover:bg-hairline/40 transition-colors">Catalogue</Link>
          {isAuthenticated && (
            <>
              <Link to={dashboardLink()} className="px-3 py-1.5 rounded-sm text-ink-light hover:text-ink hover:bg-hairline/40 transition-colors">Dashboard</Link>
              {user?.role === 'STUDENT' && (
                <Link to="/student/enrollments" className="px-3 py-1.5 rounded-sm text-ink-light hover:text-ink hover:bg-hairline/40 transition-colors">My Courses</Link>
              )}
              {user?.role === 'ADMIN' && (
                <Link to="/admin/system" className="px-3 py-1.5 rounded-sm text-ink-light hover:text-ink hover:bg-hairline/40 transition-colors">System</Link>
              )}
            </>
          )}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {isAuthenticated ? (
            <>
              <Link to="/notifications" className="relative p-1.5 rounded-sm hover:bg-hairline/50 text-ink-muted transition-colors">
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-accent text-white font-mono text-[9px] flex items-center justify-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
              <Link to="/profile" className="p-1.5 rounded-sm hover:bg-hairline/50 text-ink-muted transition-colors">
                <User size={16} />
              </Link>
              <button onClick={handleLogout} className="p-1.5 rounded-sm hover:bg-hairline/50 text-ink-muted transition-colors" aria-label="Logout">
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="btn-ghost text-xs py-1.5">Log in</Link>
              <Link to="/register" className="btn-primary text-xs py-1.5">Register</Link>
            </div>
          )}
          {/* Mobile menu toggle */}
          <button className="md:hidden p-1.5" onClick={() => setMobileOpen(o => !o)}>
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-hairline bg-surface px-4 py-3 flex flex-col gap-1 text-sm animate-slide-up">
          <Link to="/courses" className="py-2 text-ink-light hover:text-ink">Catalogue</Link>
          {isAuthenticated && (
            <>
              <Link to={dashboardLink()} className="py-2 text-ink-light hover:text-ink">Dashboard</Link>
              {user?.role === 'STUDENT' && <Link to="/student/enrollments" className="py-2 text-ink-light hover:text-ink">My Courses</Link>}
              <Link to="/notifications" className="py-2 text-ink-light hover:text-ink flex items-center gap-2">
                Notifications {unreadCount > 0 && <span className="bg-accent text-white rounded-full text-xs px-1.5">{unreadCount}</span>}
              </Link>
              <Link to="/profile" className="py-2 text-ink-light hover:text-ink">Profile</Link>
              <button onClick={handleLogout} className="py-2 text-left text-ink-light hover:text-ink">Log out</button>
            </>
          )}
        </div>
      )}
    </header>
  );
}

