import { useState } from 'react';
import { useApi } from '../../hooks.js';
import { date, money, time } from '../../format.js';
import { Badge, Card, Empty, ErrorBox, Loading, PageHeader, Stat } from '../../components/ui.jsx';

export default function History() {
  const [tab, setTab] = useState('attendance');
  return (
    <>
      <PageHeader title="History" />
      <div className="tabs">
        <button type="button" className={tab === 'attendance' ? 'active' : ''} onClick={() => setTab('attendance')}>Attendance</button>
        <button type="button" className={tab === 'payments' ? 'active' : ''} onClick={() => setTab('payments')}>Payments</button>
      </div>
      {tab === 'attendance' ? <AttendanceHistory /> : <PaymentHistory />}
    </>
  );
}

function AttendanceHistory() {
  const { data, loading, error, reload } = useApi('/attendance/me');
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  return (
    <>
      <div className="stats">
        <Stat label="This month" value={data.thisMonth} tone="primary" />
        <Stat label="All time" value={data.total} />
      </div>
      <Card>
        {data.records.length ? (
          <ul className="list compact">
            {data.records.map((r) => (
              <li key={r.check_in_date}>
                <span>{date(r.check_in_date)}</span>
                <span className="muted small">{time(r.check_in_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No check-ins yet.</Empty>
        )}
      </Card>
    </>
  );
}

function PaymentHistory() {
  const { data, loading, error, reload } = useApi('/payments/me');
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  return (
    <>
      {data.dues.length > 0 && (
        <Card title="Due">
          <ul className="list">
            {data.dues.map((d) => (
              <li key={d.membership_id}>
                <div>
                  <strong>{d.plan_name}</strong>
                  <div className="muted small">{date(d.start_date)} – {date(d.expiry_date)}</div>
                </div>
                <div className="right">
                  <strong className="text-danger">{money(d.balance)}</strong>
                  {d.overdue && <div><Badge tone="danger">Overdue</Badge></div>}
                </div>
              </li>
            ))}
          </ul>
          <p className="muted small">Pay at the front desk by cash or UPI.</p>
        </Card>
      )}
      <Card title="Paid">
        {data.payments.length ? (
          <ul className="list">
            {data.payments.map((p) => (
              <li key={p.id}>
                <div>
                  <strong>{money(p.amount)}</strong> <Badge>{p.method.toUpperCase()}</Badge>
                  <div className="muted small">{p.plan_name}{p.reference ? ` · Ref ${p.reference}` : ''}</div>
                </div>
                <span className="muted small">{date(p.paid_on)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No payments yet.</Empty>
        )}
      </Card>
    </>
  );
}
