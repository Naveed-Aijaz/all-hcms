import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/Auth.jsx';
import { useFetch, fmtTime, fmtMinutes } from '../hooks.js';
import { Async, Badge, Card, PageHeader, Pagination, StatCard } from '../components/ui.jsx';

export default function AttendanceBoard() {
  const { user } = useAuth();
  const [q, setQ] = useState({ date: '', departmentId: '', page: 1 });
  const departments = useFetch(() => api.get('/departments').then((r) => r.data), []);
  const state = useFetch(() => api.get('/attendance/board', { ...q, limit: 50 }).then((r) => r.data), [q.date, q.departmentId, q.page]);
  return (
    <>
      <PageHeader title={user.role === 'manager' ? 'Team attendance' : 'Daily attendance board'} />
      <Card>
        <div className="filters">
          <label>Date <input type="date" value={q.date} onChange={(e) => setQ({ ...q, date: e.target.value, page: 1 })} /></label>
          {user.role !== 'manager' && <label>Department <select value={q.departmentId} onChange={(e) => setQ({ ...q, departmentId: e.target.value, page: 1 })}><option value="">All</option>{(departments.data || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}
        </div>
        <Async state={state}>{(d) => (
          <>
            <div className="stats stats-small">{Object.entries(d.summary).map(([k, v]) => <StatCard key={k} label={k.replace(/_/g, ' ')} value={v} />)}</div>
            {d.data.length === 0 ? <div className="empty">No employees to show for {d.date}.</div> : (
              <div className="table-wrap"><table><thead><tr><th>Code</th><th>Name</th><th>Department</th><th>Status</th><th>In</th><th>Out</th><th>Worked</th></tr></thead><tbody>
                {d.data.map((r) => <tr key={r.employeeId}><td>{r.code}</td><td><Link to={`/employees/${r.employeeId}`}>{r.name}</Link></td><td>{r.department}</td><td><Badge value={r.status} /></td><td>{fmtTime(r.checkIn)}</td><td>{fmtTime(r.checkOut)}</td><td>{r.checkOut ? fmtMinutes(r.workedMinutes) : '-'}</td></tr>)}
              </tbody></table></div>
            )}
            <Pagination pagination={d.pagination} onPage={(page) => setQ({ ...q, page })} />
          </>
        )}</Async>
      </Card>
    </>
  );
}
