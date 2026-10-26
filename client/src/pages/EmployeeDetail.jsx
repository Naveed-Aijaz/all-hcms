import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/Auth.jsx';
import { useToast } from '../context/Toast.jsx';
import { api, assetUrl } from '../api.js';
import { useFetch, fmtDate, fmtMoney, errMsg } from '../hooks.js';
import { Async, Badge, Button, Card, Field, Modal, PageHeader, fieldErrors } from '../components/ui.jsx';
import MonthCalendar from '../components/MonthCalendar.jsx';

export function Avatar({ photo, name, size = 96 }) {
  return photo
    ? <img src={assetUrl(`/uploads/profiles/${photo}`)} alt={`${name}`} className="avatar-lg" style={{ width: size, height: size }} />
    : <div className="avatar-lg avatar-ph" style={{ width: size, height: size, fontSize: size / 2.5 }}>{name.slice(0, 1).toUpperCase()}</div>;
}

export function PhotoUpload({ url, onDone }) {
  const toast = useToast();
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  async function pick(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return toast.error('Choose a JPEG, PNG or WebP image.');
    if (file.size > 2 * 1024 * 1024) return toast.error('The image must be 2 MB or smaller.');
    const fd = new FormData();
    fd.append('photo', file);
    setBusy(true);
    try { await api.upload(url, fd); toast.success('Photo updated.'); onDone(); } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  }
  return (<><input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pick} /><Button small variant="ghost" loading={busy} onClick={() => ref.current.click()}>Change photo</Button></>);
}

function EditModal({ p, onClose, onDone }) {
  const toast = useToast();
  const departments = useFetch(() => api.get('/departments').then((r) => r.data), []);
  const designations = useFetch(() => api.get('/designations').then((r) => r.data), []);
  const managers = useFetch(() => api.get('/employees', { limit: 100, status: 'active' }).then((r) => r.data.filter((e) => ['manager', 'hr'].includes(e.role) && e.id !== p.id)), []);
  const [v, setV] = useState({ name: p.name, email: p.email, phone: p.phone || '', address: p.address || '', gender: p.gender, departmentId: p.department.id, designationId: p.designation ? p.designation.id : '', managerId: p.manager ? p.manager.id : '', joinDate: p.joinDate, status: p.status, role: p.role });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { ...v, designationId: v.designationId || null, managerId: v.managerId || null };
      if (p.role === 'hr') delete body.role;
      await api.patch(`/employees/${p.id}`, body);
      toast.success('Employee updated.');
      onDone(); onClose();
    } catch (err) { setErrors({ ...fieldErrors(err), form: err.message }); } finally { setBusy(false); }
  }
  return (
    <Modal title={`Edit ${p.name}`} onClose={onClose} wide>
      <form onSubmit={submit} className="form-grid" noValidate>
        <Field label="Name" error={errors.name}><input value={v.name} onChange={set('name')} /></Field>
        <Field label="Email" error={errors.email}><input type="email" value={v.email} onChange={set('email')} /></Field>
        <Field label="Phone" error={errors.phone}><input value={v.phone} onChange={set('phone')} /></Field>
        <Field label="Address"><input value={v.address} onChange={set('address')} maxLength={300} /></Field>
        <Field label="Department"><select value={v.departmentId} onChange={set('departmentId')}>{(departments.data || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
        <Field label="Designation"><select value={v.designationId} onChange={set('designationId')}><option value="">None</option>{(designations.data || []).map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</select></Field>
        <Field label="Reports to" error={errors.managerId}><select value={v.managerId} onChange={set('managerId')}><option value="">No manager</option>{(managers.data || []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
        <Field label="Join date" error={errors.joinDate}><input type="date" value={v.joinDate} onChange={set('joinDate')} /></Field>
        <Field label="Status"><select value={v.status} onChange={set('status')}><option value="active">Active</option><option value="probation">Probation</option></select></Field>
        {p.role !== 'hr' && <Field label="Role"><select value={v.role} onChange={set('role')}><option value="employee">Employee</option><option value="manager">Manager</option></select></Field>}
        {errors.form && <div className="alert alert-error full">{errors.form}</div>}
        <div className="form-actions full"><Button variant="ghost" type="button" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Save</Button></div>
      </form>
    </Modal>
  );
}

export default function EmployeeDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const state = useFetch(() => api.get(`/employees/${id}`).then((r) => r.data), [id]);
  const [modal, setModal] = useState(null);
  const [salary, setSalary] = useState('');
  const [exitDate, setExitDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const isHr = user.role === 'hr';

  async function saveSalary() {
    if (!(Number(salary) > 0)) return toast.error('Salary must be greater than 0.');
    setBusy(true);
    try { await api.put(`/employees/${id}/salary`, { basicSalary: Number(salary) }); toast.success('Salary structure updated.'); setSalary(''); state.reload(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  async function doExit() {
    setBusy(true);
    try { await api.post(`/employees/${id}/exit`, { exitDate }); toast.success('Employee marked as exited and login disabled.'); setModal(null); state.reload(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <Async state={state}>{(d) => {
      const p = d.profile;
      const s = d.attendance.summary;
      return (
        <>
          <PageHeader title={p.name}>
            {isHr && p.status !== 'exited' && <><Button small variant="ghost" onClick={() => setModal('edit')}>Edit</Button>{p.role !== 'hr' && <Button small variant="danger" onClick={() => setModal('exit')}>Mark as exited</Button>}</>}
            <Link className="btn btn-small btn-ghost" to="/employees">Back</Link>
          </PageHeader>
          <div className="grid2">
            <Card title="Profile">
              <div className="profile-top"><Avatar photo={p.photo} name={p.name} /><div>
                <div><Badge value={p.status} /> <Badge value={p.role} /></div>
                <div className="muted">{p.code}</div>
                {isHr && <PhotoUpload url={`/employees/${id}/photo`} onDone={state.reload} />}
              </div></div>
              <dl className="dl">
                <dt>Email</dt><dd>{p.email}</dd><dt>Phone</dt><dd>{p.phone || '-'}</dd><dt>Address</dt><dd>{p.address || '-'}</dd>
                <dt>Department</dt><dd>{p.department && p.department.name}</dd><dt>Designation</dt><dd>{p.designation ? p.designation.title : '-'}</dd>
                <dt>Reports to</dt><dd>{p.manager ? p.manager.name : '-'}</dd><dt>Joined</dt><dd>{fmtDate(p.joinDate)}</dd>{p.exitDate && <><dt>Exited</dt><dd>{fmtDate(p.exitDate)}</dd></>}
              </dl>
            </Card>
            {p.salary && (
              <Card title="Salary structure (monthly)">
                <dl className="dl"><dt>Basic</dt><dd>{fmtMoney(p.salary.basic)}</dd><dt>HRA</dt><dd>{fmtMoney(p.salary.hra)}</dd><dt>Medical</dt><dd>{fmtMoney(p.salary.medical)}</dd><dt><b>Gross</b></dt><dd><b>{fmtMoney(p.salary.gross)}</b></dd></dl>
                {isHr && p.status !== 'exited' && (
                  <div className="inline-form"><input type="number" min="0" step="0.01" placeholder="New basic salary" value={salary} onChange={(e) => setSalary(e.target.value)} /><Button small loading={busy} onClick={saveSalary}>Update</Button></div>
                )}
                <small className="muted">Changes apply to future payroll runs; finalized payslips never change.</small>
              </Card>
            )}
          </div>
          <div className="grid2">
            <Card title="Leave balance (this year)">
              <div className="table-wrap"><table><thead><tr><th>Type</th><th>Quota</th><th>Used</th><th>Pending</th><th>Left</th></tr></thead><tbody>
                {d.leaveBalances.map((b) => <tr key={b.code}><td>{b.name}</td><td>{b.unlimited ? 'unlimited' : b.quota}</td><td>{b.used}</td><td>{b.pending}</td><td>{b.unlimited ? '-' : b.remaining}</td></tr>)}
              </tbody></table></div>
            </Card>
            <Card title="Recent leave">
              {d.recentLeaves.length === 0 ? <div className="muted">No leave requests.</div> : (
                <div className="table-wrap"><table><thead><tr><th>Type</th><th>Dates</th><th>Days</th><th>Status</th></tr></thead><tbody>
                  {d.recentLeaves.map((l) => <tr key={l.id}><td>{l.type}</td><td>{fmtDate(l.startDate)} - {fmtDate(l.endDate)}</td><td>{l.days}</td><td><Badge value={l.status} /></td></tr>)}
                </tbody></table></div>
              )}
            </Card>
          </div>
          <Card title={`Attendance - ${d.attendance.month}: ${s.present + s.late} present/late, ${s.half_day} half, ${s.absent} absent, ${s.on_leave} leave`}>
            <MonthCalendar load={(m) => api.get(`/attendance/employee/${id}`, { month: m }).then((r) => r.data)} />
          </Card>
          {modal === 'edit' && <EditModal p={p} onClose={() => setModal(null)} onDone={state.reload} />}
          {modal === 'exit' && (
            <Modal title={`Mark ${p.name} as exited`} onClose={() => setModal(null)}>
              <p>Their login is disabled immediately and pending leave is cancelled. History and payslips are kept.</p>
              <Field label="Last working day"><input type="date" value={exitDate} onChange={(e) => setExitDate(e.target.value)} /></Field>
              <div className="form-actions"><Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button><Button variant="danger" loading={busy} onClick={doExit}>Confirm exit</Button></div>
            </Modal>
          )}
        </>
      );
    }}</Async>
  );
}
