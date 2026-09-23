const users = [
  { name: 'Hannah Lee', email: 'hannah@academiax.io', role: 'Instructor' },
  { name: 'Aarav Shah', email: 'aarav@academiax.io', role: 'Student' },
  { name: 'Nicole Tran', email: 'nicole@academiax.io', role: 'Admin' },
];

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Administration</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Platform overview</h1>
        </div>

        <section className="grid gap-6 md:grid-cols-3">
          {[
            { label: 'Total users', value: '18.7k' },
            { label: 'Active courses', value: '340' },
            { label: 'Monthly revenue', value: '$124k' },
          ].map((stat) => (
            <div key={stat.label} className="card p-5">
              <div className="text-sm text-slate-500">{stat.label}</div>
              <div className="mt-2 text-3xl font-bold text-slate-900">{stat.value}</div>
            </div>
          ))}
        </section>

        <section className="mt-10 card overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 text-lg font-bold text-slate-900">Users</div>
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-white text-sm text-slate-600">
              <tr>
                <th className="px-6 py-4 font-medium">Name</th>
                <th className="px-6 py-4 font-medium">Email</th>
                <th className="px-6 py-4 font-medium">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {users.map((user) => (
                <tr key={user.email}>
                  <td className="px-6 py-4 font-medium text-slate-900">{user.name}</td>
                  <td className="px-6 py-4 text-slate-600">{user.email}</td>
                  <td className="px-6 py-4"><span className="badge bg-slate-100 text-slate-700">{user.role}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
