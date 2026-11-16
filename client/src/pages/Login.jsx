import { Link, useLocation, useNavigate } from 'react-router-dom';
import { homePath, useAuth } from '../auth.jsx';
import { useForm } from '../hooks.js';
import { Alert, Field } from '../components/ui.jsx';
import AuthHero from './AuthHero.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const f = useForm({ email: '', password: '' });

  const onSubmit = async (e) => {
    e.preventDefault();
    const user = await f.submit((v) => login(v.email, v.password));
    if (!user) return;
    const from = location.state?.from;
    const allowed = from && from.startsWith(user.role === 'owner' ? '/owner' : '/me');
    navigate(allowed ? from : homePath(user), { replace: true });
  };

  return (
    <div className="auth-page">
      <AuthHero />
      <div className="auth-side">
        <form className="auth-card" onSubmit={onSubmit} noValidate>
          <div>
            <h2>Welcome back 👋</h2>
            <p className="muted">Log in to your gym account</p>
          </div>
          {f.error && <Alert tone="danger">{f.error}</Alert>}
          <Field label="Email" error={f.errors.email}>
            <input type="email" autoComplete="email" placeholder="you@example.com" value={f.values.email} onChange={f.set('email')} required />
          </Field>
          <Field label="Password" error={f.errors.password}>
            <input type="password" autoComplete="current-password" placeholder="••••••••" value={f.values.password} onChange={f.set('password')} required />
          </Field>
          <button className="btn btn-primary btn-lg btn-block" disabled={f.busy}>
            {f.busy ? 'Logging in…' : 'Log in'}
          </button>
          <p className="center small muted">
            New member? <Link to="/register">Create your account</Link>
          </p>
          <p className="center small muted">Forgot your password? Ask your gym to reset it.</p>
        </form>
      </div>
    </div>
  );
}
