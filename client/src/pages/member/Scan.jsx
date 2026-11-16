import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { api } from '../../api.js';
import { time } from '../../format.js';
import { Alert, Card, PageHeader } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';

const READER_ID = 'qr-reader';

/** Promise for the current GPS position (high accuracy, fresh). */
function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('This browser cannot read your location.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (err) => {
      const msg =
        err.code === err.PERMISSION_DENIED
          ? 'Location permission is blocked. Allow location for this site in your browser settings, then try again.'
          : 'Could not get your location. Turn on GPS/location and try again.';
      reject(new Error(msg));
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  });
}

export default function Scan() {
  // idle -> scanning -> submitting -> success | error
  const [phase, setPhase] = useState('idle');
  const [message, setMessage] = useState('');
  const scannerRef = useRef(null);
  const positionRef = useRef(null);

  const stopScanner = async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (s) {
      try {
        if (s.isScanning) await s.stop();
        s.clear();
      } catch {
        /* already stopped */
      }
    }
  };

  useEffect(() => () => void stopScanner(), []);

  const submit = async (qrText) => {
    setPhase('submitting');
    try {
      const pos = await positionRef.current;
      const d = await api('/attendance/check-in', {
        method: 'POST',
        body: {
          qr: qrText,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        },
      });
      setMessage(`${d.message} Checked in at ${time(d.attendance.check_in_at)}.`);
      setPhase('success');
    } catch (err) {
      if (err.status === 409 && err.data?.checkInAt) {
        setMessage(`You already checked in today at ${time(err.data.checkInAt)}.`);
        setPhase('success');
      } else {
        setMessage(err.message);
        setPhase('error');
      }
    }
  };

  const start = async () => {
    setMessage('');
    // Ask for location in parallel with the camera so check-in is quick once the code is read.
    positionRef.current = getPosition();
    positionRef.current.catch(() => {}); // handled in submit()
    setPhase('scanning');
    try {
      const scanner = new Html5Qrcode(READER_ID, { verbose: false });
      scannerRef.current = scanner;
      let handled = false;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: (w, h) => { const s = Math.floor(Math.min(w, h) * 0.7); return { width: s, height: s }; } },
        async (text) => {
          if (handled) return;
          handled = true;
          await stopScanner();
          submit(text);
        },
        () => {},
      );
    } catch (err) {
      await stopScanner();
      const denied = /permission|notallowed/i.test(String(err?.name ?? err));
      setMessage(
        denied
          ? 'Camera permission is blocked. Allow camera access for this site, then try again.'
          : 'Could not start the camera. On a phone this page must be opened over HTTPS.',
      );
      setPhase('error');
    }
  };

  const cancel = async () => {
    await stopScanner();
    setPhase('idle');
  };

  return (
    <>
      <PageHeader title="Check in" subtitle="Scan the QR code at the gym entrance." />
      <Card className="scan-card">
        {/* The reader element must stay mounted while html5-qrcode is running */}
        <div className={`scan-stage ${phase === 'scanning' ? '' : 'hidden'}`}>
          <div id={READER_ID} className="qr-reader" />
          <div className="scan-frame" aria-hidden="true" />
          <div className="scan-laser" aria-hidden="true" />
        </div>

        {phase === 'idle' && (
          <div className="scan-intro">
            <div className="scan-art" aria-hidden="true"><Icon name="qr" size={56} strokeWidth={1.6} /></div>
            <h2>Ready to train?</h2>
            <div className="steps">
              <div><b>1</b> Allow camera and location access</div>
              <div><b>2</b> Point at the QR code at the entrance</div>
              <div><b>3</b> We confirm you're at the gym — done!</div>
            </div>
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={start}>
              <Icon name="scan" size={20} /> Start scanning
            </button>
          </div>
        )}

        {phase === 'scanning' && (
          <button type="button" className="btn btn-block mt" onClick={cancel}>Cancel</button>
        )}

        {phase === 'submitting' && (
          <div className="scan-intro">
            <div className="spinner" aria-hidden="true" />
            <p className="muted" role="status">Checking your location and membership…</p>
          </div>
        )}

        {phase === 'success' && (
          <div className="scan-intro">
            <div className="big-check big" aria-hidden="true"><Icon name="check" size={48} strokeWidth={3} /></div>
            <h2>You're in!</h2>
            <Alert tone="success">{message}</Alert>
            <Link to="/me" className="btn btn-primary btn-block">Back to home</Link>
          </div>
        )}

        {phase === 'error' && (
          <div className="stack">
            <Alert tone="danger">{message}</Alert>
            <button type="button" className="btn btn-primary btn-block" onClick={start}>Try again</button>
          </div>
        )}
      </Card>
    </>
  );
}
