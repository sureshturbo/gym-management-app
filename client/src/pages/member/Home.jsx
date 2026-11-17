import { Link } from 'react-router-dom';
import { useAuth } from '../../auth.jsx';
import { useApi } from '../../hooks.js';
import { date, hoursText, money, timeRange } from '../../format.js';
import Icon from '../../components/Icon.jsx';
import { Alert, Card, CountUp, ErrorBox, ProgressRing, Skeleton, Stat, StatusBadge } from '../../components/ui.jsx';
import { VisitCalendar, WeeklyVisits } from '../../components/charts.jsx';

export default function MemberHome() {
  const { user } = useAuth();
  const { data, error, reload } = useApi('/dashboard/member');
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Skeleton stats={4} blocks={2} />;
  const { gym, current, upcoming, lastExpired, visits, alerts, streak } = data;
  const shown = current ?? upcoming ?? lastExpired;
  const hour = new Date().getHours();
  const hi = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <div className="greet">
        <div className="muted small" style={{ fontWeight: 600 }}>{date(data.today)} · {gym.name}</div>
        <h1>{hi}, {user.name.split(' ')[0]} 💪</h1>
        <p className="muted">
          {visits.checkedInToday ? "You're checked in today — keep it up!" : 'Ready for today’s workout? Check in when you arrive.'}
        </p>
      </div>

      {alerts.map((a) => <Alert key={a.text} tone={a.tone}>{a.text}</Alert>)}

      <div className="bento stagger">
        <section className="member-hero span-7">
          {shown ? (
            <div className="row gap-lg wrap" style={{ position: 'relative', zIndex: 1 }}>
              {current ? (
                <ProgressRing value={current.days_left} max={current.total_days} size={120} stroke={11}>
                  <div style={{ fontSize: '1.9rem', fontWeight: 800 }}><CountUp value={current.days_left} /></div>
                  <div className="muted-w" style={{ fontSize: '0.74rem' }}>days left</div>
                </ProgressRing>
              ) : (
                <span className="big-check" style={{ width: 80, height: 80, background: 'rgb(255 255 255 / 18%)', color: '#fff' }}>
                  <Icon name={upcoming ? 'clock' : 'alert'} size={32} />
                </span>
              )}
              <div style={{ minWidth: 0 }}>
                <div className="muted-w">Your membership</div>
                <div className="plan">{shown.plan_name}</div>
                <div className="muted-w">{date(shown.start_date)} – {date(shown.expiry_date)}</div>
                <div className="row gap wrap" style={{ marginTop: 10 }}>
                  <StatusBadge status={shown.status} />
                  <span className="badge">{shown.paid >= shown.amount ? 'Fee paid' : `Paid ${money(shown.paid)} of ${money(shown.amount)}`}</span>
                </div>
                {current && upcoming && <div className="muted-w" style={{ marginTop: 8 }}>Next: {upcoming.plan_name} from {date(upcoming.start_date)}</div>}
              </div>
            </div>
          ) : (
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="plan">No membership yet</div>
              <div className="muted-w">Visit the front desk to choose a plan.</div>
            </div>
          )}
        </section>

        <div className="span-5 stack" style={{ gap: 18 }}>
          {visits.checkedInToday ? (
            <div className="checkin-cta done" style={{ margin: 0, flex: 1 }}>
              <span className="orb"><Icon name="check" size={26} strokeWidth={3} /></span>
              <div>
                <b>You're checked in today</b>
                <span className="muted small">Have a great workout!</span>
              </div>
            </div>
          ) : (
            <Link to="/me/scan" className="checkin-cta" style={{ margin: 0, flex: 1 }}>
              <span className="orb"><Icon name="scan" size={26} /></span>
              <div style={{ flex: 1 }}>
                <b>Check in now</b>
                <span className="muted small">Scan the QR code at the entrance</span>
              </div>
              <Icon name="chevron" size={20} />
            </Link>
          )}
          <div className="stat" style={{ flex: 1 }}>
            <div className="streak">
              <span className={`flame ${streak > 0 ? 'on' : ''}`}><Icon name="flame" size={24} /></span>
              <div>
                <div className="stat-value"><CountUp value={streak} /></div>
                <div className="stat-label">day streak {streak >= 3 ? '— on fire!' : ''}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="stats stagger">
        <Stat label="Visits this month" icon="calendar" tone="primary" count={visits.thisMonth} />
        <Stat label="Total visits" icon="up" count={visits.total} />
        <Stat
          label="Days left"
          icon="clock"
          tone={current && current.days_left <= 7 ? 'warning' : undefined}
          value={current ? <CountUp value={current.days_left} /> : '—'}
          foot={current ? <span>of {current.total_days} days</span> : null}
        />
        <Stat
          label="Payment due"
          icon="wallet"
          tone={data.pendingAmount ? 'danger' : 'success'}
          count={data.pendingAmount}
          format={(n) => money(Math.round(n))}
          foot={data.pendingAmount ? <Link to="/me/history" className="small">View dues</Link> : <span>All paid</span>}
        />
      </div>

      <div className="bento stagger">
        <VisitCalendar calendar={data.calendar} today={data.today} className="span-5" />
        <WeeklyVisits weeks={data.weeks} className="span-7" height={260} />
      </div>

      <Card title={gym.name} sub={gym.address}>
        <div className="row gap wrap mb">
          {data.batch && (
            <span className="badge badge-info">
              Your batch: {data.batch.name} · {timeRange(data.batch.start_time, data.batch.end_time)}
            </span>
          )}
          {hoursText(gym) && (
            <span className="badge">
              Open {hoursText(gym)}
            </span>
          )}
        </div>
        <div className="row gap wrap">
          {gym.phone && <a className="btn btn-sm" href={`tel:${gym.phone}`}><Icon name="phone" size={15} /> {gym.phone}</a>}
          {gym.email && <a className="btn btn-sm" href={`mailto:${gym.email}`}>{gym.email}</a>}
        </div>
      </Card>
    </>
  );
}
