import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks.js';
import { addDays, date, time, todayLocal } from '../../format.js';
import { Card, Empty, ErrorBox, Loading, PageHeader, Stat } from '../../components/ui.jsx';

export default function Attendance() {
  const [day, setDay] = useState(todayLocal());
  const { data, loading, error, reload } = useApi('/attendance', { date: day });

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={date(day)}
        actions={
          <>
            <button type="button" className="btn" onClick={() => setDay(addDays(day, -1))} aria-label="Previous day">‹</button>
            <input type="date" value={day} max={todayLocal()} onChange={(e) => e.target.value && setDay(e.target.value)} />
            <button type="button" className="btn" onClick={() => setDay(addDays(day, 1))} disabled={day >= todayLocal()} aria-label="Next day">›</button>
            <button type="button" className="btn" onClick={reload}>Refresh</button>
          </>
        }
      />
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? (
        <Loading />
      ) : (
        data && (
          <>
            <div className="stats">
              <Stat label="Present" value={data.present} tone="primary" />
              <Stat label="Active members" value={data.activeMembers} />
              <Stat
                label="Turnout"
                value={data.activeMembers ? `${Math.round((data.present / data.activeMembers) * 100)}%` : '—'}
              />
            </div>
            <Card title="Checked in">
              {data.records.length ? (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr><th>#</th><th>Member</th><th>Time</th><th className="hide-sm">Phone</th><th className="right hide-sm">Distance</th></tr>
                    </thead>
                    <tbody>
                      {data.records.map((r, i) => (
                        <tr key={r.id}>
                          <td className="muted">{i + 1}</td>
                          <td><Link to={`/owner/members/${r.member_id}`}>{r.full_name}</Link></td>
                          <td>{time(r.check_in_at)}</td>
                          <td className="hide-sm">{r.phone}</td>
                          <td className="right hide-sm">{r.distance_m != null ? `${r.distance_m} m` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty>No check-ins on this day.</Empty>
              )}
            </Card>
          </>
        )
      )}
    </>
  );
}
