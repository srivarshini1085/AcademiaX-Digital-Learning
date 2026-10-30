import { Link } from 'react-router-dom';
import { BookOpen, Users, Shield, GraduationCap, ArrowRight, ChevronRight } from 'lucide-react';
import Navbar from '../components/Navbar';

const STATS = [
  { label: 'Courses Available', value: '120+', icon: BookOpen },
  { label: 'Active Students', value: '2,400', icon: Users },
  { label: 'Departments', value: '8', icon: GraduationCap },
  { label: 'Secure Enrollment', value: 'JWT', icon: Shield },
];

const SAMPLE_COURSES = [
  { code: 'CS101', title: 'Introduction to Computer Science', dept: 'Computer Science', seats: '35/40', fee: '₹2,500' },
  { code: 'MATH201', title: 'Linear Algebra', dept: 'Mathematics', seats: '38/45', fee: '₹1,800' },
  { code: 'PHY101', title: 'Classical Mechanics', dept: 'Physics', seats: '42/50', fee: '₹2,200' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-paper">
      <Navbar />

      {/* Hero */}
      <section className="border-b border-hairline">
        <div className="max-w-6xl mx-auto px-4 py-20 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="font-mono text-xs text-accent tracking-widest uppercase mb-4">Fall 2026 Enrolment Open</p>
            <h1 className="font-display text-5xl font-light text-ink leading-tight mb-6">
              The University<br />
              <em className="font-normal">Course Catalogue</em>
            </h1>
            <p className="text-ink-light text-lg leading-relaxed mb-8">
              Browse, enrol, and pay tuition for your courses through AcademiaX — the official digital registrar for PS035.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/courses" className="btn-primary">
                Browse Catalogue <ArrowRight size={14} />
              </Link>
              <Link to="/register" className="btn-ghost">
                Create Account
              </Link>
            </div>
          </div>

          {/* Sample course cards preview */}
          <div className="hidden md:flex flex-col gap-3 relative">
            <div className="absolute -top-4 -left-4 w-32 h-32 bg-accent/5 rounded-full blur-3xl" />
            {SAMPLE_COURSES.map((c, i) => (
              <div key={c.code} className="index-card flex items-center gap-4 animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                <span className="font-mono text-accent text-xs w-16 shrink-0">{c.code}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{c.title}</p>
                  <p className="text-xs text-ink-muted">{c.dept}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-xs text-ink">{c.fee}</p>
                  <p className="font-mono text-[10px] text-ink-muted">{c.seats}</p>
                </div>
              </div>
            ))}
            <p className="text-xs text-ink-muted text-right font-mono mt-1">+ 117 more courses →</p>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-b border-hairline bg-surface">
        <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map(({ label, value, icon: Icon }) => (
            <div key={label} className="text-center">
              <Icon size={16} className="text-accent mx-auto mb-2" />
              <p className="font-mono text-2xl font-medium text-ink">{value}</p>
              <p className="text-xs text-ink-muted mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature columns */}
      <section className="max-w-6xl mx-auto px-4 py-16 grid md:grid-cols-3 gap-8">
        {[
          { title: 'Seat-Hold Saga', body: 'Reserve your seat for 10 minutes while you complete payment. Holds expire automatically — fairness built in.', code: 'POST /enrollments' },
          { title: 'Secure JWT Auth', body: '15-minute access tokens, 7-day rotating refresh tokens, family revocation on reuse, and 5-strike lockout.', code: 'BCrypt · HMAC-SHA384' },
          { title: 'Load Balanced', body: 'Two instances each of course-service and enrollment-service behind Spring Cloud LoadBalancer, provably round-robin.', code: 'X-Served-By header' },
        ].map(f => (
          <div key={f.title} className="border-t-2 border-accent pt-5">
            <h3 className="font-display text-xl text-ink mb-2">{f.title}</h3>
            <p className="text-sm text-ink-light leading-relaxed mb-4">{f.body}</p>
            <code className="mono-badge bg-hairline/60 px-2 py-1 rounded text-[10px]">{f.code}</code>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="border-t border-hairline bg-surface">
        <div className="max-w-6xl mx-auto px-4 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="font-display text-2xl text-ink mb-1">Ready to enrol?</h2>
            <p className="text-ink-muted text-sm">Create your student account — takes under a minute.</p>
          </div>
          <Link to="/register" className="btn-primary shrink-0">
            Get started <ChevronRight size={14} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-hairline">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col md:flex-row justify-between items-center gap-2 text-xs text-ink-muted font-mono">
          <span>AcademiaX — PS035 Higher Education Enrollment System</span>
          <span>Review 2 · Spring Boot 3.3.5 · React 18</span>
        </div>
      </footer>
    </div>
  );
}
