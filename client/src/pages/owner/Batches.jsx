import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useApi, useForm } from '../../hooks.js';
import { BATCH_FOR, DAYS, hoursText, timeRange } from '../../format.js';
import Icon from '../../components/Icon.jsx';
import { Alert, Badge, Card, Empty, ErrorBox, Field, Loading, Modal, PageHeader } from '../../components/ui.jsx';

export default function Batches() {
  const gym = useApi('/gym');
  const { data, loading, error, reload } = useApi('/batches');
  const [editing, setEditing] = useState(null); // batch object, or {} for new

  return (
    <>
      <PageHeader
        title="Batches & timing"
        subtitle="Gym opening hours and the training batches members are assigned to."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing({})}>
            <Icon name="plus" size={17} /> New batch
          </button>
        }
      />
      <ErrorBox error={gym.error || error} onRetry={reload} />

      {gym.data ? <HoursCard gym={gym.data.gym} /> : <Loading />}

      {loading && !data ? (
        <Loading />
      ) : data?.batches.length ? (
        <div className="plan-grid stagger">
          {data.batches.map((b) => (
            <BatchCard key={b.id} batch={b} onEdit={() => setEditing(b)} />
          ))}
        </div>
      ) : (
        <Card>
          <Empty>No batches yet. Add time slots such as Morning 6–8 am, Ladies 10–11:30 am or Evening 6–8 pm.</Empty>
        </Card>
      )}

      <Modal open={editing !== null} title={editing?.id ? 'Edit batch' : 'New batch'} onClose={() => setEditing(null)}>
        {editing && (
          <BatchForm
            batch={editing}
            onDone={() => {
              setEditing(null);
              reload();
            }}
          />
        )}
      </Modal>
    </>
  );
}

function BatchCard({ batch: b, onEdit }) {
  const pct = b.capacity ? Math.min(100, Math.round((b.member_count / b.capacity) * 100)) : null;
  return (
    <Card className={`plan-card hover ${b.is_active ? '' : 'faded'}`}>
      <div className="row between">
        <h2>{b.name}</h2>
        {!b.is_active ? <Badge>Hidden</Badge> : b.gender !== 'any' && <Badge tone="info">{BATCH_FOR[b.gender]}</Badge>}
      </div>
      <div className="batch-time">{timeRange(b.start_time, b.end_time)}</div>
      <div className="batch-meta">
        <Link to={`/owner/members?batch=${b.id}`} className="small">
          <b>{b.member_count}</b> member{b.member_count === 1 ? '' : 's'}
          {b.capacity ? ` of ${b.capacity}` : ''}
        </Link>
        <span className="small muted">{b.today_count} checked in today</span>
      </div>
      {pct != null && (
        <div
          className="hbar-track batch-fill"
          role="img"
          aria-label={`${pct}% full`}
          title={`${pct}% full`}
        >
          <span className="hbar-fill" style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--danger)' : undefined }} />
        </div>
      )}
      <button type="button" className="btn btn-sm mt" onClick={onEdit}>Edit</button>
    </Card>
  );
}

function BatchForm({ batch, onDone }) {
  const isNew = !batch.id;
  const f = useForm({
    name: batch.name ?? '',
    start_time: batch.start_time ?? '06:00',
    end_time: batch.end_time ?? '08:00',
    gender: batch.gender ?? 'any',
    capacity: batch.capacity ?? '',
    is_active: batch.is_active ?? true,
  });

  const submit = async (e) => {
    e.preventDefault();
    const ok = await f.submit(async (v) => {
      await api(isNew ? '/batches' : `/batches/${batch.id}`, { method: isNew ? 'POST' : 'PUT', body: v });
      return true;
    });
    if (ok) onDone();
  };

  const remove = async () => {
    const who = batch.member_count ? ` Its ${batch.member_count} member(s) will be left without a batch.` : '';
    if (!window.confirm(`Delete the ${batch.name} batch?${who}`)) return;
    const ok = await f.submit(async () => {
      await api(`/batches/${batch.id}`, { method: 'DELETE' });
      return true;
    });
    if (ok) onDone();
  };

  return (
    <form onSubmit={submit} className="stack">
      {f.error && <Alert tone="danger">{f.error}</Alert>}
      <Field label="Batch name" error={f.errors.name}>
        <input value={f.values.name} onChange={f.set('name')} placeholder="e.g. Morning" required />
      </Field>
      <div className="grid-2 tight">
        <Field label="Starts" error={f.errors.start_time}>
          <input type="time" value={f.values.start_time} onChange={f.set('start_time')} required />
        </Field>
        <Field label="Ends" error={f.errors.end_time}>
          <input type="time" value={f.values.end_time} onChange={f.set('end_time')} required />
        </Field>
        <Field label="Open to" error={f.errors.gender}>
          <select value={f.values.gender} onChange={f.set('gender')}>
            <option value="any">Everyone</option>
            <option value="female">Women only</option>
            <option value="male">Men only</option>
          </select>
        </Field>
        <Field label="Max members" error={f.errors.capacity} hint="Leave empty for no limit">
          <input type="number" min="1" value={f.values.capacity} onChange={f.set('capacity')} />
        </Field>
      </div>
      {!isNew && (
        <label className="check">
          <input type="checkbox" checked={Boolean(f.values.is_active)} onChange={f.set('is_active')} />
          Offer this batch (uncheck to hide it when adding members)
        </label>
      )}
      <div className="row gap between">
        {!isNew ? (
          <button type="button" className="btn btn-ghost" onClick={remove} disabled={f.busy}>Delete</button>
        ) : <span />}
        <button className="btn btn-primary" disabled={f.busy}>{isNew ? 'Create batch' : 'Save batch'}</button>
      </div>
    </form>
  );
}

function HoursCard({ gym }) {
  const f = useForm({
    open_time: gym.open_time ?? '',
    close_time: gym.close_time ?? '',
    closed_days: gym.closed_days ?? [],
  });
  const [saved, setSaved] = useState(gym);

  const toggleDay = (d) =>
    f.setValues((s) => ({
      ...s,
      closed_days: s.closed_days.includes(d) ? s.closed_days.filter((x) => x !== d) : [...s.closed_days, d],
    }));

  const submit = async (e) => {
    e.preventDefault();
    const d = await f.submit((v) => api('/gym/hours', { method: 'PUT', body: v }));
    if (d) setSaved(d.hours);
  };

  return (
    <Card title="Gym timing" sub={hoursText(saved) || 'Not set yet — members see this on their home screen'}>
      <form onSubmit={submit} className="stack">
        {f.error && <Alert tone="danger">{f.error}</Alert>}
        <div className="row gap wrap" style={{ alignItems: 'flex-end' }}>
          <Field label="Opens" error={f.errors.open_time}>
            <input type="time" value={f.values.open_time} onChange={f.set('open_time')} />
          </Field>
          <Field label="Closes" error={f.errors.close_time}>
            <input type="time" value={f.values.close_time} onChange={f.set('close_time')} />
          </Field>
        </div>
        <div>
          <div className="field-label">Closed on</div>
          <div className="chips" style={{ marginTop: 6 }}>
            {DAYS.map(([d, label]) => (
              <button
                key={d}
                type="button"
                className={`chip ${f.values.closed_days.includes(d) ? 'chip-active' : ''}`}
                aria-pressed={f.values.closed_days.includes(d)}
                onClick={() => toggleDay(d)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <button className="btn btn-primary" disabled={f.busy}>Save timing</button>
        </div>
      </form>
    </Card>
  );
}
