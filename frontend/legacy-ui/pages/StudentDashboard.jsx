import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaBook, FaCreditCard, FaGraduationCap, FaSignOutAlt } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

const sampleCourses = [
  { id: 1, title: 'Data Science Foundations', category: 'Analytics', price: '$149', progress: 72 },
  { id: 2, title: 'Product Strategy Bootcamp', category: 'Business', price: '$119', progress: 42 },
  { id: 3, title: 'Full-Stack Java Development', category: 'Engineering', price: '$199', progress: 86 },
];

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const [courses, setCourses] = useState(sampleCourses);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await api.get('/courses');
        if (Array.isArray(response.data) && response.data.length > 0) {
          setCourses(response.data.map((course) => ({
            id: course.id,
            title: course.title,
            category: course.category || 'General',
            price: `$${course.price ?? 0}`,
            progress: course.progress ?? 25,
          })));
        }
      } catch (error) {
        console.warn('Could not fetch live courses. Using sample data instead.', error);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <div className="text-xl font-bold text-slate-900">AcademiaX</div>
            <div className="text-sm text-slate-500">Student portal</div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="font-semibold text-slate-800">{user?.firstName || 'Student'} {user?.lastName || ''}</div>
              <div className="text-xs text-slate-500">{user?.email || 'student@academiax.io'}</div>
            </div>
            <button onClick={logout} className="btn-secondary gap-2">
              <FaSignOutAlt /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <section className="grid gap-6 md:grid-cols-4">
          {[
            { label: 'Courses Enrolled', value: '12', icon: <FaBook /> },
            { label: 'Certificates', value: '04', icon: <FaGraduationCap /> },
            { label: 'Payments', value: '$580', icon: <FaCreditCard /> },
          ].map((stat) => (
            <div key={stat.label} className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-500">{stat.label}</div>
                  <div className="mt-2 text-3xl font-bold text-slate-900">{stat.value}</div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{stat.icon}</div>
              </div>
            </div>
          ))}
        </section>

        <section className="mt-10">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-900">Continue learning</h2>
            <Link to="/student/enrollments" className="text-sm font-semibold text-brand-700">View all</Link>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {courses.map((course) => (
              <div key={course.id} className="card p-5">
                <div className="flex items-center justify-between">
                  <span className="badge bg-brand-50 text-brand-700">{course.category}</span>
                  <span className="text-sm font-semibold text-slate-600">{course.price}</span>
                </div>
                <h3 className="mt-4 text-xl font-bold text-slate-900">{course.title}</h3>
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-sm text-slate-500">
                    <span>Progress</span>
                    <span>{course.progress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200">
                    <div className="h-2 rounded-full bg-brand-500" style={{ width: `${course.progress}%` }} />
                  </div>
                </div>
                <button className="btn-primary mt-5 w-full">Resume course</button>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
