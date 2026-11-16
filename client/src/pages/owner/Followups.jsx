import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useApi } from '../../hooks.js';
import { date, REASONS, todayLocal } from '../../format.js';
import { Alert, Badge, Card, Empty, ErrorBox, Loading, PageHeader } from '../../components/ui.jsx';

export default function Followups() {
  const [status, setStatus] = useState('pending');
  const { data, loading, error, reload } = useApi('/followups', { status });
  const [actionError, setActionError] = useState(null);
  const today = todayLocal();

  const update = async (f, body) => {
    setActionError(null);
    try {
      await api(`/followups/${f.id}`, { method: 'PATCH', body });
      reload();
    } catch (err) {
      setActionError(err);
    }
  };

  const reschedule = (f) => {
    const next = window.prompt('New follow-up date (YYYY-MM-DD)', f.followup_date);
    if (next) update(f, { followupDate: next });
  };

  return (
    <>
      <PageHeader title="Follow-ups" subtitle="Add follow-ups from a member's profile." />
      <div className="tabs">
        <button type="button" className={status === 'pending' ? 'active' : ''} onClick={() => setStatus('pending')}>Pending</button>
        <button type="button" className={status === 'completed' ? 'active' : ''} onClick={() => setStatus('completed')}>Completed</button>
      </div>
      <ErrorBox error={error ?? actionError} onRetry={reload} />
      <Card>
        {loading && !data ? (
          <Loading />
        ) : data?.followups.length ? (
          <ul className="list">
            {data.followups.map((f) => {
              const overdue = f.status === 'pending' && f.followup_date < today;
              return (
                <li key={f.id}>
                  <div>
                    <Link to={`/owner/members/${f.member_id}`}><strong>{f.full_name}</strong></Link>{' '}
                    <a href={`tel:${f.phone}`} className="small">{f.phone}</a>
                    <div className="row gap wrap small">
                      <Badge tone="info">{REASONS[f.reason]}</Badge>
                      <span className={overdue ? 'text-danger' : 'muted'}>
                        {overdue ? 'Overdue · ' : ''}{date(f.followup_date)}
                      </span>
                    </div>
                    {f.remarks && <div className="muted small">{f.remarks}</div>}
                  </div>
                  {f.status === 'pending' ? (
                    <div className="row gap">
                      <button type="button" className="btn btn-sm" onClick={() => reschedule(f)}>Reschedule</button>
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => update(f, { status: 'completed' })}>Done</button>
                    </div>
                  ) : (
                    <button type="button" className="btn btn-sm" onClick={() => update(f, { status: 'pending' })}>Reopen</button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>{status === 'pending' ? 'No pending follow-ups.' : 'No completed follow-ups yet.'}</Empty>
        )}
      </Card>
      {status === 'pending' && (
        <Alert tone="info">
          Tip: the Dashboard lists members who are expiring soon, have unpaid fees, or haven't visited recently — add follow-ups for them from their profile.
        </Alert>
      )}
    </>
  );
}
