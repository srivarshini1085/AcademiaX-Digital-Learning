import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import StudentDashboard from './pages/StudentDashboard';
import InstructorDashboard from './pages/InstructorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import MyEnrollmentsPage from './pages/MyEnrollmentsPage';
import PaymentPage from './pages/PaymentPage';
import CreateCoursePage from './pages/CreateCoursePage';
import { AuthProvider, useAuth } from './context/AuthContext';

function AppRoutes() {
  const { isAuthenticated, user } = useAuth();

  const roleRedirect = () => {
    if (!isAuthenticated || !user) return '/login';
    if (user.role === 'STUDENT') return '/student/dashboard';
    if (user.role === 'INSTRUCTOR') return '/instructor/dashboard';
    if (user.role === 'ADMIN') return '/admin/dashboard';
    return '/';
  };

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to={roleRedirect()} replace /> : <LoginPage />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to={roleRedirect()} replace /> : <RegisterPage />} />
      <Route path="/student/dashboard" element={isAuthenticated && user?.role === 'STUDENT' ? <StudentDashboard /> : <Navigate to="/login" replace />} />
      <Route path="/student/enrollments" element={isAuthenticated && user?.role === 'STUDENT' ? <MyEnrollmentsPage /> : <Navigate to="/login" replace />} />
      <Route path="/student/payment/:paymentId" element={isAuthenticated && user?.role === 'STUDENT' ? <PaymentPage /> : <Navigate to="/login" replace />} />
      <Route path="/instructor/dashboard" element={isAuthenticated && user?.role === 'INSTRUCTOR' ? <InstructorDashboard /> : <Navigate to="/login" replace />} />
      <Route path="/instructor/courses/create" element={isAuthenticated && user?.role === 'INSTRUCTOR' ? <CreateCoursePage /> : <Navigate to="/login" replace />} />
      <Route path="/admin/dashboard" element={isAuthenticated && user?.role === 'ADMIN' ? <AdminDashboard /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
