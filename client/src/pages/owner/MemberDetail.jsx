import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useApi, useForm } from '../../hooks.js';
import { addDays, date, dateTime, money, REASONS, todayLocal } from '../../format.js';
import { Alert, Avatar, Badge, Card, Empty, ErrorBox, Field, Loading, Modal, StatusBadge } from '../../components/ui.jsx';
import MemberForm from './MemberForm.jsx';

export default function MemberDetail() {
  const { id } = useParams();
  const { data, loading, error, reload } = useApi(`/members/${id}`);
  const [modal, setModal] = useState(null); // 'edit' | 'membership' | 'payment' | 'followup' | 'password'
  const [flash, setFlash] = useState('');

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  const { member, memberships, payments, attendance, followups } = data;

  const done = (msg) => {
    setModal(null);
    setFlash(msg);
    reload();
  };
  const close = () => setModal(null);
  const openDues = memberships.filter((m) => !m.is_cancelled && m.balance > 0);

  const cancelMembership = async (ms) => {
    if (!window.confirm(`Cancel the ${ms.plan_name} membership (${date(ms.start_date)} – ${date(ms.expiry_date)})?`)) return;
    try {
      await api(`/memberships/${ms.id}/cancel`, { method: 'PATCH' });
      done('Membership cancelled.');
    } catch (err) {
      setFlash(err.message);
    }
  };

  const completeFollowup = async (f) => {
    try {
      await api(`/followups/${f.id}`, { method: 'PATCH', body: { status: 'completed' } });
      done('Follow-up completed.');
    } catch (err) {
      setFlash(err.message);
    }
  };

  return (
    <>
      <p className="small"><Link to="/owner/members">← Members</Link></p>
      <div className="page-header">
        <div className="row gap">
          <Avatar name={member.full_name} size={56} />
          <div>
            <h1>{member.full_name}</h1>
            <div className="row gap wrap">
              <StatusBadge status={member.status} />
              {member.registered ? <Badge tone="success">App account</Badge> : <Badge tone="info">Not registered</Badge>}
              <span className="muted small">{member.total_visits} visits</span>
            </div>
          </div>
        </div>
        <div className="row gap wrap">
          <button type="button" className="btn" onClick={() => setModal('edit')}>Edit</button>
          <button type="button" className="btn btn-primary" onClick={() => setModal('membership')} disabled={!member.is_active}>
            + Membership
          </button>
        </div>
      </div>

      {flash && <Alert tone="info">{flash}</Alert>}

      <div className="grid-2">
        <Card title="Details">
          <dl className="details">
            <dt>Mobile</dt><dd><a href={`tel:${member.phone}`}>{member.phone}</a></dd>
            <dt>Email</dt><dd>{member.email}</dd>
            <dt>Joined</dt><dd>{date(member.joined_on)}</dd>
            <dt>Gender</dt><dd>{member.gender ?? '—'}</dd>
            <dt>Date of birth</dt><dd>{date(member.date_of_birth)}</dd>
            {member.notes && (<><dt>Notes</dt><dd>{member.notes}</dd></>)}
          </dl>
          {member.registered ? (
            <button type="button" className="btn btn-sm" onClick={() => setModal('password')}>Reset password</button>
          ) : (
            <p className="muted small">
              Ask the member to open the app, tap <em>Create your account</em> and register with <strong>{member.email}</strong>.
            </p>
          )}
        </Card>

        <Card
          title="Follow-ups"
          actions={<button type="button" className="btn btn-sm" onClick={() => setModal('followup')}>+ Add</button>}
        >
          {followups.length ? (
            <ul className="list">
              {followups.map((f) => (
                <li key={f.id}>
                  <div>
                    <strong>{REASONS[f.reason]}</strong> <span className="muted small">· {date(f.followup_date)}</span>
                    {f.remarks && <div className="muted small">{f.remarks}</div>}
                  </div>
                  {f.status === 'pending' ? (
                    <button type="button" className="btn btn-sm" onClick={() => completeFollowup(f)}>Done</button>
                  ) : (
                    <Badge tone="success">Done</Badge>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No follow-ups.</Empty>
          )}
        </Card>
      </div>

      <Card
        title="Memberships"
        actions={
          openDues.length > 0 && (
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setModal('payment')}>Record payment</button>
          )
        }
      >
        {memberships.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Plan</th><th>Period</th><th>Status</th><th className="right">Amount</th><th className="right">Balance</th><th /></tr>
              </thead>
              <tbody>
                {memberships.map((ms) => (
                  <tr key={ms.id}>
                    <td>{ms.plan_name}</td>
                    <td>{date(ms.start_date)} – {date(ms.expiry_date)}</td>
                    <td><StatusBadge status={ms.status} /></td>
                    <td className="right">{money(ms.amount)}</td>
                    <td className="right">
                      {ms.is_cancelled ? '—' : ms.balance > 0 ? <strong className="text-danger">{money(ms.balance)}</strong> : <Badge tone="success">Paid</Badge>}
                    </td>
                    <td className="right">
                      {!ms.is_cancelled && ms.status !== 'expired' && (
                        <button type="button" className="btn btn-link btn-sm" onClick={() => cancelMembership(ms)}>Cancel</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No memberships yet. Add one to let this member check in.</Empty>
        )}
      </Card>

      <div className="grid-2">
        <Card title="Payments">
          {payments.length ? (
            <ul className="list">
              {payments.map((p) => (
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
            <Empty>No payments recorded.</Empty>
          )}
        </Card>
        <Card title="Recent attendance">
          {attendance.length ? (
            <ul className="list compact">
              {attendance.map((a) => (
                <li key={a.id}>
                  <span>{date(a.check_in_date)}</span>
                  <span className="muted small">{dateTime(a.check_in_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No check-ins yet.</Empty>
          )}
        </Card>
      </div>

      <Modal open={modal === 'edit'} title="Edit member" onClose={close}>
        <MemberForm
          initial={member}
          registered={member.registered}
          onCancel={close}
          onSave={async (v) => {
            await api(`/members/${id}`, { method: 'PUT', body: v });
            done('Member updated.');
          }}
        />
      </Modal>
      <Modal open={modal === 'membership'} title="Add membership" onClose={close}>
        <MembershipForm memberId={member.id} memberships={memberships} onDone={() => done('Membership added.')} />
      </Modal>
      <Modal open={modal === 'payment'} title="Record payment" onClose={close}>
        <PaymentForm dues={openDues} onDone={() => done('Payment recorded.')} />
      </Modal>
      <Modal open={modal === 'followup'} title="Add follow-up" onClose={close}>
        <FollowupForm memberId={member.id} onDone={() => done('Follow-up added.')} />
      </Modal>
      <Modal open={modal === 'password'} title="Reset password" onClose={close}>
        <ResetPasswordForm memberId={member.id} onDone={() => done('Password reset. Share the new password with the member.')} />
      </Modal>
    </>
  );
}

function MembershipForm({ memberId, memberships, onDone }) {
  const { data } = useApi('/plans');
  // Default start: the day after the latest active/upcoming membership, else today.
  const latest = memberships
    .filter((m) => !m.is_cancelled && m.status !== 'expired')
    .reduce((max, m) => (m.expiry_date > max ? m.expiry_date : max), '');
  const f = useForm({ planId: '', startDate: latest ? addDays(latest, 1) : todayLocal(), amount: '' });
  const plan = data?.plans.find((p) => String(p.id) === String(f.values.planId));

  const submit = async (e) => {
    e.preventDefault();
    const ok = await f.submit((v) =>
      api('/memberships', {
        method: 'POST',
        body: { memberId, planId: Number(v.planId), startDate: v.startDate, amount: v.amount === '' ? undefined : Number(v.amount) },
      }),
    );
    if (ok) onDone();
  };

  return (
    <form onSubmit={submit} className="stack">
      {f.error && <Alert tone="danger">{f.error}</Alert>}
      <Field label="Plan" error={f.errors.planId}>
        <select value={f.values.planId} onChange={f.set('planId')} required>
          <option value="">Choose a plan</option>
          {data?.plans.map((p) => (
            <option key={p.id} value={p.id}>{p.name} — {money(p.price)}</option>
          ))}
        </select>
      </Field>
      {data && !data.plans.length && <Alert tone="warning">Create a plan first under <Link to="/owner/plans">Plans</Link>.</Alert>}
      <Field label="Start date" error={f.errors.startDate}>
        <input type="date" value={f.values.startDate} onChange={f.set('startDate')} required />
      </Field>
      <Field label="Amount" error={f.errors.amount} hint={plan ? `Leave empty to use the plan price (${money(plan.price)})` : 'Defaults to the plan price'}>
        <input type="number" min="0" step="0.01" inputMode="decimal" value={f.values.amount} onChange={f.set('amount')} />
      </Field>
      <button className="btn btn-primary" disabled={f.busy}>Add membership</button>
    </form>
  );
}

function PaymentForm({ dues, onDone }) {
  const first = dues[0];
  const f = useForm({ membershipId: first?.id ?? '', amount: first?.balance ?? '', method: 'cash', paidOn: todayLocal(), reference: '' });
  const selected = dues.find((d) => String(d.id) === String(f.values.membershipId));

  const choose = (e) => {
    const d = dues.find((x) => String(x.id) === e.target.value);
    f.setValues((s) => ({ ...s, membershipId: e.target.value, amount: d?.balance ?? '' }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const ok = await f.submit((v) =>
      api('/payments', {
        method: 'POST',
        body: { membershipId: Number(v.membershipId), amount: Number(v.amount), method: v.method, paidOn: v.paidOn, reference: v.reference },
      }),
    );
    if (ok) onDone();
  };

  return (
    <form onSubmit={submit} className="stack">
      {f.error && <Alert tone="danger">{f.error}</Alert>}
      <Field label="Membership" error={f.errors.membershipId}>
        <select value={f.values.membershipId} onChange={choose}>
          {dues.map((d) => (
            <option key={d.id} value={d.id}>
              {d.plan_name} ({date(d.start_date)}) — due {money(d.balance)}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid-2 tight">
        <Field label="Amount" error={f.errors.amount} hint={selected ? `Balance ${money(selected.balance)}` : null}>
          <input type="number" min="0.01" step="0.01" inputMode="decimal" value={f.values.amount} onChange={f.set('amount')} required />
        </Field>
        <Field label="Method" error={f.errors.method}>
          <select value={f.values.method} onChange={f.set('method')}>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
          </select>
        </Field>
        <Field label="Paid on" error={f.errors.paidOn}>
          <input type="date" value={f.values.paidOn} max={todayLocal()} onChange={f.set('paidOn')} />
        </Field>
        <Field label="Reference (UPI ID / receipt)" error={f.errors.reference}>
          <input value={f.values.reference} onChange={f.set('reference')} />
        </Field>
      </div>
      <button className="btn btn-primary" disabled={f.busy}>Record payment</button>
    </form>
  );
}

export function FollowupForm({ memberId, onDone }) {
  const f = useForm({ reason: 'general', remarks: '', followupDate: todayLocal() });
  const submit = async (e) => {
    e.preventDefault();
    const ok = await f.submit((v) => api('/followups', { method: 'POST', body: { memberId, ...v } }));
    if (ok) onDone();
  };
  return (
    <form onSubmit={submit} className="stack">
      {f.error && <Alert tone="danger">{f.error}</Alert>}
      <Field label="Reason" error={f.errors.reason}>
        <select value={f.values.reason} onChange={f.set('reason')}>
          {Object.entries(REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Field>
      <Field label="Follow-up date" error={f.errors.followupDate}>
        <input type="date" value={f.values.followupDate} onChange={f.set('followupDate')} />
      </Field>
      <Field label="Remarks" error={f.errors.remarks}>
        <textarea rows={3} value={f.values.remarks} onChange={f.set('remarks')} />
      </Field>
      <button className="btn btn-primary" disabled={f.busy}>Save follow-up</button>
    </form>
  );
}

function ResetPasswordForm({ memberId, onDone }) {
  const f = useForm({ newPassword: '' });
  const submit = async (e) => {
    e.preventDefault();
    const ok = await f.submit(async (v) => {
      await api(`/members/${memberId}/reset-password`, { method: 'POST', body: v });
      return true;
    });
    if (ok) onDone();
  };
  return (
    <form onSubmit={submit} className="stack">
      {f.error && <Alert tone="danger">{f.error}</Alert>}
      <Field label="New temporary password" error={f.errors.newPassword} hint="At least 8 characters. The member can change it under Profile.">
        <input value={f.values.newPassword} onChange={f.set('newPassword')} autoComplete="off" />
      </Field>
      <button className="btn btn-primary" disabled={f.busy}>Reset password</button>
    </form>
  );
}
