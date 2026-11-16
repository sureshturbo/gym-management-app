import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useForm } from '../hooks.js';
import { Alert, Avatar, Card, Field, PageHeader } from '../components/ui.jsx';

export default function Profile() {
  const { user, setUser } = useAuth();
  const profile = useForm({ name: user.name, phone: user.phone ?? '' });
  const pw = useForm({ currentPassword: '', newPassword: '', confirm: '' });
  const [saved, setSaved] = useState('');

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaved('');
    const d = await profile.submit((v) => api('/auth/me', { method: 'PATCH', body: v }));
    if (d) {
      setUser(d.user);
      setSaved('profile');
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setSaved('');
    if (pw.values.newPassword !== pw.values.confirm) {
      pw.setError('New passwords do not match');
      return;
    }
    const ok = await pw.submit(async (v) => {
      await api('/auth/change-password', {
        method: 'POST',
        body: { currentPassword: v.currentPassword, newPassword: v.newPassword },
      });
      return true;
    });
    if (ok) {
      pw.setValues({ currentPassword: '', newPassword: '', confirm: '' });
      setSaved('password');
    }
  };

  return (
    <>
      <PageHeader title="Profile" />
      <div className="grid-2">
        <Card title="Your details">
          <div className="row gap mb">
            <Avatar name={user.name} size={52} />
            <div>
              <strong>{user.name}</strong>
              <div className="muted small">{user.email}</div>
              <div className="muted small">{user.gymName}</div>
            </div>
          </div>
          <form onSubmit={saveProfile} className="stack">
            {profile.error && <Alert tone="danger">{profile.error}</Alert>}
            {saved === 'profile' && <Alert tone="success">Saved.</Alert>}
            <Field label="Name" error={profile.errors.name}>
              <input value={profile.values.name} onChange={profile.set('name')} />
            </Field>
            <Field label="Phone" error={profile.errors.phone}>
              <input type="tel" value={profile.values.phone} onChange={profile.set('phone')} />
            </Field>
            <button className="btn btn-primary" disabled={profile.busy}>Save</button>
          </form>
        </Card>
        <Card title="Change password">
          <form onSubmit={changePassword} className="stack">
            {pw.error && <Alert tone="danger">{pw.error}</Alert>}
            {saved === 'password' && <Alert tone="success">Password changed.</Alert>}
            <Field label="Current password" error={pw.errors.currentPassword}>
              <input type="password" autoComplete="current-password" value={pw.values.currentPassword} onChange={pw.set('currentPassword')} />
            </Field>
            <Field label="New password" error={pw.errors.newPassword} hint="At least 8 characters">
              <input type="password" autoComplete="new-password" value={pw.values.newPassword} onChange={pw.set('newPassword')} />
            </Field>
            <Field label="Confirm new password">
              <input type="password" autoComplete="new-password" value={pw.values.confirm} onChange={pw.set('confirm')} />
            </Field>
            <button className="btn btn-primary" disabled={pw.busy}>Change password</button>
          </form>
        </Card>
      </div>
    </>
  );
}
