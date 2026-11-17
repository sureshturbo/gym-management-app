import { useEffect, useRef } from 'react';
import { photoUrl, STATUS } from '../format.js';
import { useCountUp } from '../hooks.js';
import Icon from './Icon.jsx';

export function PageHeader({ title, subtitle, eyebrow, actions }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="row gap wrap">{actions}</div>}
    </div>
  );
}

export function Card({ title, sub, actions, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          <div>
            {title && <h2>{title}</h2>}
            {sub && <div className="sub">{sub}</div>}
          </div>
          {actions && <div className="row gap">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Number that counts up when it appears or changes. */
export function CountUp({ value, format = (n) => Math.round(n).toLocaleString('en-IN') }) {
  const v = useCountUp(value);
  return <>{format(v)}</>;
}

/** Percent change pill: ▲ 12% / ▼ 5% / — */
export function Delta({ now, before, suffix = '' }) {
  if (before == null) return null;
  if (!before) {
    return now ? <span className="delta delta-up"><Icon name="up" size={12} /> new{suffix}</span> : <span className="delta delta-flat">—</span>;
  }
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return <span className="delta delta-flat">0%{suffix}</span>;
  const up = pct > 0;
  return (
    <span className={`delta ${up ? 'delta-up' : 'delta-down'}`}>
      <Icon name={up ? 'up' : 'down'} size={12} /> {Math.abs(pct)}%{suffix}
    </span>
  );
}

/**
 * Stat tile. Pass `count` (number) + optional `format` to animate the value,
 * or `value` for static content.
 */
export function Stat({ label, value, count, format, tone, hint, icon, foot }) {
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ''}`}>
      <div className="stat-top">
        <div className="stat-label">{label}</div>
        {icon && (
          <span className="stat-icon">
            <Icon name={icon} size={19} />
          </span>
        )}
      </div>
      <div className="stat-value">{count !== undefined ? <CountUp value={count} format={format} /> : value}</div>
      {(foot || hint) && <div className="stat-foot">{foot}{hint && <span>{hint}</span>}</div>}
    </div>
  );
}

export const Badge = ({ tone = 'muted', plain, children }) => (
  <span className={`badge badge-${tone} ${plain ? 'badge-plain' : ''}`}>{children}</span>
);

export function StatusBadge({ status }) {
  const s = STATUS[status] ?? { label: status, tone: 'muted' };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

const ALERT_ICON = { danger: 'alert', warning: 'alert', success: 'check', info: 'sparkle' };
export const Alert = ({ tone = 'info', children }) => (
  <div className={`alert alert-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
    <Icon name={ALERT_ICON[tone] ?? 'sparkle'} size={18} />
    <div>{children}</div>
  </div>
);

export const Loading = ({ text = 'Loading…' }) => <div className="loading">{text}</div>;

/** Shimmer placeholders shown on first load only (refetches keep the old content). */
export function Skeleton({ stats = 4, blocks = 2 }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      {stats > 0 && (
        <div className="skeleton-stats">
          {Array.from({ length: stats }, (_, i) => <div key={i} className="skeleton" />)}
        </div>
      )}
      {Array.from({ length: blocks }, (_, i) => <div key={i} className="skeleton skeleton-block" />)}
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <Alert tone="danger">
      {error.message ?? String(error)}
      {onRetry && (
        <button type="button" className="btn btn-link" onClick={onRetry}>
          Retry
        </button>
      )}
    </Alert>
  );
}

export const Empty = ({ children }) => <p className="empty">{children}</p>;

/** Labeled form control; `error` is an array of messages from the API. */
export function Field({ label, error, hint, children }) {
  return (
    <label className={`field ${error ? 'field-error' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-msg">{[].concat(error).join(', ')}</span> : hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Modal({ open, title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog ref={ref} className="modal" onClose={onClose} onCancel={onClose}>
      {open && (
        <>
          <div className="card-head">
            <h2>{title}</h2>
            <button type="button" className="btn btn-ghost btn-sm" aria-label="Close" onClick={onClose}>
              ✕
            </button>
          </div>
          {children}
        </>
      )}
    </dialog>
  );
}

// Avatar gradients picked from the name so each member keeps the same colour.
const AVATAR_GRADS = [
  ['#6d5ef0', '#4b74e8'],
  ['#2fa3d8', '#2a78d6'],
  ['#e8618c', '#b44bd6'],
  ['#f08a3c', '#e3564b'],
  ['#1baf7a', '#139a8f'],
  ['#8b5cf6', '#6366f1'],
];
function hash(s) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

/** Profile photo when `photo` (a photo key) is set, otherwise coloured initials. */
export function Avatar({ name, size = 40, photo }) {
  const n = name ?? '?';
  if (photo) {
    return (
      <img
        className="avatar avatar-img"
        src={photoUrl(photo)}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
  const [a, b] = AVATAR_GRADS[hash(n) % AVATAR_GRADS.length];
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.36, background: `linear-gradient(135deg, ${a}, ${b})` }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

/** Circular progress ring; animates from empty on mount. */
export function ProgressRing({ value, max, size = 120, stroke = 10, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.strokeDashoffset = String(c);
    // next frame -> transition to the real value
    const id = requestAnimationFrame(() => {
      el.style.strokeDashoffset = String(c * (1 - pct));
    });
    return () => cancelAnimationFrame(id);
  }, [c, pct]);
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle className="track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} stroke="var(--surface-3)" />
        <circle
          ref={ref}
          className="bar"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          stroke="var(--primary)"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c}
        />
      </svg>
      <div className="ring-label">{children}</div>
    </div>
  );
}
