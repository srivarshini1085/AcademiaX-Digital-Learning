import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';
import { authApi, errorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Field } from '../components/ui';

// Mirrors the backend policy in RegisterRequest; the server enforces it regardless.
const RULES = [
  ['At least 8 characters', p => p.length >= 8],
  ['An uppercase letter', p => /[A-Z]/.test(p)],
  ['A lowercase letter', p => /[a-z]/.test(p)],
  ['A number', p => /\d/.test(p)],
  ['A symbol (@$!%*?&)', p => /[@$!%*?&]/.test(p)],
];

export const DEPARTMENTS = ['Computer Science', 'Mathematics', 'Physics', 'Electrical Engineering', 'Economics', 'Humanities'];

const schema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(100),
  email: z.string().email('Enter a valid email address'),
  department: z.string().min(1, 'Choose your department'),
  password: z.string().refine(p => RULES.every(([, test]) => test(p)), 'Password does not meet every rule below'),
  confirm: z.string(),
}).refine(v => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

export default function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [serverError, setServerError] = useState(null);
  const { register, handleSubmit, watch, setError, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema), defaultValues: { department: '' } });
  const password = watch('password') || '';

  const onSubmit = async ({ confirm, ...values }) => {
    setServerError(null);
    try {
      await authApi.register(values);
      await login({ email: values.email, password: values.password });
      toast.success('Account created. Welcome to AcademiaX.');
      navigate('/courses');
    } catch (error) {
      const fieldErrors = error.response?.data?.fieldErrors;
      if (fieldErrors) Object.entries(fieldErrors).forEach(([field, message]) => setError(field, { message }));
      else setServerError(errorMessage(error));
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <p className="eyebrow mb-3">Admissions</p>
      <h1 className="text-4xl">Create a student account</h1>
      <p className="mt-3 text-sm text-ink-soft">Public sign-up is for students only. Instructor accounts are issued by the registrar.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="card mt-8 grid gap-5 p-6 sm:grid-cols-2 sm:p-8" noValidate>
        <div className="sm:col-span-2">
          <Field label="Full name" id="name" error={errors.name?.message}>
            <input id="name" autoComplete="name" className="field-input" {...register('name')} />
          </Field>
        </div>
        <Field label="University email" id="email" error={errors.email?.message}>
          <input id="email" type="email" autoComplete="email" className="field-input" {...register('email')} />
        </Field>
        <Field label="Department" id="department" error={errors.department?.message}>
          <select id="department" className="field-input" {...register('department')}>
            <option value="" disabled>Choose…</option>
            {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Password" id="password" error={errors.password?.message}>
          <input id="password" type="password" autoComplete="new-password" className="field-input" {...register('password')} />
        </Field>
        <Field label="Confirm password" id="confirm" error={errors.confirm?.message}>
          <input id="confirm" type="password" autoComplete="new-password" className="field-input" {...register('confirm')} />
        </Field>
        <ul className="grid gap-1 text-xs sm:col-span-2 sm:grid-cols-2" aria-label="Password rules">
          {RULES.map(([label, test]) => {
            const ok = test(password);
            return (
              <li key={label} className={`flex items-center gap-1.5 ${ok ? 'text-good' : 'text-ink-muted'}`}>
                {ok ? <Check size={13} /> : <X size={13} />}{label}
              </li>
            );
          })}
        </ul>
        {serverError && <p role="alert" className="border-l-2 border-bad bg-bad/5 px-3 py-2 text-sm text-bad sm:col-span-2">{serverError}</p>}
        <button className="btn-primary sm:col-span-2" disabled={isSubmitting}>{isSubmitting ? 'Creating account…' : 'Create account'}</button>
        <p className="text-center text-sm text-ink-soft sm:col-span-2">Already enrolled? <Link to="/login" className="text-accent hover:underline">Sign in</Link></p>
      </form>
    </div>
  );
}
