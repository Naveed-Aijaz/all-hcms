import { Fragment, useState } from 'react';
import { api } from '../api.js';
import { useFetch, fmtDateTime } from '../hooks.js';
import { Async, Card, PageHeader, Pagination } from '../components/ui.jsx';

export default function AuditLog() {
  const [q, setQ] = useState({ entity: '', action: '', page: 1 });
  const [open, setOpen] = useState(null);
  const state = useFetch(() => api.get('/audit', { ...q, limit: 25 }), [q.entity, q.action, q.page]);
  return (
    <>
      <PageHeader title="Audit log" />
      <Card>
        <p className="muted">Append-only record of who changed what. Entries cannot be edited or deleted.</p>
        <div className="filters">
          <label>Entity <select value={q.entity} onChange={(e) => setQ({ ...q, entity: e.target.value, page: 1 })}><option value="">All</option>{['employee', 'user', 'leave', 'attendance', 'correction', 'payroll', 'settings', 'department', 'designation', 'leave_type', 'holiday', 'announcement', 'company'].map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>Action <input value={q.action} placeholder="e.g. payroll.finalize" onChange={(e) => setQ({ ...q, action: e.target.value.trim(), page: 1 })} /></label>
        </div>
        <Async state={state} empty={(d) => d.data.length === 0}>{(d) => (
          <>
            <div className="table-wrap"><table><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Summary</th><th /></tr></thead><tbody>
              {d.data.map((a) => (
                <Fragment key={a.id}>
                  <tr><td>{fmtDateTime(a.createdAt)}</td><td>{a.actor} <small className="muted">{a.role}</small></td><td><code>{a.action}</code></td><td>{a.summary}</td><td>{(a.before || a.after) && <button className="link-btn" onClick={() => setOpen(open === a.id ? null : a.id)}>{open === a.id ? 'Hide' : 'Details'}</button>}</td></tr>
                  {open === a.id && <tr><td colSpan={5}><div className="grid2"><div><b>Before</b><pre>{JSON.stringify(a.before, null, 2)}</pre></div><div><b>After</b><pre>{JSON.stringify(a.after, null, 2)}</pre></div></div></td></tr>}
                </Fragment>
              ))}
            </tbody></table></div>
            <Pagination pagination={d.pagination} onPage={(page) => setQ({ ...q, page })} />
          </>
        )}</Async>
      </Card>
    </>
  );
}
