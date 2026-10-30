import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';
import { authApi, errorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../lib/format';
import { DEPARTMENTS } from './RegisterPage';
import { ErrorState, Field, Modal, PageHeader, Skeleton } from '../components/ui';

const schema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(100),
  department: z.string().min(1, 'Required'),
});

/** Reads the refresh token's family id from its payload (not verified here; only used to label "this device"). */
function currentFamily() {
  try { return JSON.parse(atob(localStorage.getItem('refreshToken').split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).familyId; } catch { return null; }
}

export default function ProfilePage() {
  const { updateUser, clearSession } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmAll, setConfirmAll] = useState(false);

  const profile = useQuery({ queryKey: ['profile'], queryFn: async () => (await authApi.profile()).data });
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: async () => (await authApi.sessions()).data });
  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm({ resolver: zodResolver(schema) });
  useEffect(() => { if (profile.data) reset({ name: profile.data.name, department: profile.data.department }); }, [profile.data, reset]);

  const save = useMutation({
    mutationFn: authApi.updateProfile,
    onSuccess: ({ data }) => { updateUser({ name: data.name, department: data.department }); queryClient.setQueryData(['profile'], data); reset({ name: data.name, department: data.department }); toast.success('Profile saved.'); },
    onError: e => toast.error(errorMessage(e)),
  });
  const logoutAll = useMutation({
    mutationFn: authApi.logoutAll,
    onSuccess: () => { clearSession(); toast.success('Signed out on every device.'); navigate('/login'); },
    onError: e => toast.error(errorMessage(e)),
  });

  const family = currentFamily();
  const active = (sessions.data || []).filter(s => s.active);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Account" title="Profile & security" />
      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="mb-4 text-2xl">Profile</h2>
          {profile.isLoading ? <Skeleton className="h-60" /> : profile.isError ? <ErrorState error={profile.error} onRetry={profile.refetch} /> : (
            <form onSubmit={handleSubmit(v => save.mutate(v))} className="card space-y-4 p-6" noValidate>
              <dl className="grid grid-cols-2 gap-3 border-b border-dashed border-rule pb-4 text-sm">
                <div><dt className="eyebrow">Email</dt><dd className="mt-0.5 truncate font-mono text-xs">{profile.data.email}</dd></div>
                <div><dt className="eyebrow">Role</dt><dd className="mt-0.5 font-mono text-xs">{profile.data.role}</dd></div>
                <div><dt className="eyebrow">Member since</dt><dd className="mt-0.5 font-mono text-xs">{formatDate(profile.data.createdAt)}</dd></div>
                <div><dt className="eyebrow">User ID</dt><dd className="mt-0.5 font-mono text-xs">{profile.data.id}</dd></div>
              </dl>
              <Field label="Full name" id="name" error={errors.name?.message}><input id="name" className="field-input" {...register('name')} /></Field>
              <Field label="Department" id="department" error={errors.department?.message}>
                <select id="department" className="field-input" {...register('department')}>
                  {[...new Set([...DEPARTMENTS, profile.data.department])].filter(Boolean).map(d => <option key={d}>{d}</option>)}
                </select>
              </Field>
              <button className="btn-primary" disabled={!isDirty || save.isPending}>{save.isPending ? 'Saving…' : 'Save profile'}</button>
            </form>
          )}
        </section>

        <section>
          <h2 className="mb-1 flex items-center gap-2 text-2xl"><ShieldCheck size={20} className="text-accent" />Security</h2>
          <p className="mb-4 text-sm text-ink-soft">
            Each sign-in starts a session (a refresh-token family). Tokens rotate on every refresh; if an old token is ever replayed, the whole family is revoked.
          </p>
          {sessions.isLoading ? <Skeleton className="h-40" /> : sessions.isError ? <ErrorState error={sessions.error} onRetry={sessions.refetch} /> : (
            <div className="card">
              <ul className="divide-y divide-rule">
                {active.map(s => (
                  <li key={s.familyId} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="font-mono text-xs">{s.familyId.slice(0, 8)}…{s.familyId === family && <span className="ml-2 rounded-card bg-accent px-1.5 py-0.5 text-[10px] text-accent-on">this device</span>}</p>
                      <p className="text-xs text-ink-muted">Signed in {formatDate(s.createdAt, true)} · expires {formatDate(s.expiresAt)}</p>
                    </div>
                  </li>
                ))}
                {active.length === 0 && <li className="px-5 py-4 text-sm text-ink-muted">No active sessions.</li>}
              </ul>
              <div className="border-t border-rule p-4">
                <button className="btn-danger w-full" onClick={() => setConfirmAll(true)}>Log out all devices</button>
              </div>
            </div>
          )}
        </section>
      </div>

      <Modal open={confirmAll} title="Log out everywhere?" onClose={() => setConfirmAll(false)}>
        <p className="text-sm text-ink-soft">All {active.length} session{active.length === 1 ? '' : 's'}, including this one, will be revoked. Access tokens already issued expire within 15 minutes.</p>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-quiet" onClick={() => setConfirmAll(false)}>Cancel</button>
          <button className="btn-danger" disabled={logoutAll.isPending} onClick={() => logoutAll.mutate()}>Log out all devices</button>
        </div>
      </Modal>
    </div>
  );
}
