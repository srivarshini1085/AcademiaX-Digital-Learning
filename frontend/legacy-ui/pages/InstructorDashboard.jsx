import { Link } from 'react-router-dom';
import { FaChartBar, FaPlus, FaUsers } from 'react-icons/fa';

const courses = [
  { title: 'Product Leadership Lab', learners: '730', revenue: '$9.2k' },
  { title: 'Modern Java for Teams', learners: '540', revenue: '$7.1k' },
  { title: 'AI Product Design', learners: '420', revenue: '$5.8k' },
];

export default function InstructorDashboard() {
  return (
    <div className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Instructor</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Performance dashboard</h1>
          </div>
          <Link to="/instructor/courses/create" className="btn-primary gap-2">
            <FaPlus /> New course
          </Link>
        </div>

        <section className="grid gap-6 md:grid-cols-3">
          {[
            { label: 'Students', value: '2.3k', icon: <FaUsers /> },
            { label: 'Revenue', value: '$18.4k', icon: <FaChartBar /> },
            { label: 'Avg rating', value: '4.9/5', icon: <FaChartBar /> },
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
          <h2 className="mb-5 text-2xl font-bold text-slate-900">Your courses</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {courses.map((course) => (
              <div key={course.title} className="card p-5">
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Course</div>
                <h3 className="mt-3 text-xl font-bold text-slate-900">{course.title}</h3>
                <div className="mt-5 space-y-2 text-sm text-slate-600">
                  <div className="flex justify-between"><span>Learners</span><span>{course.learners}</span></div>
                  <div className="flex justify-between"><span>Revenue</span><span>{course.revenue}</span></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
