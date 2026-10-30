import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth, homeFor } from './context/AuthContext';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CataloguePage from './pages/CataloguePage';
import CourseDetailPage from './pages/CourseDetailPage';
import CheckoutPage from './pages/CheckoutPage';
import MyEnrollmentsPage from './pages/MyEnrollmentsPage';
import StudentDashboard from './pages/StudentDashboard';
const InstructorDashboard = lazy(() => import('./pages/InstructorDashboard'));
import CourseEditorPage from './pages/CourseEditorPage';
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const SystemConsolePage = lazy(() => import('./pages/SystemConsolePage')); // staff pages load recharts on demand
import NotificationsPage from './pages/NotificationsPage';
import ProfilePage from './pages/ProfilePage';
import { ForbiddenPage, NotFoundPage } from './pages/StatusPages';
import { Skeleton } from './components/ui';

/** Client-side guard for navigation only; every rule is enforced again by the gateway and the services. */
function RequireRole({ roles, children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <ForbiddenPage />;
  return <Suspense fallback={<Skeleton className="h-96" />}>{children}</Suspense>;
}

function GuestOnly({ children }) {
  const { user } = useAuth();
  return user ? <Navigate to={homeFor(user.role)} replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<LandingPage />} />
        <Route path="login" element={<GuestOnly><LoginPage /></GuestOnly>} />
        <Route path="register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
        <Route path="courses" element={<CataloguePage />} />
        <Route path="courses/new" element={<RequireRole roles={['ADMIN', 'INSTRUCTOR']}><CourseEditorPage /></RequireRole>} />
        <Route path="courses/:id" element={<CourseDetailPage />} />
        <Route path="courses/:id/edit" element={<RequireRole roles={['ADMIN', 'INSTRUCTOR']}><CourseEditorPage /></RequireRole>} />

        <Route path="dashboard" element={<RequireRole roles={['STUDENT']}><StudentDashboard /></RequireRole>} />
        <Route path="enrollments" element={<RequireRole roles={['STUDENT']}><MyEnrollmentsPage /></RequireRole>} />
        <Route path="checkout/:enrollmentId" element={<RequireRole roles={['STUDENT']}><CheckoutPage /></RequireRole>} />

        <Route path="instructor" element={<RequireRole roles={['INSTRUCTOR']}><InstructorDashboard /></RequireRole>} />

        <Route path="admin" element={<RequireRole roles={['ADMIN']}><AdminDashboard /></RequireRole>} />
        <Route path="admin/console" element={<RequireRole roles={['ADMIN']}><SystemConsolePage /></RequireRole>} />

        <Route path="notifications" element={<RequireRole><NotificationsPage /></RequireRole>} />
        <Route path="profile" element={<RequireRole><ProfilePage /></RequireRole>} />
        <Route path="403" element={<ForbiddenPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
