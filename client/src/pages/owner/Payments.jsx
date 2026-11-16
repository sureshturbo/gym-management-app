import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks.js';
import { date, money, todayLocal } from '../../format.js';
import { Badge, Card, Empty, ErrorBox, Loading, PageHeader, Stat } from '../../components/ui.jsx';

export default function Payments() {
  const [tab, setTab] = useState('pending');
  return (
    <>
      <PageHeader title="Payments" subtitle="Record payments from a member's profile." />
      <div className="tabs">
        <button type="button" className={tab === 'pending' ? 'active' : ''} onClick={() => setTab('pending')}>Pending & overdue</button>
        <button type="button" className={tab === 'collected' ? 'active' : ''} onClick={() => setTab('collected')}>Collected</button>
      </div>
      {tab === 'pending' ? <Pending /> : <Collected />}
    </>
  );
}

function Pending() {
  const [overdueOnly, setOverdueOnly] = useState(false);
  const { data, loading, error, reload } = useApi('/payments/dues');
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  const rows = overdueOnly ? data.dues.filter((d) => d.overdue) : data.dues;

  return (
    <>
      <div className="stats">
        <Stat label="Total pending" value={money(data.totalPending)} tone="warning" />
        <Stat label="Overdue" value={money(data.totalOverdue)} tone="danger" />
        <Stat label="Members with dues" value={new Set(data.dues.map((d) => d.member_id)).size} />
      </div>
      <Card
        title="Unpaid balances"
        actions={
          <label className="check small">
            <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} /> Overdue only
          </label>
        }
      >
        {rows.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Member</th><th>Plan</th><th className="hide-sm">Started</th><th className="right">Paid</th><th className="right">Balance</th></tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.membership_id}>
                    <td>
                      <Link to={`/owner/members/${d.member_id}`}>{d.full_name}</Link>
                      <div className="muted small">{d.phone}</div>
                    </td>
                    <td>{d.plan_name}</td>
                    <td className="hide-sm">{date(d.start_date)}</td>
                    <td className="right">{money(d.paid)} / {money(d.amount)}</td>
                    <td className="right">
                      <strong>{money(d.balance)}</strong> {d.overdue && <Badge tone="danger">Overdue</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No pending payments.</Empty>
        )}
      </Card>
    </>
  );
}

function Collected() {
  const today = todayLocal();
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [method, setMethod] = useState('');
  const { data, loading, error, reload } = useApi('/payments', { from, to, method });

  return (
    <Card
      title={data ? `Collected: ${money(data.total)}` : 'Collected'}
      actions={
        <div className="row gap wrap">
          <input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} aria-label="From" />
          <input type="date" value={to} min={from} max={today} onChange={(e) => e.target.value && setTo(e.target.value)} aria-label="To" />
          <select value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Method">
            <option value="">All methods</option>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
          </select>
        </div>
      }
    >
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? (
        <Loading />
      ) : data?.payments.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Date</th><th>Member</th><th className="hide-sm">Plan</th><th>Method</th><th className="right">Amount</th></tr>
            </thead>
            <tbody>
              {data.payments.map((p) => (
                <tr key={p.id}>
                  <td>{date(p.paid_on)}</td>
                  <td><Link to={`/owner/members/${p.member_id}`}>{p.full_name}</Link></td>
                  <td className="hide-sm">{p.plan_name}</td>
                  <td><Badge>{p.method.toUpperCase()}</Badge>{p.reference && <div className="muted small">{p.reference}</div>}</td>
                  <td className="right">{money(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>No payments in this period.</Empty>
      )}
    </Card>
  );
}
