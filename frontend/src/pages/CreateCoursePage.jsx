export default function CreateCoursePage() {
  return (
    <div className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Instructor</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Create a new course</h1>
        </div>

        <div className="card p-8">
          <form className="space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Course title</label>
              <input className="input-field" placeholder="e.g. Advanced Product Analytics" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
              <textarea className="input-field min-h-32" placeholder="Describe the learning outcomes and curriculum" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
                <input className="input-field" placeholder="Business" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Price</label>
                <input className="input-field" placeholder="$129" />
              </div>
            </div>
            <button type="button" className="btn-primary">Publish course</button>
          </form>
        </div>
      </div>
    </div>
  );
}
