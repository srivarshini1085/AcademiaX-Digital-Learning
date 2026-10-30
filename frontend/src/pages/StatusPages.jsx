import { Component } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, homeFor } from '../context/AuthContext';

function Notice({ code, title, children, action }) {
  return (
    <div className="mx-auto max-w-xl py-12 text-center animate-fade">
      <p className="font-mono text-6xl text-accent">{code}</p>
      <div className="mx-auto my-6 w-16 border-t border-ink/80" />
      <h1 className="text-3xl">{title}</h1>
      <p className="mt-3 text-ink-soft">{children}</p>
      <div className="mt-8 flex justify-center gap-2">{action}</div>
    </div>
  );
}

export function ForbiddenPage() {
  const { user } = useAuth();
  return (
    <Notice code="403" title="This desk isn't yours" action={<Link to={user ? homeFor(user.role) : '/login'} className="btn-primary">Go to your desk</Link>}>
      You are signed in as {user?.role?.toLowerCase() || 'a guest'}, and this page belongs to another role. The server enforces the same rule, so nothing here is reachable another way.
    </Notice>
  );
}

export function NotFoundPage() {
  return (
    <Notice code="404" title="Not in the catalogue" action={<><Link to="/" className="btn-secondary">Home</Link><Link to="/courses" className="btn-primary">Browse courses</Link></>}>
      That page was withdrawn or never existed.
    </Notice>
  );
}

export class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('Unhandled UI error', error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Notice code="500" title="Something broke on this page" action={<button className="btn-primary" onClick={() => window.location.assign('/')}>Reload</button>}>
        The error has been logged to the console. Your enrollments are safe: every change is stored on the server.
      </Notice>
    );
  }
}
