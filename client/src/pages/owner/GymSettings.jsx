import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { useApi, useForm } from '../../hooks.js';
import { Alert, Card, ErrorBox, Field, Loading, PageHeader } from '../../components/ui.jsx';

export default function GymSettings() {
  const gym = useApi('/gym');
  const qr = useApi('/gym/qr');
  return (
    <>
      <PageHeader title="Gym & QR code" />
      <ErrorBox error={gym.error || qr.error} />
      <div className="grid-2">
        {gym.data ? <GymForm gym={gym.data.gym} /> : <Loading />}
        {qr.data ? <QrCard initial={qr.data} /> : <Loading />}
      </div>
    </>
  );
}

function GymForm({ gym }) {
  const { user, setUser } = useAuth();
  const f = useForm({
    name: gym.name ?? '',
    address: gym.address ?? '',
    phone: gym.phone ?? '',
    email: gym.email ?? '',
    latitude: gym.latitude ?? '',
    longitude: gym.longitude ?? '',
    radius_m: gym.radius_m ?? 150,
  });
  const [saved, setSaved] = useState(false);
  const [locating, setLocating] = useState(false);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      f.setError('This browser cannot read your location.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        f.setValues((s) => ({
          ...s,
          latitude: pos.coords.latitude.toFixed(7),
          longitude: pos.coords.longitude.toFixed(7),
        }));
      },
      (err) => {
        setLocating(false);
        f.setError(`Could not get your location: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaved(false);
    const d = await f.submit((v) =>
      api('/gym', {
        method: 'PUT',
        body: {
          ...v,
          latitude: v.latitude === '' ? null : Number(v.latitude),
          longitude: v.longitude === '' ? null : Number(v.longitude),
          radius_m: Number(v.radius_m),
        },
      }),
    );
    if (d) {
      setSaved(true);
      setUser({ ...user, gymName: d.gym.name });
    }
  };

  const hasLocation = f.values.latitude !== '' && f.values.longitude !== '';

  return (
    <Card title="Gym details">
      <form onSubmit={submit} className="stack">
        {f.error && <Alert tone="danger">{f.error}</Alert>}
        {saved && <Alert tone="success">Saved.</Alert>}
        <Field label="Gym name" error={f.errors.name}>
          <input value={f.values.name} onChange={f.set('name')} required />
        </Field>
        <Field label="Address" error={f.errors.address}>
          <textarea rows={2} value={f.values.address} onChange={f.set('address')} />
        </Field>
        <div className="grid-2 tight">
          <Field label="Phone" error={f.errors.phone}>
            <input type="tel" value={f.values.phone} onChange={f.set('phone')} />
          </Field>
          <Field label="Email" error={f.errors.email}>
            <input type="email" value={f.values.email} onChange={f.set('email')} />
          </Field>
        </div>

        <h3>Check-in location</h3>
        {!hasLocation && <Alert tone="warning">Members can't check in until the gym location is set.</Alert>}
        <p className="muted small">Stand inside the gym and tap the button, or paste coordinates from Google Maps.</p>
        <button type="button" className="btn" onClick={useMyLocation} disabled={locating}>
          {locating ? 'Getting location…' : '📍 Use my current location'}
        </button>
        <div className="grid-3 tight">
          <Field label="Latitude" error={f.errors.latitude}>
            <input inputMode="decimal" value={f.values.latitude} onChange={f.set('latitude')} />
          </Field>
          <Field label="Longitude" error={f.errors.longitude}>
            <input inputMode="decimal" value={f.values.longitude} onChange={f.set('longitude')} />
          </Field>
          <Field label="Radius (m)" error={f.errors.radius_m}>
            <input type="number" min="20" max="2000" value={f.values.radius_m} onChange={f.set('radius_m')} />
          </Field>
        </div>
        {hasLocation && (
          <a
            className="small"
            href={`https://www.google.com/maps?q=${f.values.latitude},${f.values.longitude}`}
            target="_blank"
            rel="noreferrer"
          >
            Check this point on Google Maps ↗
          </a>
        )}
        <button className="btn btn-primary" disabled={f.busy}>Save</button>
      </form>
    </Card>
  );
}

function QrCard({ initial }) {
  const [qr, setQr] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => setQr(initial), [initial]);

  const rotate = async () => {
    if (!window.confirm('Generate a new QR code? The current printed code will stop working immediately.')) return;
    setBusy(true);
    setError(null);
    try {
      setQr(await api('/gym/qr/rotate', { method: 'POST' }));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Check-in QR code" className="qr-card">
      <ErrorBox error={error} />
      <div className="qr-print">
        <h2 className="print-only">{qr.gymName}</h2>
        <div className="qr-box">
          <QRCodeSVG value={qr.payload} size={240} level="M" marginSize={2} />
        </div>
        <p className="center">Scan with the gym app to check in</p>
      </div>
      <div className="row gap center-row no-print">
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>Print</button>
        <button type="button" className="btn" onClick={rotate} disabled={busy}>New QR code</button>
      </div>
      <p className="muted small no-print">
        Display this at the entrance. If the code gets shared outside the gym, generate a new one and print it again.
      </p>
    </Card>
  );
}
