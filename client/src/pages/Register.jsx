import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useForm } from '../hooks.js';
import { Alert, Field } from '../components/ui.jsx';
import AuthHero from './AuthHero.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const f = useForm({ email: '', password: '', confirm: '' });

  const onSubmit = async (e) => {
    e.preventDefault();
    if (f.values.password !== f.values.confirm) {
      f.setError('Passwords do not match');
      return;
    }
    const user = await f.submit((v) => register(v.email, v.password));
    if (user) navigate('/me', { replace: true });
  };

  return (
    <div className="auth-page">
      <AuthHero />
      <div className="auth-side">
        <form className="auth-card" onSubmit={onSubmit} noValidate>
          <div>
            <h2>Create your account</h2>
            <p className="muted">Use the email address you gave your gym.</p>
          </div>
          {f.error && <Alert tone="danger">{f.error}</Alert>}
          <Field label="Email" error={f.errors.email}>
            <input type="email" autoComplete="email" placeholder="you@example.com" value={f.values.email} onChange={f.set('email')} required />
          </Field>
          <Field label="Password" error={f.errors.password} hint="At least 8 characters">
            <input type="password" autoComplete="new-password" value={f.values.password} onChange={f.set('password')} required />
          </Field>
          <Field label="Confirm password">
            <input type="password" autoComplete="new-password" value={f.values.confirm} onChange={f.set('confirm')} required />
          </Field>
          <button className="btn btn-primary btn-lg btn-block" disabled={f.busy}>
            {f.busy ? 'Creating…' : 'Create account'}
          </button>
          <p className="center small muted">
            Already registered? <Link to="/login">Log in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
