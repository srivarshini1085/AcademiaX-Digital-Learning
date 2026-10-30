import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { useAuth, homeFor } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import NotificationBell from './NotificationBell';

const NAV = {
  GUEST: [['/courses', 'Catalogue']],
  STUDENT: [['/dashboard', 'Overview'], ['/courses', 'Catalogue'], ['/enrollments', 'My enrollments']],
  INSTRUCTOR: [['/instructor', 'My courses'], ['/courses', 'Catalogue']],
  ADMIN: [['/admin', 'Registrar'], ['/courses', 'Catalogue'], ['/admin/console', 'System console']],
};

const firstName = name => (name || '').split(' ').find(part => !/^(dr|prof|mr|ms|mrs)\.?$/i.test(part)) || name;

function Wordmark() {
  return (
    <Link to="/" className="group flex items-baseline gap-2">
      <span className="font-display text-xl font-semibold tracking-tight">Academia<span className="text-accent">X</span></span>
      <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted md:inline">Office of the Registrar</span>
    </Link>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const links = NAV[user?.role || 'GUEST'];

  const signOut = async () => {
    await logout();
    navigate('/login');
  };

  const linkClass = ({ isActive }) =>
    `relative py-1 text-sm transition-colors ${isActive ? 'text-ink after:absolute after:-bottom-[19px] after:left-0 after:right-0 after:h-0.5 after:bg-accent' : 'text-ink-soft hover:text-ink'}`;

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:bg-surface focus:px-3 focus:py-2">Skip to content</a>
      <div className="border-b border-rule bg-sunken/60">
        <div className="container-page flex h-7 items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-muted">
          <span>Academic year 2026–27 · Fall term</span>
          {user && <span className="hidden sm:inline">{user.role.toLowerCase()} · {user.email}</span>}
        </div>
      </div>
      <header className="sticky top-0 z-30 border-b border-ink/80 bg-paper/95 backdrop-blur">
        <div className="container-page flex h-14 items-center justify-between gap-4">
          <Wordmark />
          <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
            {links.map(([to, label]) => <NavLink key={to} to={to} end className={linkClass}>{label}</NavLink>)}
          </nav>
          <div className="flex items-center gap-1">
            <button className="btn-quiet px-2" onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
              {theme === 'dark' ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
            </button>
            {user && <NotificationBell />}
            {user ? (
              <div className="hidden items-center gap-1 md:flex">
                <NavLink to="/profile" className="btn-quiet">{firstName(user.name)}</NavLink>
                <button className="btn-quiet" onClick={signOut}>Sign out</button>
              </div>
            ) : (
              <div className="hidden items-center gap-2 md:flex">
                <Link to="/login" className="btn-quiet">Sign in</Link>
                <Link to="/register" className="btn-primary">Apply</Link>
              </div>
            )}
            <button className="btn-quiet px-2 md:hidden" onClick={() => setMenuOpen(o => !o)} aria-label="Menu" aria-expanded={menuOpen}>
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="container-page flex flex-col gap-1 border-t border-rule pb-4 pt-2 md:hidden" aria-label="Mobile" onClick={() => setMenuOpen(false)}>
            {links.map(([to, label]) => <NavLink key={to} to={to} end className="py-2 text-sm">{label}</NavLink>)}
            {user ? (
              <>
                <NavLink to="/notifications" className="py-2 text-sm">Notifications</NavLink>
                <NavLink to="/profile" className="py-2 text-sm">Profile &amp; security</NavLink>
                <button className="py-2 text-left text-sm text-accent" onClick={signOut}>Sign out</button>
              </>
            ) : (
              <>
                <Link to="/login" className="py-2 text-sm">Sign in</Link>
                <Link to="/register" className="py-2 text-sm text-accent">Create a student account</Link>
              </>
            )}
          </nav>
        )}
      </header>

      <main id="main" className="container-page flex-1 py-8 sm:py-10">
        <Outlet />
      </main>

      <footer className="border-t border-rule">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-ink-muted sm:flex-row sm:justify-between">
          <p><span className="font-display text-sm text-ink">AcademiaX</span> · Course enrollment &amp; tuition processing</p>
          <p className="font-mono">{user ? <Link className="hover:text-ink" to={homeFor(user.role)}>Back to your desk</Link> : 'PS035 · Review 2 build'}</p>
        </div>
      </footer>
    </div>
  );
}
