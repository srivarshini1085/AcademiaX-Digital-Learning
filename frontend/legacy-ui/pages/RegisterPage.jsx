import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import Navbar from '../components/Navbar';

function PasswordStrength({ password }) {
  const checks = [
    { label: '8+ chars', ok: password.length >= 8 },
    { label: 'Uppercase', ok: /[A-Z]/.test(password) },
    { label: 'Lowercase', ok: /[a-z]/.test(password) },
    { label: 'Number', ok: /\d/.test(password) },
    { label: 'Special char', ok: /[@$!%*?&]/.test(password) },
  ];
  const score = checks.filter(c => c.ok).length;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
  const colors = ['', 'bg-danger', 'bg-warning', 'bg-warning', 'bg-success', 'bg-success'];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {checks.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i < score ? colors[score] : 'bg-hairline'}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {checks.map(c => (
          <span key={c.label} className={`text-[10px] font-mono flex items-center gap-0.5 ${c.ok ? 'text-success' : 'text-ink-muted'}`}>
            {c.ok ? '✓' : '○'} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', department: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      toast.success('Account created! Please log in.');
      navigate('/login');
    } catch (err) {
      const data = err.response?.data;
      if (data?.fieldErrors) {
        setError(Object.values(data.fieldErrors).join(' • '));
      } else {
        setError(data?.message || 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper">
      <Navbar />
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="page-header text-center">
          <p className="font-mono text-xs text-accent tracking-widest uppercase mb-3">Student Registration</p>
          <h1 className="font-display text-4xl text-ink font-light">Create Account</h1>
          <p className="text-ink-muted text-sm mt-2">Accounts are created as <strong>Student</strong> by default.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-8">
          <div>
            <label className="field-label">Full Name</label>
            <input type="text" className="field-input" placeholder="Alice Johnson"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label className="field-label">Email Address</label>
            <input type="email" className="field-input" placeholder="alice@academiax.edu"
              value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div>
            <label className="field-label">Department</label>
            <select className="field-input" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} required>
              <option value="">Select department…</option>
              {['Computer Science', 'Mathematics', 'Physics', 'Electrical Engineering', 'Mechanical Engineering', 'Chemistry', 'Biology', 'Economics'].map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Password</label>
            <input type="password" className="field-input" placeholder="Min. 8 chars with upper, lower, number, special"
              value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
            <PasswordStrength password={form.password} />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-sm text-sm text-danger">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-ink-muted mt-6">
          Already registered?{' '}
          <Link to="/login" className="text-accent hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
