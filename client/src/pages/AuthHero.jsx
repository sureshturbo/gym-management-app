import Icon from '../components/Icon.jsx';

/** Left-hand brand panel shared by Login and Register. */
export default function AuthHero() {
  return (
    <aside className="auth-hero">
      <div className="brand">
        <span className="brand-logo"><Icon name="dumbbell" size={18} strokeWidth={2.4} /></span>
        Gym Manager
      </div>
      <div>
        <h1>Run your gym. Not spreadsheets.</h1>
        <p>QR check-ins with GPS, memberships, fee tracking and follow-ups, all in one place.</p>
        <div className="feature-pills">
          <span><Icon name="scan" size={16} /> QR + GPS check-in</span>
          <span><Icon name="chart" size={16} /> Live insights</span>
          <span><Icon name="wallet" size={16} /> Fee tracking</span>
        </div>
      </div>
      <p className="small" style={{ opacity: 0.75 }}>Built for gym owners and their members.</p>
    </aside>
  );
}
