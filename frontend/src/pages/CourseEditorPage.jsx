import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { courseApi, errorMessage } from '../lib/api';
import { useInstructors } from '../lib/hooks';
import { useAuth, homeFor } from '../context/AuthContext';
import { DEPARTMENTS } from './RegisterPage';
import { ErrorState, Field, PageHeader, Skeleton } from '../components/ui';

const schema = z.object({
  code: z.string().trim().min(2, '2–20 characters').max(20, '2–20 characters'),
  title: z.string().trim().min(3, 'At least 3 characters').max(255),
  description: z.string().trim().min(1, 'Add a short description'),
  department: z.string().min(1, 'Choose a department'),
  level: z.string().min(1),
  semester: z.string().trim().min(1, 'Required'),
  academicYear: z.string().regex(/^\d{4}-\d{2}$/, 'Use YYYY-YY, e.g. 2026-27'),
  credits: z.coerce.number().int().min(1, '1–12').max(12, '1–12'),
  totalSeats: z.coerce.number().int().min(1, 'At least 1 seat'),
  tuitionFee: z.coerce.number().min(0, 'Cannot be negative'),
  enrollmentDeadline: z.string().min(1, 'Required'),
  instructorId: z.coerce.number().optional(),
});

const EMPTY = { code: '', title: '', description: '', department: '', level: 'UNDERGRADUATE', semester: 'Fall 2026', academicYear: '2026-27', credits: 3, totalSeats: 30, tuitionFee: 2000, enrollmentDeadline: '' };

export default function CourseEditorPage() {
  const { id } = useParams();
  const editing = !!id;
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const instructors = useInstructors();

  const existing = useQuery({ queryKey: ['course', Number(id)], queryFn: async () => (await courseApi.get(id)).data, enabled: editing });
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema), defaultValues: EMPTY });

  useEffect(() => {
    if (existing.data) reset({ ...existing.data, level: (existing.data.level || 'UNDERGRADUATE').toUpperCase(), enrollmentDeadline: existing.data.enrollmentDeadline?.slice(0, 16) });
  }, [existing.data, reset]);

  const save = useMutation({
    mutationFn: values => {
      const body = { ...values, enrollmentDeadline: values.enrollmentDeadline.length === 16 ? `${values.enrollmentDeadline}:00` : values.enrollmentDeadline };
      if (user.role !== 'ADMIN') delete body.instructorId;
      return editing ? courseApi.update(id, body) : courseApi.create(body);
    },
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['course', data.id] });
      toast.success(editing ? 'Course updated.' : `${data.code} added to the catalogue.`);
      navigate(`/courses/${data.id}`);
    },
    onError: error => {
      const fieldErrors = error.response?.data?.fieldErrors;
      if (fieldErrors) Object.entries(fieldErrors).forEach(([f, m]) => setError(f, { message: m }));
      else toast.error(errorMessage(error));
    },
  });

  if (editing && existing.isLoading) return <Skeleton className="h-96" />;
  if (editing && existing.isError) return <ErrorState error={existing.error} onRetry={existing.refetch} />;

  const input = (name, label, props = {}) => (
    <Field label={label} id={name} error={errors[name]?.message}>
      <input id={name} className="field-input" aria-invalid={!!errors[name]} {...props} {...register(name)} />
    </Field>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow={editing ? `Editing ${existing.data?.code}` : 'New listing'} title={editing ? 'Edit course' : 'Add a course to the catalogue'}>
        {editing && 'Reducing seats below the number already enrolled is refused by the server.'}
      </PageHeader>
      <form onSubmit={handleSubmit(v => save.mutate(v))} className="card grid gap-5 p-6 sm:grid-cols-6 sm:p-8" noValidate>
        <div className="sm:col-span-2">{input('code', 'Course code', { className: 'field-input font-mono uppercase' })}</div>
        <div className="sm:col-span-4">{input('title', 'Title')}</div>
        <div className="sm:col-span-6">
          <Field label="Description" id="description" error={errors.description?.message}>
            <textarea id="description" rows={4} className="field-input" {...register('description')} />
          </Field>
        </div>
        <div className="sm:col-span-3">
          <Field label="Department" id="department" error={errors.department?.message}>
            <select id="department" className="field-input" {...register('department')}>
              <option value="" disabled>Choose…</option>
              {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
            </select>
          </Field>
        </div>
        <div className="sm:col-span-3">
          <Field label="Level" id="level" error={errors.level?.message}>
            <select id="level" className="field-input" {...register('level')}><option value="UNDERGRADUATE">Undergraduate</option><option value="GRADUATE">Graduate</option></select>
          </Field>
        </div>
        <div className="sm:col-span-3">{input('semester', 'Semester')}</div>
        <div className="sm:col-span-3">{input('academicYear', 'Academic year')}</div>
        <div className="sm:col-span-2">{input('credits', 'Credits', { type: 'number', min: 1, max: 12 })}</div>
        <div className="sm:col-span-2">{input('totalSeats', 'Total seats', { type: 'number', min: 1 })}</div>
        <div className="sm:col-span-2">{input('tuitionFee', 'Tuition (₹)', { type: 'number', min: 0, step: 50 })}</div>
        <div className="sm:col-span-3">{input('enrollmentDeadline', 'Enrollment deadline', { type: 'datetime-local' })}</div>
        {user.role === 'ADMIN' && (
          <div className="sm:col-span-3">
            <Field label="Instructor" id="instructorId" error={errors.instructorId?.message}>
              <select id="instructorId" className="field-input" {...register('instructorId')}>
                {[...(instructors.data?.values() || [])].map(i => <option key={i.id} value={i.id}>{i.name} · {i.department}</option>)}
              </select>
            </Field>
          </div>
        )}
        <div className="flex justify-end gap-2 sm:col-span-6">
          <Link to={editing ? `/courses/${id}` : homeFor(user.role)} className="btn-quiet">Cancel</Link>
          <button className="btn-primary" disabled={isSubmitting || save.isPending}>{save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Publish course'}</button>
        </div>
      </form>
    </div>
  );
}
