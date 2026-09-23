import { Link } from 'react-router-dom';
import { FaArrowRight, FaBookOpen, FaChartLine, FaShieldAlt } from 'react-icons/fa';

const featureCards = [
  {
    icon: <FaBookOpen className="text-2xl text-brand-600" />,
    title: 'Expert-led Learning',
    text: 'Explore practical courses, bootcamps, and career tracks designed for modern learners.',
  },
  {
    icon: <FaChartLine className="text-2xl text-brand-600" />,
    title: 'Progress Tracking',
    text: 'Follow learning milestones, assignments, and completion rates in a single dashboard.',
  },
  {
    icon: <FaShieldAlt className="text-2xl text-brand-600" />,
    title: 'Secure Access',
    text: 'Protected authentication and role-based access for every student, instructor, and admin.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">A</div>
          <div>
            <div className="text-xl font-bold text-slate-900">AcademiaX</div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Digital Learning</div>
          </div>
        </div>

        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
          <a href="#features">Features</a>
          <a href="#about">About</a>
          <a href="#pricing">Pricing</a>
        </nav>

        <div className="flex items-center gap-3">
          <Link to="/login" className="btn-secondary">Login</Link>
          <Link to="/register" className="btn-primary">Get Started</Link>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl gap-10 px-6 pb-16 pt-12 md:grid-cols-2 md:items-center">
          <div>
            <span className="badge bg-brand-50 text-brand-700">Built for online learning</span>
            <h1 className="mt-6 text-5xl font-black leading-tight text-slate-900">
              Learn faster. Grow smarter.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-600">
              AcademiaX helps students discover high-impact programs, instructors manage premium courses,
              and teams track outcomes from one modern learning platform.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/register" className="btn-primary gap-2">
                Start learning <FaArrowRight />
              </Link>
              <Link to="/login" className="btn-secondary">View portal</Link>
            </div>
          </div>

          <div className="card p-6">
            <div className="rounded-2xl bg-slate-900 p-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Enrollment</div>
                  <div className="mt-2 text-3xl font-bold">$24,500</div>
                </div>
                <div className="rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-semibold text-emerald-300">
                  +18.4%
                </div>
              </div>
              <div className="mt-8 space-y-4">
                {[
                  ['Data Strategy', '92%'],
                  ['AI for Product', '76%'],
                  ['UX Design Sprint', '88%'],
                ].map(([name, value]) => (
                  <div key={name}>
                    <div className="mb-1 flex justify-between text-sm text-slate-300">
                      <span>{name}</span>
                      <span>{value}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-700">
                      <div className="h-2 rounded-full bg-brand-500" style={{ width: value }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Platform features</p>
            <h2 className="mt-3 text-3xl font-bold text-slate-900">Everything you need to deliver online learning</h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {featureCards.map(({ icon, title, text }) => (
              <div key={title} className="card p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50">{icon}</div>
                <h3 className="text-xl font-bold text-slate-900">{title}</h3>
                <p className="mt-3 text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
