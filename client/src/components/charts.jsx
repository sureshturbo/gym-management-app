import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { money } from '../format.js';
import Icon from './Icon.jsx';

// ---------- theme ----------

function readTheme() {
  const s = getComputedStyle(document.documentElement);
  const v = (k) => s.getPropertyValue(k).trim();
  return {
    s1: v('--series-1'),
    s2: v('--series-2'),
    s3: v('--series-3'),
    grid: v('--grid'),
    axis: v('--axis'),
    surface: v('--surface'),
    good: v('--st-good'),
    warn: v('--st-warn'),
    crit: v('--st-crit'),
    neutral: v('--st-neutral'),
    neutral2: v('--st-neutral-2'),
  };
}

/** Resolved chart colours; re-reads when the OS switches light/dark. */
export function useChartTheme() {
  const [t, setT] = useState(readTheme);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => setT(readTheme());
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return t;
}

const animate = () => !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ---------- formatting ----------

const shortDate = (d) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};
const weekday = (d) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};
const monthLabel = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short' });
};
const monthLong = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};
export const hourLabel = (h) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
const compactMoney = (n) =>
  n >= 100000 ? `₹${+(n / 100000).toFixed(1)}L` : n >= 1000 ? `₹${+(n / 1000).toFixed(1)}k` : `₹${n}`;

// ---------- chrome ----------

export function Legend({ items }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <span key={it.label}>
          <i style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

function Tip({ active, payload, label, title, rows }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <div className="chart-tip-title">{title(label, payload)}</div>
      {rows(payload).map((r) => (
        <div className="chart-tip-row" key={r.name}>
          <i style={{ background: r.color }} />
          <span>{r.name}</span>
          {r.value}
        </div>
      ))}
    </div>
  );
}

/**
 * Card wrapper for every chart: title, optional legend, and a Chart/Table toggle
 * so each value can also be read without hovering (and without relying on colour).
 */
export function ChartCard({ title, sub, legend, table, children, className = '' }) {
  const [view, setView] = useState('chart');
  return (
    <section className={`card ${className}`}>
      <div className="card-head">
        <div>
          <h2>{title}</h2>
          {sub && <div className="sub">{sub}</div>}
        </div>
        {table && (
          <div className="seg" role="group" aria-label="View">
            <button type="button" className={view === 'chart' ? 'active' : ''} onClick={() => setView('chart')}>
              <Icon name="chart" size={13} /> Chart
            </button>
            <button type="button" className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>
              <Icon name="table" size={13} /> Table
            </button>
          </div>
        )}
      </div>
      {legend && view === 'chart' && <div className="mb"><Legend items={legend} /></div>}
      {view === 'chart' || !table ? (
        children
      ) : (
        <div className="table-wrap" style={{ maxHeight: 300, overflowY: 'auto' }}>
          <table className="table">
            <thead>
              <tr>{table.columns.map((c, i) => <th key={c} className={i ? 'num' : ''}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {table.rows.map((r) => (
                <tr key={r[0]}>{r.map((cell, i) => <td key={i} className={i ? 'num' : ''}>{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const axisProps = (t) => ({
  tick: { fill: t.axis, fontSize: 12 },
  axisLine: false,
  tickLine: false,
});

// ---------- charts ----------

/** Daily check-ins: single-series area with crosshair tooltip. */
export function AttendanceTrend({ data, height = 250, className = '', title = 'Attendance trend', sub }) {
  const t = useChartTheme();
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <ChartCard
      className={className}
      title={title}
      sub={sub ?? `${total} check-ins in the last ${data.length} days`}
      table={{ columns: ['Date', 'Check-ins'], rows: [...data].reverse().map((d) => [weekday(d.date), d.count]) }}
    >
      <div className="chart-box" style={{ height }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="attFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={t.s1} stopOpacity={0.28} />
                <stop offset="100%" stopColor={t.s1} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={t.grid} />
            <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={24} {...axisProps(t)} />
            <YAxis allowDecimals={false} width={44} {...axisProps(t)} />
            <Tooltip
              cursor={{ stroke: t.axis, strokeWidth: 1 }}
              content={
                <Tip
                  title={(l) => weekday(l)}
                  rows={(p) => [{ name: 'Check-ins', color: t.s1, value: p[0].value }]}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke={t.s1}
              strokeWidth={2}
              fill="url(#attFill)"
              dot={false}
              activeDot={{ r: 5, stroke: t.surface, strokeWidth: 2, fill: t.s1 }}
              isAnimationActive={animate()}
              animationDuration={900}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

/** Monthly collection, cash + UPI stacked (2 series, legend + table). */
export function RevenueBars({ data, height = 250, className = '', title = 'Fee collection', sub = 'Last 6 months', daily = false }) {
  const t = useChartTheme();
  // Monthly rows are { month, cash, upi }; daily rows are { date, cash, upi }.
  const xKey = daily ? 'date' : 'month';
  const xFmt = daily ? shortDate : monthLabel;
  const longFmt = daily ? weekday : monthLong;
  return (
    <ChartCard
      className={className}
      title={title}
      sub={sub}
      legend={[
        { label: 'Cash', color: t.s1 },
        { label: 'UPI', color: t.s2 },
      ]}
      table={{
        columns: [daily ? 'Date' : 'Month', 'Cash', 'UPI', 'Total'],
        rows: [...data].reverse().map((d) => [longFmt(d[xKey]), money(d.cash), money(d.upi), money(Number(d.cash) + Number(d.upi))]),
      }}
    >
      <div className="chart-box" style={{ height }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, left: -6, bottom: 0 }} barCategoryGap={daily ? '14%' : '28%'}>
            <CartesianGrid vertical={false} stroke={t.grid} />
            <XAxis dataKey={xKey} tickFormatter={xFmt} minTickGap={16} {...axisProps(t)} />
            <YAxis tickFormatter={compactMoney} width={52} {...axisProps(t)} />
            <Tooltip
              cursor={{ fill: t.grid, opacity: 0.6 }}
              content={
                <Tip
                  title={(l) => longFmt(l)}
                  rows={(p) => [
                    ...p.map((x) => ({ name: x.name, color: x.color, value: money(x.value) })),
                    { name: 'Total', color: 'transparent', value: money(p.reduce((s, x) => s + x.value, 0)) },
                  ]}
                />
              }
            />
            {/* 2px surface-coloured stroke = the gap between stacked segments */}
            <Bar dataKey="cash" name="Cash" stackId="a" fill={t.s1} stroke={t.surface} strokeWidth={2} isAnimationActive={animate()} />
            <Bar dataKey="upi" name="UPI" stackId="a" fill={t.s2} stroke={t.surface} strokeWidth={2} radius={[4, 4, 0, 0]} isAnimationActive={animate()} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

/** Check-ins by hour of day (single series). */
export function PeakHours({ data, height = 250, className = '' }) {
  const t = useChartTheme();
  const peak = data.reduce((best, d) => (d.count > (best?.count ?? -1) ? d : best), null);
  return (
    <ChartCard
      className={className}
      title="Busiest hours"
      sub={peak ? `Peak: ${hourLabel(peak.hour)}–${hourLabel((peak.hour + 1) % 24)} · last 30 days` : 'Last 30 days'}
      table={{ columns: ['Hour', 'Check-ins'], rows: data.map((d) => [`${hourLabel(d.hour)}–${hourLabel((d.hour + 1) % 24)}`, d.count]) }}
    >
      {data.length ? (
        <div className="chart-box" style={{ height }}>
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap="18%">
              <CartesianGrid vertical={false} stroke={t.grid} />
              <XAxis dataKey="hour" tickFormatter={hourLabel} minTickGap={8} {...axisProps(t)} />
              <YAxis allowDecimals={false} width={44} {...axisProps(t)} />
              <Tooltip
                cursor={{ fill: t.grid, opacity: 0.6 }}
                content={
                  <Tip
                    title={(h) => `${hourLabel(h)}–${hourLabel((h + 1) % 24)}`}
                    rows={(p) => [{ name: 'Check-ins', color: t.s1, value: p[0].value }]}
                  />
                }
              />
              <Bar dataKey="count" fill={t.s1} radius={[4, 4, 0, 0]} isAnimationActive={animate()} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="empty">No check-ins yet.</p>
      )}
    </ChartCard>
  );
}

/** Member mix as one segmented bar (part-to-whole) with status colours + labelled counts. */
export function MemberMix({ mix, className = '' }) {
  const t = useChartTheme();
  const parts = [
    { key: 'active', label: 'Active', color: t.good },
    { key: 'expiring', label: 'Expiring soon', color: t.warn },
    { key: 'expired', label: 'Expired', color: t.crit },
    { key: 'pending', label: 'Upcoming', color: t.neutral },
    { key: 'no_plan', label: 'No plan', color: t.neutral2 },
  ].map((p) => ({ ...p, value: mix[p.key] ?? 0 }));
  const total = parts.reduce((s, p) => s + p.value, 0);
  const shown = parts.filter((p) => p.value > 0);
  return (
    <ChartCard className={className} title="Member status" sub={`${total} active member accounts`}>
      {total ? (
        <>
          <div className="segbar" role="img" aria-label={shown.map((p) => `${p.label} ${p.value}`).join(', ')}>
            {shown.map((p) => (
              <div key={p.key} style={{ flexGrow: p.value, background: p.color }} title={`${p.label}: ${p.value}`} />
            ))}
          </div>
          <div className="mix-legend">
            {parts.map((p) => (
              <div className="mix-item" key={p.key}>
                <i style={{ background: p.color }} />
                <div>
                  <b>{p.value}</b>
                  <small>{p.label} · {total ? Math.round((p.value / total) * 100) : 0}%</small>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="empty">No members yet.</p>
      )}
    </ChartCard>
  );
}

/** Ranked horizontal bars (single colour) — active memberships per plan. */
export function PlanPopularity({ plans, className = '' }) {
  const max = Math.max(1, ...plans.map((p) => p.count));
  return (
    <ChartCard className={className} title="Popular plans" sub="Active memberships by plan">
      {plans.length ? (
        <div className="hbars">
          {plans.map((p, i) => (
            <div className="hbar-row" key={p.plan}>
              <span className="lbl" title={p.plan}>{p.plan}</span>
              <span className="hbar-track">
                <span className="hbar-fill" style={{ width: `${(p.count / max) * 100}%`, animationDelay: `${i * 80}ms` }} />
              </span>
              <span className="val">{p.count}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty">No active memberships.</p>
      )}
    </ChartCard>
  );
}

/** Member: visits per week (single series). */
export function WeeklyVisits({ weeks, height = 180, className = '' }) {
  const t = useChartTheme();
  return (
    <ChartCard
      className={className}
      title="Weekly visits"
      sub="Last 12 weeks"
      table={{ columns: ['Week of', 'Visits'], rows: [...weeks].reverse().map((w) => [shortDate(w.week), w.count]) }}
    >
      <div className="chart-box" style={{ height }}>
        <ResponsiveContainer>
          <BarChart data={weeks} margin={{ top: 8, right: 4, left: -26, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke={t.grid} />
            <XAxis dataKey="week" tickFormatter={shortDate} minTickGap={18} {...axisProps(t)} />
            <YAxis allowDecimals={false} width={44} domain={[0, 7]} ticks={[0, 3, 7]} {...axisProps(t)} />
            <Tooltip
              cursor={{ fill: t.grid, opacity: 0.6 }}
              content={<Tip title={(w) => `Week of ${shortDate(w)}`} rows={(p) => [{ name: 'Visits', color: t.s1, value: p[0].value }]} />}
            />
            <Bar dataKey="count" fill={t.s1} radius={[4, 4, 0, 0]} isAnimationActive={animate()} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

/** Member: 5-week visit calendar. */
export function VisitCalendar({ calendar, today, className = '' }) {
  const visits = calendar.filter((d) => d.visited).length;
  return (
    <ChartCard className={className} title="Your month" sub={`${visits} visits in the last 5 weeks`}>
      <div className="cal" role="grid" aria-label="Visit calendar">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="cal-head">{d}</div>
        ))}
        {calendar.map((d, i) => (
          <div
            key={d.date}
            className={`cal-day ${d.visited ? 'on' : ''} ${d.future ? 'future' : ''} ${d.date === today ? 'today' : ''}`}
            style={{ animationDelay: `${i * 12}ms` }}
            title={`${weekday(d.date)}${d.visited ? ' — visited' : ''}`}
            aria-label={`${weekday(d.date)}${d.visited ? ', visited' : ''}`}
          >
            {d.visited ? <Icon name="check" size={14} strokeWidth={3} /> : Number(d.date.slice(8))}
          </div>
        ))}
      </div>
      <div className="mt"><Legend items={[{ label: 'Visited', color: 'var(--series-1)' }, { label: 'Missed', color: 'var(--surface-3)' }]} /></div>
    </ChartCard>
  );
}
