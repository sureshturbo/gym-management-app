import { useState } from 'react';
import { api } from '../../api.js';
import { useApi, useForm } from '../../hooks.js';
import { money, planDuration } from '../../format.js';
import { Alert, Badge, Card, Empty, ErrorBox, Field, Loading, Modal, PageHeader } from '../../components/ui.jsx';

const PRESETS = {
  monthly: ['month', 1],
  quarterly: ['month', 3],
  'half-yearly': ['month', 6],
  yearly: ['month', 12],
  custom: null,
};

function presetOf(plan) {
  const hit = Object.entries(PRESETS).find(([, v]) => v && v[0] === plan.duration_unit && v[1] === plan.duration_value);
  return hit ? hit[0] : 'custom';
}

export default function Plans() {
  const { data, loading, error, reload } = useApi('/plans', { includeInactive: true });
  const [editing, setEditing] = useState(null); // plan object, or {} for new

  return (
    <>
      <PageHeader
        title="Membership plans"
        actions={<button type="button" className="btn btn-primary" onClick={() => setEditing({})}>+ New plan</button>}
      />
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? (
        <Loading />
      ) : data?.plans.length ? (
        <div className="plan-grid stagger">
          {data.plans.map((p) => (
            <Card key={p.id} className={`plan-card hover ${p.is_active ? '' : 'faded'}`}>
              <div className="row between">
                <h2>{p.name}</h2>
                {!p.is_active && <Badge>Hidden</Badge>}
              </div>
              <div className="plan-price">{money(p.price)}</div>
              <div className="muted">{planDuration(p)}</div>
              {p.description && <p className="small">{p.description}</p>}
              <button type="button" className="btn btn-sm mt" onClick={() => setEditing(p)}>Edit</button>
            </Card>
          ))}
        </div>
      ) : (
        <Card><Empty>No plans yet. Create Monthly, Quarterly, Half-yearly or Yearly plans to get started.</Empty></Card>
      )}

      <Modal open={editing !== null} title={editing?.id ? 'Edit plan' : 'New plan'} onClose={() => setEditing(null)}>
        {editing && (
          <PlanForm
            plan={editing}
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

function PlanForm({ plan, onDone }) {
  const isNew = !plan.id;
  const f = useForm({
    preset: isNew ? 'monthly' : presetOf(plan),
    name: plan.name ?? 'Monthly',
    duration_unit: plan.duration_unit ?? 'month',
    duration_value: plan.duration_value ?? 1,
    price: plan.price ?? '',
    description: plan.description ?? '',
    is_active: plan.is_active ?? true,
  });

  const choosePreset = (e) => {
    const preset = e.target.value;
    const v = PRESETS[preset];
    f.setValues((s) => ({
      ...s,
      preset,
      ...(v ? { duration_unit: v[0], duration_value: v[1] } : { duration_unit: 'day', duration_value: 30 }),
      name: isNew && v ? preset[0].toUpperCase() + preset.slice(1) : s.name,
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const ok = await f.submit(async ({ preset, ...v }) => {
      const body = { ...v, duration_value: Number(v.duration_value), price: Number(v.price), is_active: Boolean(v.is_active) };
      await api(isNew ? '/plans' : `/plans/${plan.id}`, { method: isNew ? 'POST' : 'PUT', body });
      return true;
    });
    if (ok) onDone();
  };

  return (
    <form onSubmit={submit} className="stack">
      {f.error && <Alert tone="danger">{f.error}</Alert>}
      <Field label="Type">
        <select value={f.values.preset} onChange={choosePreset}>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly (3 months)</option>
          <option value="half-yearly">Half-yearly (6 months)</option>
          <option value="yearly">Yearly (12 months)</option>
          <option value="custom">Custom duration</option>
        </select>
      </Field>
      {f.values.preset === 'custom' && (
        <div className="grid-2 tight">
          <Field label="Duration" error={f.errors.duration_value}>
            <input type="number" min="1" value={f.values.duration_value} onChange={f.set('duration_value')} />
          </Field>
          <Field label="Unit">
            <select value={f.values.duration_unit} onChange={f.set('duration_unit')}>
              <option value="day">Days</option>
              <option value="month">Months</option>
            </select>
          </Field>
        </div>
      )}
      <Field label="Plan name" error={f.errors.name}>
        <input value={f.values.name} onChange={f.set('name')} required />
      </Field>
      <Field label="Price (₹)" error={f.errors.price}>
        <input type="number" min="0" step="0.01" inputMode="decimal" value={f.values.price} onChange={f.set('price')} required />
      </Field>
      <Field label="Description" error={f.errors.description}>
        <input value={f.values.description} onChange={f.set('description')} />
      </Field>
      {!isNew && (
        <label className="check">
          <input type="checkbox" checked={Boolean(f.values.is_active)} onChange={f.set('is_active')} />
          Offer this plan (uncheck to hide it from new memberships)
        </label>
      )}
      <button className="btn btn-primary" disabled={f.busy}>{isNew ? 'Create plan' : 'Save plan'}</button>
    </form>
  );
}
