import { Link } from 'react-router-dom';

const enrollments = [
  { id: 101, course: 'Data Science Foundations', status: 'Active', progress: '72%' },
  { id: 102, course: 'Product Strategy Bootcamp', status: 'In review', progress: '46%' },
  { id: 103, course: 'Full-Stack Java Development', status: 'Completed', progress: '100%' },
];

export default function MyEnrollmentsPage() {
  return (
    <div className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Learning</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">My enrollments</h1>
          </div>
          <Link to="/student/dashboard" className="btn-secondary">Back to dashboard</Link>
        </div>

        <div className="card overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50 text-sm text-slate-600">
              <tr>
                <th className="px-6 py-4 font-medium">Course</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Progress</th>
                <th className="px-6 py-4 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {enrollments.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 font-medium text-slate-900">{item.course}</td>
                  <td className="px-6 py-4">
                    <span className="badge bg-emerald-100 text-emerald-700">{item.status}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{item.progress}</td>
                  <td className="px-6 py-4">
                    <Link to={`/student/payment/${item.id}`} className="text-sm font-semibold text-brand-700">Manage payment</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
