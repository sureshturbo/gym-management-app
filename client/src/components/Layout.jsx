import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import Icon from './Icon.jsx';
import { Avatar } from './ui.jsx';

const NAV = {
  owner: {
    subtitle: 'Owner console',
    profile: '/owner/profile',
    items: [
      { section: 'Overview' },
      { to: '/owner', label: 'Dashboard', icon: 'dashboard', end: true },
      { to: '/owner/reports', label: 'Reports', icon: 'chart' },
      { section: 'Manage' },
      { to: '/owner/members', label: 'Members', icon: 'users' },
      { to: '/owner/attendance', label: 'Attendance', icon: 'calendar' },
      { to: '/owner/payments', label: 'Payments', icon: 'wallet' },
      { to: '/owner/followups', label: 'Follow-ups', icon: 'bell' },
      { section: 'Setup' },
      { to: '/owner/plans', label: 'Plans', icon: 'tag' },
      { to: '/owner/batches', label: 'Batches & timing', icon: 'clock' },
      { to: '/owner/gym', label: 'Gym & QR', icon: 'qr' },
    ],
  },
  member: {
    subtitle: 'Member',
    profile: '/me/profile',
    items: [
      { section: 'My gym' },
      { to: '/me', label: 'Home', icon: 'home', end: true },
      { to: '/me/scan', label: 'Check in', icon: 'scan' },
      { to: '/me/history', label: 'History', icon: 'clock' },
      { section: 'Account' },
      { to: '/me/profile', label: 'Profile', icon: 'user' },
    ],
  },
};

const BrandMark = () => (
  <span className="brand-logo"><Icon name="dumbbell" size={18} strokeWidth={2.4} /></span>
);

export default function Layout({ role }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const nav = NAV[role];
  const links = nav.items.filter((n) => n.to);

  const tab = (to, label, icon, end) => (
    <NavLink key={to} to={to} end={end} className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
      <Icon name={icon} size={21} />
      {label}
    </NavLink>
  );

  return (
    <div className="shell">
      {/* Desktop / tablet: sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <BrandMark />
          <span className="brand-name">
            {user?.gymName ?? 'Gym Manager'}
            <small>{nav.subtitle}</small>
          </span>
        </div>
        <nav aria-label="Main">
          {nav.items.map((n, i) =>
            n.section ? (
              <div className="nav-section" key={`s${i}`}>{n.section}</div>
            ) : (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>
                <Icon name={n.icon} size={19} />
                {n.label}
              </NavLink>
            ),
          )}
        </nav>
        <div className="sidebar-foot">
          <NavLink to={nav.profile} aria-label="Profile">
            <Avatar name={user?.name} photo={user?.photoKey} size={36} />
          </NavLink>
          <div className="who">
            {user?.name}
            <small>{user?.email}</small>
          </div>
          <button type="button" className="icon-btn" onClick={logout} aria-label="Log out" title="Log out">
            <Icon name="logout" size={18} />
          </button>
        </div>
      </aside>

      <div className="main">
        {/* Phone: compact top bar */}
        <header className="mobile-top">
          <div className="brand">
            <BrandMark />
            <span className="brand-name">{user?.gymName ?? 'Gym Manager'}</span>
          </div>
          <div className="row gap">
            <NavLink to={nav.profile} aria-label="Profile"><Avatar name={user?.name} photo={user?.photoKey} size={32} /></NavLink>
            <button type="button" className="icon-btn" onClick={logout} aria-label="Log out"><Icon name="logout" size={18} /></button>
          </div>
        </header>
        <main className="content">
          <div className="page" key={location.pathname}>
            <Outlet />
          </div>
        </main>
      </div>

      {/* Phone: bottom tab bar */}
      {role === 'owner' ? (
        <nav className="tabbar tabbar-owner" aria-label="Main">
          {links.map((n) => tab(n.to, n.label, n.icon, n.end))}
        </nav>
      ) : (
        <nav className="tabbar tabbar-member" aria-label="Main">
          {tab('/me', 'Home', 'home', true)}
          {tab('/me/history', 'History', 'clock')}
          <NavLink to="/me/scan" className={({ isActive }) => `tab-fab ${isActive ? 'active' : ''}`} aria-label="Check in">
            <Icon name="scan" size={26} strokeWidth={2.2} />
          </NavLink>
          {tab('/me/profile', 'Profile', 'user')}
        </nav>
      )}
    </div>
  );
}
