import { useState } from 'react';
import { useApi } from '../../hooks.js';
import { addDays, date, money, todayLocal } from '../../format.js';
import { ErrorBox, PageHeader, Skeleton, Stat } from '../../components/ui.jsx';
import { AttendanceTrend, RevenueBars } from '../../components/charts.jsx';

const PRESETS = [
  ['7d', 'Last 7 days'],
  ['30d', 'Last 30 days'],
  ['90d', 'Last 90 days'],
  ['month', 'This month'],
];

export default function Reports() {
  const today = todayLocal();
  const [preset, setPreset] = useState('30d');
  const [from, setFrom] = useState(addDays(today, -29));
  const [to, setTo] = useState(today);
  // One filter row scopes every chart below.
  const att = useApi('/reports/attendance', { from, to });
  const pay = useApi('/reports/payments', { from, to });

  const choose = (key) => {
    setPreset(key);
    setTo(today);
    if (key === 'month') setFrom(`${today.slice(0, 7)}-01`);
    else setFrom(addDays(today, -(Number.parseInt(key, 10) - 1)));
  };

  const ready = att.data && pay.data;
  // Keep the previous render visible (dimmed) while a new range loads.
  const refetching = att.loading || pay.loading;

  return (
    <>
      <PageHeader title="Reports" subtitle={`${date(from)} – ${date(to)}`} />
      <div className="toolbar">
        <div className="chips">
          {PRESETS.map(([k, label]) => (
            <button key={k} type="button" className={`chip ${preset === k ? 'chip-active' : ''}`} onClick={() => choose(k)}>
              {label}
            </button>
          ))}
        </div>
        <div className="row gap">
          <input type="date" value={from} max={to} onChange={(e) => { if (e.target.value) { setFrom(e.target.value); setPreset(''); } }} aria-label="From" />
          <span className="muted">to</span>
          <input type="date" value={to} min={from} max={today} onChange={(e) => { if (e.target.value) { setTo(e.target.value); setPreset(''); } }} aria-label="To" />
        </div>
      </div>
      <ErrorBox error={att.error || pay.error} />
      {!ready ? (
        <Skeleton stats={4} blocks={2} />
      ) : (
        <div style={{ opacity: refetching ? 0.55 : 1, transition: 'opacity 0.2s' }}>
          <div className="stats stagger">
            <Stat label="Total check-ins" icon="calendar" tone="primary" count={att.data.total} />
            <Stat label="Average per day" icon="up" count={att.data.averagePerDay} format={(n) => n.toFixed(1)} />
            <Stat label="Collected" icon="rupee" tone="success" count={pay.data.totals.total} format={(n) => money(Math.round(n))} />
            <Stat
              label="Cash / UPI"
              icon="wallet"
              value={<span style={{ fontSize: '1.2rem' }}>{money(pay.data.totals.cash)} / {money(pay.data.totals.upi)}</span>}
            />
          </div>
          <div className="bento stagger">
            <AttendanceTrend
              data={att.data.days}
              className="span-12"
              title="Daily attendance"
              sub={`${att.data.total} check-ins`}
              height={280}
            />
            <RevenueBars
              data={pay.data.days}
              daily
              className="span-12"
              title="Daily collection"
              sub={`${money(pay.data.totals.total)} collected`}
              height={280}
            />
          </div>
        </div>
      )}
    </>
  );
}
