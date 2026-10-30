import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Lock, Mail, AlertTriangle, Clock } from 'lucide-react';
import Navbar from '../components/Navbar';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lockoutInfo, setLockoutInfo] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLockoutInfo(null);
    setLoading(true);
    try {
      const user = await login(form);
      toast.success(`Welcome back, ${user.name}!`);
      if (user.role === 'STUDENT') navigate('/student/dashboard');
      else if (user.role === 'INSTRUCTOR') navigate('/instructor/dashboard');
      else navigate('/admin/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Login failed';
      if (msg.toLowerCase().includes('locked') || msg.toLowerCase().includes('lock')) {
        setLockoutInfo(msg);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper">
      <Navbar />
      <div className="max-w-md mx-auto px-4 py-16">
        {/* Header */}
        <div className="page-header text-center">
          <p className="font-mono text-xs text-accent tracking-widest uppercase mb-3">Registrar Portal</p>
          <h1 className="font-display text-4xl text-ink font-light">Sign In</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-8">
          <div>
            <label className="field-label"><Mail size={10} className="inline mr-1" />Email address</label>
            <input
              type="email"
              className="field-input"
              placeholder="you@academiax.edu"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="field-label"><Lock size={10} className="inline mr-1" />Password</label>
            <input
              type="password"
              className="field-input"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-sm text-sm text-danger">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Lockout */}
          {lockoutInfo && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-sm text-sm text-amber-800 dark:text-amber-400">
              <Clock size={14} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Account Temporarily Locked</p>
                <p className="text-xs mt-0.5 opacity-80">{lockoutInfo}</p>
              </div>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="rule mt-8" />

        <p className="text-center text-sm text-ink-muted mt-4">
          New student?{' '}
          <Link to="/register" className="text-accent hover:underline">Create an account</Link>
        </p>

        {/* Demo hint */}
        <div className="mt-6 p-3 border border-hairline rounded-sm bg-surface">
          <p className="font-mono text-xs text-ink-muted mb-2">Demo accounts:</p>
          <div className="space-y-1 font-mono text-[11px] text-ink-light">
            <p>admin@academiax.edu / Admin@Academiax1</p>
            <p>instructor1@academiax.edu / Instr@123</p>
            <p>student1@academiax.edu / Student@123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
