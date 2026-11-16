import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { homePath, useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import { Loading } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Profile from './pages/Profile.jsx';
import OwnerDashboard from './pages/owner/Dashboard.jsx';
import Members from './pages/owner/Members.jsx';
import MemberDetail from './pages/owner/MemberDetail.jsx';
import Plans from './pages/owner/Plans.jsx';
import Attendance from './pages/owner/Attendance.jsx';
import Payments from './pages/owner/Payments.jsx';
import Followups from './pages/owner/Followups.jsx';
import Reports from './pages/owner/Reports.jsx';
import GymSettings from './pages/owner/GymSettings.jsx';
import MemberHome from './pages/member/Home.jsx';
import History from './pages/member/History.jsx';

// The QR scanner library is large; load it only when a member opens Check in.
const Scan = lazy(() => import('./pages/member/Scan.jsx'));

function RequireRole({ role, children }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.role !== role) return <Navigate to={homePath(user)} replace />;
  return children;
}

function GuestOnly({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  return user ? <Navigate to={homePath(user)} replace /> : children;
}

function Home() {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  return <Navigate to={user ? homePath(user) : '/login'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />

      <Route element={<RequireRole role="owner"><Layout role="owner" /></RequireRole>}>
        <Route path="/owner" element={<OwnerDashboard />} />
        <Route path="/owner/members" element={<Members />} />
        <Route path="/owner/members/:id" element={<MemberDetail />} />
        <Route path="/owner/attendance" element={<Attendance />} />
        <Route path="/owner/payments" element={<Payments />} />
        <Route path="/owner/followups" element={<Followups />} />
        <Route path="/owner/plans" element={<Plans />} />
        <Route path="/owner/reports" element={<Reports />} />
        <Route path="/owner/gym" element={<GymSettings />} />
        <Route path="/owner/profile" element={<Profile />} />
      </Route>

      <Route element={<RequireRole role="member"><Layout role="member" /></RequireRole>}>
        <Route path="/me" element={<MemberHome />} />
        <Route path="/me/scan" element={<Suspense fallback={<Loading />}><Scan /></Suspense>} />
        <Route path="/me/history" element={<History />} />
        <Route path="/me/profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<Home />} />
    </Routes>
  );
}
