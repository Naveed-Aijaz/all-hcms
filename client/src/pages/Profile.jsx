import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/Auth.jsx';
import { useToast } from '../context/Toast.jsx';
import { useFetch, fmtDate } from '../hooks.js';
import { Async, Button, Card, Field, PageHeader, fieldErrors } from '../components/ui.jsx';
import { Avatar, PhotoUpload } from './EmployeeDetail.jsx';

export default function Profile() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const state = useFetch(() => api.get(`/employees/${user.employeeId}`).then((r) => r.data.profile), [user.employeeId]);
  const [v, setV] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    if (v.phone && !/^[0-9+()\-\s]{1,30}$/.test(v.phone)) return setErrors({ phone: 'Invalid phone number' });
    setBusy(true);
    try { await api.patch('/employees/me', { phone: v.phone, address: v.address }); toast.success('Profile updated.'); setErrors({}); state.reload(); }
    catch (err) { setErrors({ ...fieldErrors(err), form: err.message }); } finally { setBusy(false); }
  }
  return (
    <>
      <PageHeader title="My profile"><Link className="btn btn-small btn-ghost" to="/account">Change password</Link></PageHeader>
      <Async state={state}>{(p) => {
        const cur = v || { phone: p.phone || '', address: p.address || '' };
        return (
          <div className="grid2">
            <Card title="Photo">
              <div className="profile-top"><Avatar photo={p.photo} name={p.name} size={120} /><div><b>{p.name}</b><div className="muted">{p.code} - {p.role}</div><PhotoUpload url="/employees/me/photo" onDone={() => { state.reload(); refresh(); }} /><small className="muted">JPEG, PNG or WebP, up to 2 MB.</small></div></div>
              <dl className="dl"><dt>Email</dt><dd>{p.email}</dd><dt>Department</dt><dd>{p.department && p.department.name}</dd><dt>Designation</dt><dd>{p.designation ? p.designation.title : '-'}</dd><dt>Reports to</dt><dd>{p.manager ? p.manager.name : '-'}</dd><dt>Joined</dt><dd>{fmtDate(p.joinDate)}</dd></dl>
            </Card>
            <Card title="Contact details">
              <form onSubmit={save} noValidate>
                <Field label="Phone" error={errors.phone}><input value={cur.phone} onChange={(e) => setV({ ...cur, phone: e.target.value })} /></Field>
                <Field label="Address" error={errors.address}><textarea rows={3} maxLength={300} value={cur.address} onChange={(e) => setV({ ...cur, address: e.target.value })} /></Field>
                {errors.form && <div className="alert alert-error">{errors.form}</div>}
                <Button type="submit" loading={busy}>Save</Button>
                <p className="muted small">Other details (name, department, salary) are managed by HR.</p>
              </form>
            </Card>
          </div>
        );
      }}</Async>
    </>
  );
}
