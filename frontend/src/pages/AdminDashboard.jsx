import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { authApi, courseApi, enrollmentApi, errorMessage, paymentApi } from '../lib/api';
import { useDirectory, useInstructors } from '../lib/hooks';
import { STATUS_LABEL, formatDate, formatMoney } from '../lib/format';
import { DEPARTMENTS } from './RegisterPage';
import { ErrorState, Field, Modal, PageHeader, Pagination, Skeleton, Stat, StatusPill } from '../components/ui';

const TABS = [['overview', 'Overview'], ['users', 'Users'], ['courses', 'Courses'], ['enrollments', 'Enrollments'], ['payments', 'Payments']];

function usePaged(key, fetcher, filters) {
  return useQuery({ queryKey: [key, 'admin', filters], queryFn: async () => (await fetcher({ ...filters, size: 10 })).data, placeholderData: keepPreviousData });
}

function StatusTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return <div className="card px-3 py-2 text-xs shadow-md">{payload[0].payload.label}: <span className="font-mono">{payload[0].value}</span></div>;
}

function Overview() {
  const users = useQuery({ queryKey: ['stats', 'users'], queryFn: async () => (await authApi.userStats()).data });
  const enr = useQuery({ queryKey: ['stats', 'enrollments'], queryFn: async () => (await enrollmentApi.stats()).data });
  const pay = useQuery({ queryKey: ['stats', 'payments'], queryFn: async () => (await paymentApi.stats()).data });
  const courses = useQuery({ queryKey: ['courses', 'all'], queryFn: async () => (await courseApi.list({ size: 200 })).data.content });

  if ([users, enr, pay, courses].some(q => q.isLoading)) return <Skeleton className="h-72" />;
  const failed = [users, enr, pay, courses].find(q => q.isError);
  if (failed) return <ErrorState error={failed.error} onRetry={failed.refetch} />;

  const seats = courses.data.reduce((s, c) => s + c.totalSeats, 0);
  const taken = courses.data.reduce((s, c) => s + c.totalSeats - c.availableSeats, 0);
  const statusData = [
    ['CONFIRMED', enr.data.totalConfirmed], ['SEAT_HELD', enr.data.totalHeld], ['WAITLISTED', enr.data.totalWaitlisted],
    ['EXPIRED', enr.data.totalExpired], ['CANCELLED', enr.data.totalCancelled],
  ].map(([status, value]) => ({ label: STATUS_LABEL[status], value }));

  return (
    <div className="space-y-10">
      <section className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Stat label="Students" value={users.data.totalStudents} note={`${users.data.totalInstructors} instructors`} />
        <Stat label="Confirmed enrollments" value={enr.data.totalConfirmed} note={`${enr.data.totalHeld} holds in progress`} />
        <Stat label="Tuition collected" value={formatMoney(pay.data.totalRevenue)} note={`${pay.data.successfulPayments} payments`} />
        <Stat label="Seat utilisation" value={`${seats ? Math.round((taken / seats) * 100) : 0}%`} note={`${taken} of ${seats} seats`} />
      </section>
      <section className="grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-xl">Enrollments by status</h2>
          <div className="card h-60 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} layout="vertical" margin={{ left: 24, right: 24 }}>
                <XAxis type="number" hide domain={[0, Math.max(1, ...statusData.map(d => d.value))]} />
                <YAxis type="category" dataKey="label" width={96} tick={{ fontSize: 12, fill: 'rgb(var(--ink-soft))' }} axisLine={false} tickLine={false} />
                <Tooltip content={<StatusTooltip />} cursor={{ fill: 'rgb(var(--sunken))' }} />
                <Bar dataKey="value" fill="rgb(var(--accent))" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false}>
                  <LabelList dataKey="value" position="right" style={{ fontSize: 11, fontFamily: 'IBM Plex Mono', fill: 'rgb(var(--ink-soft))' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <h2 className="mb-3 text-xl">Payments</h2>
          <dl className="card divide-y divide-rule px-5">
            {[['Successful', pay.data.successfulPayments], ['Declined', pay.data.failedPayments], ['Refunded', pay.data.refundedPayments], ['All transactions', pay.data.totalTransactions]].map(([k, v]) => (
              <div key={k} className="flex justify-between py-3 text-sm"><dt className="text-ink-soft">{k}</dt><dd className="font-mono">{v}</dd></div>
            ))}
          </dl>
        </div>
      </section>
    </div>
  );
}

const instructorSchema = z.object({
  name: z.string().trim().min(2, 'Required'),
  email: z.string().email('Valid email required'),
  department: z.string().min(1, 'Required'),
  password: z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, '8+ chars with upper, lower, number and symbol'),
});

function Users() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ page: 0, keyword: '', roleFilter: '' });
  const [creating, setCreating] = useState(false);
  const users = usePaged('users', p => authApi.users({ ...p, keyword: p.keyword || undefined, roleFilter: p.roleFilter || undefined }), filters);
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(instructorSchema), defaultValues: { department: '' } });

  const toggle = useMutation({
    mutationFn: u => authApi.setUserActive(u.id, !u.active),
    onSuccess: ({ data }) => { toast.success(`${data.name} ${data.active ? 'reactivated' : 'deactivated'}.`); queryClient.invalidateQueries({ queryKey: ['users'] }); },
    onError: e => toast.error(errorMessage(e)),
  });
  const create = useMutation({
    mutationFn: authApi.createInstructor,
    onSuccess: ({ data }) => { toast.success(`Instructor account created for ${data.name}.`); setCreating(false); reset(); queryClient.invalidateQueries({ queryKey: ['users'] }); queryClient.invalidateQueries({ queryKey: ['instructors'] }); },
    onError: e => toast.error(errorMessage(e)),
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="min-w-[200px] flex-1"><span className="field-label">Search</span>
          <input className="field-input" placeholder="Name or email" value={filters.keyword} onChange={e => setFilters({ ...filters, keyword: e.target.value, page: 0 })} /></label>
        <label><span className="field-label">Role</span>
          <select className="field-input" value={filters.roleFilter} onChange={e => setFilters({ ...filters, roleFilter: e.target.value, page: 0 })}>
            <option value="">All</option><option>STUDENT</option><option>INSTRUCTOR</option><option>ADMIN</option>
          </select></label>
        <button className="btn-primary" onClick={() => setCreating(true)}>New instructor</button>
      </div>
      {users.isError ? <ErrorState error={users.error} onRetry={users.refetch} /> : (
        <div className="overflow-x-auto">
          <table className="table-ledger min-w-[640px]">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Status</th><th /></tr></thead>
            <tbody>
              {users.data?.content.map(u => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td className="font-mono text-xs">{u.email}</td>
                  <td className="font-mono text-xs">{u.role}</td>
                  <td className="text-ink-soft">{u.department}</td>
                  <td className="text-xs">{u.active ? <span className="text-good">Active</span> : <span className="text-bad">Deactivated</span>}{u.lockoutUntil && new Date(u.lockoutUntil) > new Date() && <span className="ml-1 text-warn">· locked</span>}</td>
                  <td className="text-right">{u.role !== 'ADMIN' && <button className="btn-quiet btn-sm" disabled={toggle.isPending} onClick={() => toggle.mutate(u)}>{u.active ? 'Deactivate' : 'Reactivate'}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={filters.page} totalPages={users.data?.totalPages} onChange={page => setFilters({ ...filters, page })} />

      <Modal open={creating} title="New instructor account" onClose={() => setCreating(false)}>
        <form onSubmit={handleSubmit(v => create.mutate(v))} className="space-y-4" noValidate>
          <Field label="Full name" id="i-name" error={errors.name?.message}><input id="i-name" className="field-input" {...register('name')} /></Field>
          <Field label="Email" id="i-email" error={errors.email?.message}><input id="i-email" type="email" className="field-input" {...register('email')} /></Field>
          <Field label="Department" id="i-dept" error={errors.department?.message}>
            <select id="i-dept" className="field-input" {...register('department')}><option value="" disabled>Choose…</option>{DEPARTMENTS.map(d => <option key={d}>{d}</option>)}</select>
          </Field>
          <Field label="Temporary password" id="i-pass" error={errors.password?.message}><input id="i-pass" type="text" className="field-input font-mono" {...register('password')} /></Field>
          <div className="flex justify-end gap-2"><button type="button" className="btn-quiet" onClick={() => setCreating(false)}>Cancel</button><button className="btn-primary" disabled={create.isPending}>Create</button></div>
        </form>
      </Modal>
    </div>
  );
}

function Courses() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ page: 0, keyword: '' });
  const instructors = useInstructors();
  const courses = usePaged('courses', p => courseApi.list({ ...p, keyword: p.keyword || undefined, sort: 'code,asc' }), filters);
  const [deleting, setDeleting] = useState(null);
  const remove = useMutation({
    mutationFn: c => courseApi.remove(c.id),
    onSuccess: () => { toast.success('Course withdrawn from the catalogue.'); queryClient.invalidateQueries({ queryKey: ['courses'] }); },
    onError: e => toast.error(errorMessage(e)),
    onSettled: () => setDeleting(null),
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="min-w-[200px] flex-1"><span className="field-label">Search</span>
          <input className="field-input" placeholder="Title or code" value={filters.keyword} onChange={e => setFilters({ keyword: e.target.value, page: 0 })} /></label>
        <Link to="/courses/new" className="btn-primary">New course</Link>
      </div>
      {courses.isError ? <ErrorState error={courses.error} onRetry={courses.refetch} /> : (
        <div className="overflow-x-auto">
          <table className="table-ledger min-w-[720px]">
            <thead><tr><th>Code</th><th>Title</th><th>Instructor</th><th className="text-right">Seats</th><th className="text-right">Tuition</th><th>Deadline</th><th /></tr></thead>
            <tbody>
              {courses.data?.content.map(c => (
                <tr key={c.id}>
                  <td className="font-mono text-accent"><Link to={`/courses/${c.id}`}>{c.code}</Link></td>
                  <td>{c.title}</td>
                  <td className="text-ink-soft">{instructors.data?.get(c.instructorId)?.name || `#${c.instructorId}`}</td>
                  <td className="text-right font-mono">{c.totalSeats - c.availableSeats}/{c.totalSeats}</td>
                  <td className="text-right font-mono">{formatMoney(c.tuitionFee)}</td>
                  <td className="font-mono text-xs text-ink-muted">{formatDate(c.enrollmentDeadline)}</td>
                  <td className="whitespace-nowrap text-right">
                    <Link to={`/courses/${c.id}/edit`} className="btn-quiet btn-sm">Edit</Link>
                    <button className="btn-quiet btn-sm text-bad" onClick={() => setDeleting(c)}>Withdraw</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={filters.page} totalPages={courses.data?.totalPages} onChange={page => setFilters({ ...filters, page })} />
      <Modal open={!!deleting} title={`Withdraw ${deleting?.code}?`} onClose={() => setDeleting(null)}>
        <p className="text-sm text-ink-soft">The course is soft-deleted and disappears from the catalogue. The server refuses this while students hold or have confirmed seats.</p>
        <div className="mt-6 flex justify-end gap-2"><button className="btn-quiet" onClick={() => setDeleting(null)}>Keep</button>
          <button className="btn-danger" disabled={remove.isPending} onClick={() => remove.mutate(deleting)}>Withdraw course</button></div>
      </Modal>
    </div>
  );
}

function Enrollments() {
  const [filters, setFilters] = useState({ page: 0, status: '' });
  const list = usePaged('enrollments', p => enrollmentApi.search({ ...p, status: p.status || undefined }), filters);
  const people = useDirectory((list.data?.content || []).map(e => e.studentId), !!list.data);
  const courses = useQuery({ queryKey: ['courses', 'all'], queryFn: async () => (await courseApi.list({ size: 200 })).data.content });
  const codeOf = id => courses.data?.find(c => c.id === id)?.code || `#${id}`;

  return (
    <div>
      <label className="mb-4 inline-block"><span className="field-label">Status</span>
        <select className="field-input" value={filters.status} onChange={e => setFilters({ status: e.target.value, page: 0 })}>
          <option value="">All</option>{['SEAT_HELD', 'CONFIRMED', 'WAITLISTED', 'PAYMENT_FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED'].map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select></label>
      {list.isError ? <ErrorState error={list.error} onRetry={list.refetch} /> : (
        <div className="overflow-x-auto">
          <table className="table-ledger min-w-[640px]">
            <thead><tr><th>ID</th><th>Student</th><th>Course</th><th>Status</th><th className="text-right">Tuition</th><th>Updated</th></tr></thead>
            <tbody>
              {list.data?.content.map(e => (
                <tr key={e.id}>
                  <td className="font-mono text-xs">E-{String(e.id).padStart(6, '0')}</td>
                  <td>{people.data?.get(e.studentId)?.name || `#${e.studentId}`}</td>
                  <td className="font-mono text-accent"><Link to={`/courses/${e.courseId}`}>{codeOf(e.courseId)}</Link></td>
                  <td><StatusPill status={e.status} /></td>
                  <td className="text-right font-mono">{formatMoney(e.tuitionFee)}</td>
                  <td className="font-mono text-xs text-ink-muted">{formatDate(e.updatedAt, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={filters.page} totalPages={list.data?.totalPages} onChange={page => setFilters({ ...filters, page })} />
    </div>
  );
}

function Payments() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ page: 0, status: '' });
  const list = usePaged('payments', p => paymentApi.search({ ...p, status: p.status || undefined }), filters);
  const people = useDirectory((list.data?.content || []).map(p => p.studentId), !!list.data);
  const refund = useMutation({
    mutationFn: p => paymentApi.refund(p.id),
    onSuccess: () => { toast.success('Refunded; the seat went back to the course.'); queryClient.invalidateQueries({ queryKey: ['payments'] }); queryClient.invalidateQueries({ queryKey: ['stats'] }); },
    onError: e => toast.error(errorMessage(e)),
  });

  return (
    <div>
      <label className="mb-4 inline-block"><span className="field-label">Status</span>
        <select className="field-input" value={filters.status} onChange={e => setFilters({ status: e.target.value, page: 0 })}>
          <option value="">All</option><option value="SUCCESS">Paid</option><option value="FAILED">Declined</option><option value="REFUNDED">Refunded</option>
        </select></label>
      {list.isError ? <ErrorState error={list.error} onRetry={list.refetch} /> : (
        <div className="overflow-x-auto">
          <table className="table-ledger min-w-[700px]">
            <thead><tr><th>Reference</th><th>Student</th><th className="text-right">Amount</th><th>Card</th><th>Status</th><th>Date</th><th /></tr></thead>
            <tbody>
              {list.data?.content.map(p => (
                <tr key={p.id}>
                  <td className="font-mono text-xs">{p.transactionRef}</td>
                  <td>{people.data?.get(p.studentId)?.name || `#${p.studentId}`}</td>
                  <td className="text-right font-mono">{formatMoney(p.amount, true)}</td>
                  <td className="font-mono text-xs">•••• {p.cardLast4}</td>
                  <td><StatusPill status={p.status} /></td>
                  <td className="font-mono text-xs text-ink-muted">{formatDate(p.createdAt, true)}</td>
                  <td className="text-right">{p.status === 'SUCCESS' && <button className="btn-quiet btn-sm" disabled={refund.isPending} onClick={() => refund.mutate(p)}>Refund</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={filters.page} totalPages={list.data?.totalPages} onChange={page => setFilters({ ...filters, page })} />
    </div>
  );
}

export default function AdminDashboard() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'overview';
  const Panel = { overview: Overview, users: Users, courses: Courses, enrollments: Enrollments, payments: Payments }[tab] || Overview;

  return (
    <div>
      <PageHeader eyebrow="Administration" title="Registrar's desk" actions={<Link to="/admin/console" className="btn-secondary">System console</Link>}>
        Accounts, the catalogue, enrollments and tuition across every student.
      </PageHeader>
      <div className="mb-8 flex gap-1 overflow-x-auto border-b border-rule" role="tablist">
        {TABS.map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setParams({ tab: key })}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm ${tab === key ? 'border-accent text-ink' : 'border-transparent text-ink-soft hover:text-ink'}`}>{label}</button>
        ))}
      </div>
      <Panel />
    </div>
  );
}
