import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { courseApi, enrollmentApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { ArrowLeft, Clock, BookOpen, Users, DollarSign, CalendarDays, AlertTriangle } from 'lucide-react';
import SeatMap from '../components/SeatMap';
import Navbar from '../components/Navbar';
import SkeletonLoader from '../components/SkeletonLoader';

export default function CourseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [enrolling, setEnrolling] = useState(false);
  const [waitlisting, setWaitlisting] = useState(false);

  const { data: course, isLoading, isError } = useQuery({
    queryKey: ['course', id],
    queryFn: () => courseApi.get(id).then(r => r.data),
  });

  const deadlinePassed = course?.enrollmentDeadline && new Date(course.enrollmentDeadline) < new Date();
  const isFull = course?.availableSeats === 0;

  const handleEnroll = async () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    setEnrolling(true);
    try {
      const { data } = await enrollmentApi.hold({ courseId: Number(id) });
      toast.success('Seat held for 10 minutes! Complete payment to confirm.');
      navigate('/student/enrollments');
    } catch (err) {
      const msg = err.response?.data?.message || 'Enrollment failed';
      toast.error(msg);
    } finally {
      setEnrolling(false);
    }
  };

  const handleWaitlist = async () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    setWaitlisting(true);
    try {
      await enrollmentApi.waitlist(Number(id));
      toast.success('Added to waitlist! You\'ll be notified when a seat opens.');
      navigate('/student/enrollments');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Waitlist failed');
    } finally {
      setWaitlisting(false);
    }
  };

  if (isLoading) return <div className="min-h-screen bg-paper"><Navbar /><div className="max-w-4xl mx-auto px-4 py-10"><SkeletonLoader rows={6} type="text" /></div></div>;
  if (isError || !course) return <div className="min-h-screen bg-paper"><Navbar /><div className="max-w-4xl mx-auto px-4 py-16 text-center"><p className="font-display text-2xl text-ink-muted">Course not found</p></div></div>;

  return (
    <div className="min-h-screen bg-paper">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Back */}
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink mb-6 transition-colors">
          <ArrowLeft size={14} /> Back to catalogue
        </button>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Main */}
          <div className="md:col-span-2">
            <div className="page-header">
              <p className="mono-badge text-accent mb-2">{course.code}</p>
              <h1 className="font-display text-3xl text-ink font-light leading-tight">{course.title}</h1>
              <p className="text-ink-muted text-sm mt-1">{course.department} · {course.level}</p>
            </div>

            <p className="text-ink-light leading-relaxed mb-6">{course.description}</p>

            {/* Meta grid */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              {[
                { icon: BookOpen, label: 'Credits', value: `${course.credits} credit hours` },
                { icon: DollarSign, label: 'Tuition', value: `₹${Number(course.tuitionFee).toLocaleString('en-IN')}` },
                { icon: CalendarDays, label: 'Semester', value: course.semester },
                { icon: Clock, label: 'Enrolment deadline', value: course.enrollmentDeadline ? new Date(course.enrollmentDeadline).toLocaleDateString('en-IN') : '—' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-2 p-3 border border-hairline rounded-sm bg-surface">
                  <Icon size={14} className="text-accent mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-ink-muted uppercase tracking-wide">{label}</p>
                    <p className="font-mono text-sm text-ink mt-0.5">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Seat map */}
            <div className="border border-hairline rounded-sm p-5 bg-surface">
              <h2 className="font-display text-lg text-ink mb-4">Seat Map</h2>
              <SeatMap total={course.totalSeats} available={course.availableSeats} />
              <div className="flex items-center gap-4 mt-3 text-[10px] font-mono text-ink-muted">
                <span className="flex items-center gap-1"><span className="seat-dot taken inline-block" /> Taken</span>
                <span className="flex items-center gap-1"><span className="seat-dot free inline-block" /> Available</span>
                <span className="flex items-center gap-1"><span className="seat-dot mine inline-block" /> Your seat</span>
              </div>
            </div>
          </div>

          {/* Sidebar — enrol card */}
          <div>
            <div className="index-card sticky top-20">
              <p className="font-mono text-2xl font-medium text-ink mb-1">₹{Number(course.tuitionFee).toLocaleString('en-IN')}</p>
              <p className="text-xs text-ink-muted mb-4">per semester · {course.credits} credit hours</p>
              <div className="rule" />

              {deadlinePassed ? (
                <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-sm text-xs text-amber-700">
                  <AlertTriangle size={12} /> Enrollment deadline has passed
                </div>
              ) : !isAuthenticated ? (
                <button onClick={() => navigate('/login')} className="btn-primary w-full justify-center">
                  Log in to Enrol
                </button>
              ) : isFull ? (
                <button onClick={handleWaitlist} disabled={waitlisting} className="btn-ghost w-full justify-center">
                  {waitlisting ? 'Joining waitlist…' : 'Join Waitlist'}
                </button>
              ) : (
                <button onClick={handleEnroll} disabled={enrolling} className="btn-primary w-full justify-center">
                  {enrolling ? 'Holding seat…' : 'Hold a Seat'}
                </button>
              )}

              <p className="text-xs text-ink-muted text-center mt-3">
                {isFull ? 'You\'ll be auto-promoted when a seat opens.' : 'Seat held for 10 min. Complete payment to confirm.'}
              </p>

              <div className="rule" />
              <div className="space-y-1.5 text-xs text-ink-muted">
                <div className="flex justify-between"><span>Available</span><span className="font-mono text-ink">{course.availableSeats}/{course.totalSeats}</span></div>
                <div className="flex justify-between"><span>Academic Year</span><span className="font-mono text-ink">{course.academicYear}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

