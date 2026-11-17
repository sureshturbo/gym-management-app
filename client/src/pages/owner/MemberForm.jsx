import { useApi, useForm } from '../../hooks.js';
import { BATCH_FOR, timeRange, todayLocal } from '../../format.js';
import { Alert, Field } from '../../components/ui.jsx';

/** Add / edit member form. `onSave(values)` should call the API and may throw. */
export default function MemberForm({ initial, onSave, onCancel, registered }) {
  const f = useForm({
    full_name: '',
    phone: '',
    email: '',
    gender: '',
    batch_id: '',
    date_of_birth: '',
    joined_on: todayLocal(),
    notes: '',
    is_active: true,
    ...initial,
    batch_id: initial?.batch_id ?? '',
  });
  const editing = Boolean(initial);
  const batches = useApi('/batches', { includeInactive: false }).data?.batches ?? [];
  const g = f.values.gender;
  // Only batches open to this member's gender; the current one stays listed so it isn't silently dropped.
  const choices = batches.filter((b) => b.gender === 'any' || !g || b.gender === g || b.id === Number(f.values.batch_id));

  const submit = (e) => {
    e.preventDefault();
    f.submit(onSave);
  };

  return (
    <form onSubmit={submit} className="stack" noValidate>
      {f.error && <Alert tone="danger">{f.error}</Alert>}
      <Field label="Full name" error={f.errors.full_name}>
        <input value={f.values.full_name} onChange={f.set('full_name')} required />
      </Field>
      <div className="grid-2 tight">
        <Field label="Mobile number" error={f.errors.phone}>
          <input type="tel" value={f.values.phone} onChange={f.set('phone')} required />
        </Field>
        <Field
          label="Email"
          error={f.errors.email}
          hint={registered ? 'Locked: the member has registered' : 'The member registers in the app with this email'}
        >
          <input type="email" value={f.values.email} onChange={f.set('email')} disabled={registered} required />
        </Field>
        <Field label="Gender" error={f.errors.gender}>
          <select value={f.values.gender ?? ''} onChange={f.set('gender')} required>
            <option value="" disabled>Select…</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field
          label="Batch"
          error={f.errors.batch_id}
          hint={batches.length ? undefined : 'Create batches under Batches & timing'}
        >
          <select value={f.values.batch_id} onChange={f.set('batch_id')}>
            <option value="">No batch</option>
            {choices.map((b) => {
              const full = b.capacity != null && b.member_count >= b.capacity && b.id !== initial?.batch_id;
              return (
                <option key={b.id} value={b.id} disabled={full}>
                  {b.name} · {timeRange(b.start_time, b.end_time)}
                  {b.gender !== 'any' ? ` · ${BATCH_FOR[b.gender]}` : ''}
                  {b.capacity != null ? ` · ${b.member_count}/${b.capacity}${full ? ' full' : ''}` : ''}
                </option>
              );
            })}
          </select>
        </Field>
        <Field label="Date of birth" error={f.errors.date_of_birth}>
          <input type="date" value={f.values.date_of_birth ?? ''} onChange={f.set('date_of_birth')} />
        </Field>
        <Field label="Joining date" error={f.errors.joined_on}>
          <input type="date" value={f.values.joined_on} onChange={f.set('joined_on')} />
        </Field>
      </div>
      <Field label="Notes" error={f.errors.notes}>
        <textarea rows={2} value={f.values.notes ?? ''} onChange={f.set('notes')} />
      </Field>
      {editing && (
        <label className="check">
          <input type="checkbox" checked={Boolean(f.values.is_active)} onChange={f.set('is_active')} />
          Active (unchecking also blocks the member's login)
        </label>
      )}
      <div className="row gap end">
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button className="btn btn-primary" disabled={f.busy}>
          {editing ? 'Save changes' : 'Add member'}
        </button>
      </div>
    </form>
  );
}
