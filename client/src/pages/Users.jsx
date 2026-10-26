import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useToast } from '../context/Toast.jsx';
import { useFetch, fmtDateTime, errMsg } from '../hooks.js';
import { Async, Badge, Button, Card, Confirm, Modal, PageHeader, Pagination } from '../components/ui.jsx';
import { RegisterModal } from './Employees.jsx';

export default function Users() {
  const toast = useToast();
  const [q, setQ] = useState({ search: '', role: '', page: 1 });
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [temp, setTemp] = useState(null);
  const [busy, setBusy] = useState(false);
  const state = useFetch(() => api.get('/users', { ...q, limit: 15 }), [q.search, q.role, q.page]);
  useEffect(() => { const t = setTimeout(() => setQ((p) => ({ ...p, search, page: 1 })), 300); return () => clearTimeout(t); }, [search]);

  async function run() {
    setBusy(true);
    try {
      if (confirm.kind === 'toggle') { await api.patch(`/users/${confirm.user.id}/active`, { active: !confirm.user.active }); toast.success(confirm.user.active ? 'Login deactivated and sessions ended.' : 'Login activated.'); }
      else { const r = await api.post(`/users/${confirm.user.id}/reset-password`); if (r.data.temporaryPassword) setTemp({ name: confirm.user.name, password: r.data.temporaryPassword }); else toast.success('A temporary password was emailed to the user.'); }
      setConfirm(null); state.reload();
    } catch (e) { toast.error(errMsg(e)); setConfirm(null); } finally { setBusy(false); }
  }
  return (
    <>
      <PageHeader title="Logins"><Button small onClick={() => setCreating(true)}>Create HR login</Button></PageHeader>
      <Card>
        <div className="filters">
          <label>Search <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or email" maxLength={80} /></label>
          <label>Role <select value={q.role} onChange={(e) => setQ({ ...q, role: e.target.value, page: 1 })}><option value="">All</option><option value="admin">Admin</option><option value="hr">HR</option><option value="manager">Manager</option><option value="employee">Employee</option></select></label>
        </div>
        <Async state={state} empty={(d) => d.data.length === 0}>{(d) => (
          <>
            <div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last sign-in</th><th /></tr></thead><tbody>
              {d.data.map((u) => <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.role}</td><td><Badge value={u.active ? 'active' : 'exited'} label={u.active ? 'active' : 'deactivated'} />{u.mustChangePassword && <small className="muted"> temp password</small>}</td><td>{fmtDateTime(u.lastLoginAt)}</td>
                <td><Button small variant="ghost" onClick={() => setConfirm({ kind: 'toggle', user: u })}>{u.active ? 'Deactivate' : 'Activate'}</Button> <Button small variant="ghost" onClick={() => setConfirm({ kind: 'reset', user: u })}>Reset password</Button></td></tr>)}
            </tbody></table></div>
            <Pagination pagination={d.pagination} onPage={(page) => setQ({ ...q, page })} />
          </>
        )}</Async>
      </Card>
      {creating && <RegisterModal hrMode onClose={() => setCreating(false)} onDone={state.reload} />}
      {confirm && <Confirm danger={confirm.kind === 'toggle' && confirm.user.active} title={confirm.kind === 'toggle' ? `${confirm.user.active ? 'Deactivate' : 'Activate'} ${confirm.user.name}?` : `Reset password for ${confirm.user.name}?`} message={confirm.kind === 'toggle' ? (confirm.user.active ? 'They will be signed out immediately and cannot sign in.' : 'They will be able to sign in again.') : 'A new temporary password is generated; the user must change it at next sign-in and all their sessions end.'} loading={busy} onConfirm={run} onClose={() => setConfirm(null)} />}
      {temp && <Modal title="Temporary password" onClose={() => setTemp(null)}><p>New temporary password for <b>{temp.name}</b> (shown once):</p><p><code>{temp.password}</code></p><div className="form-actions"><Button onClick={() => setTemp(null)}>Done</Button></div></Modal>}
    </>
  );
}
