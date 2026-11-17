import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { useApi } from '../hooks.js';
import { date, money } from '../format.js';
import { useChartTheme } from './charts.jsx';
import { FemaleFigure, MaleFigure } from './GenderFigures.jsx';
import Icon from './Icon.jsx';
import { Avatar, CountUp, StatusBadge } from './ui.jsx';

const GROUPS = {
  male: { label: 'Men', one: 'man', Figure: MaleFigure, color: 'var(--series-1)', themeKey: 's1' },
  female: { label: 'Women', one: 'woman', Figure: FemaleFigure, color: 'var(--series-2)', themeKey: 's2' },
};

const shortDay = (d) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

/**
 * Two illustrated tiles (men / women). Clicking one shows that group's numbers,
 * 14-day check-ins, batches and members underneath.
 */
export default function GenderSpotlight({ gender, expiring, dues, attendance, className = '' }) {
  const [sel, setSel] = useState('male');
  const total = Object.values(gender).reduce((n, g) => n + g.total, 0);

  return (
    <section className={`card gs ${className}`}>
      <div className="card-head">
        <div>
          <h2>Men &amp; women</h2>
          <div className="sub">Tap a figure to see that group</div>
        </div>
        {gender.unset.total + gender.other.total > 0 && (
          <span className="muted small">
            {gender.other.total ? `${gender.other.total} other · ` : ''}
            {gender.unset.total ? `${gender.unset.total} not set` : ''}
          </span>
        )}
      </div>

      <div className="gs-layout">
        <div className="gs-tiles" role="tablist" aria-label="Gender">
          {Object.entries(GROUPS).map(([key, g]) => {
            const c = gender[key];
            const active = sel === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                className={`gs-tile gs-${key} ${active ? 'active' : ''}`}
                onClick={() => setSel(key)}
              >
                <span className="gs-figure"><g.Figure size={118} /></span>
                <span className="gs-label">{g.label}</span>
                <span className="gs-count"><CountUp value={c.total} /></span>
                <span className="gs-pct">{total ? Math.round((c.total / total) * 100) : 0}% of members</span>
                <span className="gs-today">
                  <Icon name="calendar" size={13} /> {c.today} in today
                </span>
              </button>
            );
          })}
        </div>

        <Details
          key={sel}
          g={sel}
          counts={gender[sel]}
          expiring={expiring.filter((e) => e.gender === sel)}
          dues={dues.filter((d) => d.gender === sel)}
          attendance={attendance}
        />
      </div>
    </section>
  );
}

function Details({ g, counts, expiring, dues, attendance }) {
  const meta = GROUPS[g];
  const t = useChartTheme();
  const color = t[meta.themeKey];
  const { data } = useApi('/members', { gender: g });
  const members = data?.members ?? [];
  const dueAmount = dues.reduce((n, d) => n + d.balance, 0);

  const byBatch = new Map();
  for (const m of members) byBatch.set(m.batch_name ?? 'No batch', (byBatch.get(m.batch_name ?? 'No batch') ?? 0) + 1);
  const trend = attendance?.map((d) => ({ date: d.date, count: d[g] })) ?? [];
  const visits14 = trend.reduce((n, d) => n + d.count, 0);

  return (
    <div className="gs-details" style={{ '--gs-color': meta.color }}>
      <div className="gs-kpis">
        <Kpi label="Members" value={counts.total} />
        <Kpi label="Active plan" value={counts.active} />
        <Kpi label="In today" value={counts.today} />
        <Kpi label="Expiring soon" value={expiring.length} warn={expiring.length > 0} />
        <Kpi label="Dues" value={dueAmount} format={(n) => money(Math.round(n))} warn={dueAmount > 0} />
      </div>

      <div className="gs-row">
        <div className="gs-trend">
          <div className="gs-sub">
            Check-ins · last 14 days <b>{visits14}</b>
          </div>
          {trend.length > 0 && (
            <div style={{ height: 110 }}>
              <ResponsiveContainer>
                <AreaChart data={trend} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`gs-fill-${g}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.32} />
                      <stop offset="100%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" hide />
                  <Tooltip
                    cursor={{ stroke: t.axis, strokeWidth: 1 }}
                    content={({ active, payload, label }) =>
                      active && payload?.length ? (
                        <div className="chart-tip">
                          <div className="chart-tip-title">{shortDay(label)}</div>
                          <div className="chart-tip-row"><i style={{ background: color }} /><span>{meta.label}</span>{payload[0].value}</div>
                        </div>
                      ) : null
                    }
                  />
                  <Area type="monotone" dataKey="count" stroke={color} strokeWidth={2} fill={`url(#gs-fill-${g})`} dot={false}
                    activeDot={{ r: 5, stroke: t.surface, strokeWidth: 2, fill: color }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="gs-batches">
          <div className="gs-sub">By batch</div>
          {byBatch.size ? (
            [...byBatch].sort((a, b) => b[1] - a[1]).map(([name, n]) => (
              <div className="gs-batch" key={name}>
                <span>{name}</span>
                <span className="gs-bar"><i style={{ width: `${(n / members.length) * 100}%` }} /></span>
                <b>{n}</b>
              </div>
            ))
          ) : (
            <p className="muted small">{data ? `No ${meta.label.toLowerCase()} yet.` : 'Loading…'}</p>
          )}
        </div>
      </div>

      <div className="gs-sub row between">
        <span>{meta.label}</span>
        {members.length > 0 && (
          <Link to={`/owner/members?gender=${g}`} className="small">View all {members.length} →</Link>
        )}
      </div>
      {members.length ? (
        <div className="gs-people">
          {members.slice(0, 8).map((m) => (
            <Link key={m.id} to={`/owner/members/${m.id}`} className="gs-person">
              <Avatar name={m.full_name} photo={m.photo_key} size={38} />
              <span className="gs-person-text">
                <b>{m.full_name}</b>
                <small>{m.batch_name ?? 'No batch'} · last visit {m.last_visit ? date(m.last_visit) : '—'}</small>
              </span>
              <StatusBadge status={m.status} />
            </Link>
          ))}
        </div>
      ) : (
        data && <p className="empty">No {meta.label.toLowerCase()} added yet. Set gender when adding a member.</p>
      )}
    </div>
  );
}

function Kpi({ label, value, format, warn }) {
  return (
    <div className={`gs-kpi ${warn ? 'warn' : ''}`}>
      <b><CountUp value={value} format={format} /></b>
      <span>{label}</span>
    </div>
  );
}
