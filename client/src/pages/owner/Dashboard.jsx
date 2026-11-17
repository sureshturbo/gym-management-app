import { Link } from 'react-router-dom';
import { useAuth } from '../../auth.jsx';
import { useApi } from '../../hooks.js';
import { date, money, REASONS } from '../../format.js';
import Icon from '../../components/Icon.jsx';
import { Avatar, Badge, Card, CountUp, Delta, Empty, ErrorBox, Skeleton, Stat } from '../../components/ui.jsx';
import {
  AttendanceTrend,
  BatchesToday,
  GenderTrend,
  MemberMix,
  PeakHours,
  PlanPopularity,
  RevenueBars,
} from '../../components/charts.jsx';
import GenderSpotlight from '../../components/GenderSpotlight.jsx';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

const MemberRow = ({ id, name, photo, sub, right }) => (
  <li>
    <Link to={`/owner/members/${id}`} className="who" style={{ color: 'inherit', textDecoration: 'none' }}>
      <Avatar name={name} photo={photo} size={36} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700 }}>{name}</div>
        <div className="muted small">{sub}</div>
      </div>
    </Link>
    {right}
  </li>
);

export default function OwnerDashboard() {
  const { user } = useAuth();
  const { data, error, reload } = useApi('/dashboard/owner');
  const charts = useApi('/dashboard/owner/charts');

  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Skeleton stats={4} blocks={2} />;
  const { stats, expiring, absent, followupsDue, dues, gender, batches } = data;

  return (
    <>
      <div className="greet">
        <div className="eyebrow muted small" style={{ fontWeight: 600 }}>{date(data.today)}</div>
        <h1>{greeting()}, {user.name.split(' ')[0]} 👋</h1>
        <p className="muted">
          {stats.today_attendance} check-in{stats.today_attendance === 1 ? '' : 's'} so far today
          {followupsDue.length ? ` · ${followupsDue.length} follow-up${followupsDue.length === 1 ? '' : 's'} due` : ''}
          {expiring.length ? ` · ${expiring.length} expiring this week` : ''}
        </p>
      </div>

      <div className="stats stagger">
        <div className="stat stat-hero">
          <div className="stat-top">
            <div className="stat-label">Today's check-ins</div>
            <span className="stat-icon"><Icon name="calendar" size={19} /></span>
          </div>
          <div className="stat-value"><CountUp value={stats.today_attendance} /></div>
          {/* Today is still in progress, so show yesterday's total rather than a % change */}
          <div className="stat-foot">
            Men {gender.male.today} · Women {gender.female.today} · Yesterday {stats.yesterday_attendance}
          </div>
        </div>
        <Stat
          label="Active members"
          icon="users"
          tone="primary"
          count={stats.active_members}
          foot={<span>of {stats.total_members} total · +{stats.new_members_week} this week</span>}
        />
        <Stat
          label="Collected this month"
          icon="rupee"
          tone="success"
          count={stats.month_collection}
          format={(n) => money(Math.round(n))}
          foot={<><Delta now={stats.month_collection} before={stats.last_month_collection} /> vs last month</>}
        />
        <Stat
          label="Pending dues"
          icon="wallet"
          tone={stats.pending_amount ? 'warning' : 'success'}
          count={stats.pending_amount}
          format={(n) => money(Math.round(n))}
          foot={stats.overdue_count ? <Badge tone="danger">{stats.overdue_count} overdue</Badge> : <span>All on time</span>}
        />
      </div>

      <div className="bento stagger">
        <GenderSpotlight
          gender={gender}
          expiring={expiring}
          dues={dues}
          attendance={charts.data?.attendance}
          className="span-12"
        />
      </div>

      {charts.error && <ErrorBox error={charts.error} onRetry={charts.reload} />}
      {charts.data ? (
        <>
          <div className="bento stagger">
            <AttendanceTrend data={charts.data.attendance} className="span-8" />
            <MemberMix mix={charts.data.mix} className="span-4" />
          </div>
          <div className="bento stagger">
            <GenderTrend data={charts.data.attendance} className={batches.length ? 'span-7' : 'span-12'} />
            {batches.length > 0 && <BatchesToday batches={batches} className="span-5" />}
          </div>
          <div className="bento stagger">
            <RevenueBars data={charts.data.revenue} className="span-7" />
            <PeakHours data={charts.data.peakHours} className="span-5" />
          </div>
        </>
      ) : (
        !charts.error && <Skeleton stats={0} blocks={1} />
      )}


      <div className="bento stagger">
        <Card title="Expiring soon" sub="Not yet renewed" className="span-6" actions={<Badge tone="warning">{expiring.length}</Badge>}>
          {expiring.length ? (
            <ul className="list">
              {expiring.map((e) => (
                <MemberRow
                  key={`${e.member_id}-${e.expiry_date}`}
                  id={e.member_id}
                  name={e.full_name}
                  photo={e.photo_key}
                  sub={`${e.plan_name} · ${e.phone}`}
                  right={<Badge tone={e.days_left <= 2 ? 'danger' : 'warning'}>{e.days_left === 0 ? 'Today' : `${e.days_left}d left`}</Badge>}
                />
              ))}
            </ul>
          ) : (
            <Empty>No memberships expiring in the next week.</Empty>
          )}
        </Card>

        <Card title="Follow-ups due" className="span-6" actions={<Link to="/owner/followups" className="small">View all</Link>}>
          {followupsDue.length ? (
            <ul className="list">
              {followupsDue.map((f) => (
                <MemberRow
                  key={f.id}
                  id={f.member_id}
                  name={f.full_name}
                  photo={f.photo_key}
                  sub={`${REASONS[f.reason]}${f.remarks ? ` — ${f.remarks}` : ''}`}
                  right={<span className="muted small nowrap">{date(f.followup_date)}</span>}
                />
              ))}
            </ul>
          ) : (
            <Empty>Nothing due today. 🎉</Empty>
          )}
        </Card>

        <Card title="Pending payments" className="span-6" actions={<Link to="/owner/payments" className="small">View all</Link>}>
          {dues.length ? (
            <ul className="list">
              {dues.slice(0, 6).map((d) => (
                <MemberRow
                  key={d.membership_id}
                  id={d.member_id}
                  name={d.full_name}
                  photo={d.photo_key}
                  sub={`${d.plan_name} · since ${date(d.start_date)}`}
                  right={
                    <div className="right">
                      <strong>{money(d.balance)}</strong>
                      {d.overdue && <div><Badge tone="danger">Overdue</Badge></div>}
                    </div>
                  }
                />
              ))}
            </ul>
          ) : (
            <Empty>All fees collected.</Empty>
          )}
        </Card>

        {charts.data ? <PlanPopularity plans={charts.data.plans} className="span-6" /> : <div className="span-6" />}

        <Card title="Not visiting" sub={`Active members away 5+ days`} className="span-12" actions={<Badge>{absent.length}</Badge>}>
          {absent.length ? (
            <ul className="list">
              {absent.slice(0, 8).map((a) => (
                <MemberRow
                  key={a.member_id}
                  id={a.member_id}
                  name={a.full_name}
                  photo={a.photo_key}
                  sub={a.phone}
                  right={<span className="muted small nowrap">{a.last_visit ? `${a.days_absent} days ago` : 'Never checked in'}</span>}
                />
              ))}
            </ul>
          ) : (
            <Empty>Every active member has visited recently.</Empty>
          )}
        </Card>
      </div>
    </>
  );
}
