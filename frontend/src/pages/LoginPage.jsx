import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useAuth, homeFor } from '../context/AuthContext';
import { errorMessage } from '../lib/api';
import { Field } from '../components/ui';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

const DEMO = [
  ['Student', 'student1@academiax.edu', 'Student@123'],
  ['Instructor', 'instructor1@academiax.edu', 'Instr@123'],
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState(null);
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async values => {
    setServerError(null);
    try {
      const user = await login(values);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
      navigate(location.state?.from || homeFor(user.role), { replace: true });
    } catch (error) {
      setServerError(error.response?.status === 423
        ? 'This account is locked after 5 failed attempts. Try again in 15 minutes.'
        : errorMessage(error, 'Email or password is incorrect.'));
    }
  };

  return (
    <div className="mx-auto grid max-w-4xl gap-10 md:grid-cols-[1fr_1.1fr] md:items-start">
      <div className="animate-fade">
        <p className="eyebrow mb-3">Registrar's desk</p>
        <h1 className="text-4xl leading-tight">Sign in to manage your enrollment.</h1>
        <p className="mt-4 text-sm text-ink-soft">Sessions last 15 minutes and renew quietly in the background for up to 7 days. Five wrong passwords lock the account for 15 minutes.</p>
        <div className="mt-8 border-t border-dashed border-rule pt-4">
          <p className="eyebrow mb-2">Demo accounts</p>
          <ul className="space-y-1 text-sm">
            {DEMO.map(([role, email, password]) => (
              <li key={email}>
                <button type="button" className="text-left text-ink-soft hover:text-accent"
                  onClick={() => { setValue('email', email); setValue('password', password); }}>
                  <span className="inline-block w-24 text-ink">{role}</span><span className="font-mono text-xs">{email}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-muted">The admin account is created from <span className="font-mono">ADMIN_EMAIL</span> / <span className="font-mono">ADMIN_PASSWORD</span> in <span className="font-mono">.env</span>.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5 p-6 sm:p-8" noValidate>
        <Field label="Email" id="email" error={errors.email?.message}>
          <input id="email" type="email" autoComplete="email" className="field-input" aria-invalid={!!errors.email} {...register('email')} />
        </Field>
        <Field label="Password" id="password" error={errors.password?.message}>
          <input id="password" type="password" autoComplete="current-password" className="field-input" aria-invalid={!!errors.password} {...register('password')} />
        </Field>
        {serverError && <p role="alert" className="border-l-2 border-bad bg-bad/5 px-3 py-2 text-sm text-bad">{serverError}</p>}
        <button className="btn-primary w-full" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign in'}</button>
        <p className="text-center text-sm text-ink-soft">New student? <Link to="/register" className="text-accent hover:underline">Create an account</Link></p>
      </form>
    </div>
  );
}
