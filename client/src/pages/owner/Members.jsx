import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import { useApi } from '../../hooks.js';
import { date } from '../../format.js';
import { Avatar, Badge, Card, Empty, ErrorBox, Loading, Modal, PageHeader, StatusBadge } from '../../components/ui.jsx';
import MemberForm from './MemberForm.jsx';
import Icon from '../../components/Icon.jsx';

const FILTERS = [
  ['', 'All'],
  ['active', 'Active'],
  ['expired', 'Expired'],
  ['pending', 'Upcoming'],
  ['no_plan', 'No plan'],
  ['invited', 'Not registered'],
  ['inactive', 'Inactive'],
];

export default function Members() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, loading, error, reload } = useApi('/members', { search: debounced, status });

  const add = async (values) => {
    const { id } = await api('/members', { method: 'POST', body: values });
    setAdding(false);
    navigate(`/owner/members/${id}`);
  };

  return (
    <>
      <PageHeader
        title="Members"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
<Icon name="plus" size={17} /> Add member
          </button>
        }
      />
      <Card>
        <div className="toolbar">
          <div className="input-icon">
            <Icon name="search" size={17} />
            <input
              type="search"
              placeholder="Search name, phone or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search members"
            />
          </div>
          <div className="chips">
            {FILTERS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`chip ${status === value ? 'chip-active' : ''}`}
                onClick={() => setStatus(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <ErrorBox error={error} onRetry={reload} />
        {loading && !data ? (
          <Loading />
        ) : data?.members.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Status</th>
                  <th className="hide-sm">Valid until</th>
                  <th className="hide-sm">Last visit</th>
                </tr>
              </thead>
              <tbody>
                {data.members.map((m) => (
                  <tr key={m.id} className="clickable" onClick={() => navigate(`/owner/members/${m.id}`)}>
                    <td>
                      <div className="row gap">
                        <Avatar name={m.full_name} size={34} />
                        <div>
                          <Link to={`/owner/members/${m.id}`} onClick={(e) => e.stopPropagation()}>
                            {m.full_name}
                          </Link>
                          <div className="muted small">{m.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={m.status} /> {!m.registered && <Badge tone="info">Invited</Badge>}
                    </td>
                    <td className="hide-sm">{date(m.current_expiry)}</td>
                    <td className="hide-sm">{date(m.last_visit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>{debounced || status ? 'No members match.' : 'No members yet. Add your first member.'}</Empty>
        )}
      </Card>

      <Modal open={adding} title="Add member" onClose={() => setAdding(false)}>
        <MemberForm onSave={add} onCancel={() => setAdding(false)} />
      </Modal>
    </>
  );
}
