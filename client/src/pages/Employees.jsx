import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/Auth.jsx';
import { useToast } from '../context/Toast.jsx';
import { api } from '../api.js';
import { useFetch, fmtDate, errMsg } from '../hooks.js';
import { Async, Badge, Button, Card, Field, Modal, PageHeader, Pagination, fieldErrors } from '../components/ui.jsx';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const blank = { name: '', email: '', phone: '', gender: 'other', dob: '', departmentId: '', designationId: '', managerId: '', joinDate: new Date().toISOString().slice(0, 10), basicSalary: '', role: 'employee', status: 'active' };

export function RegisterModal({ onClose, onDone, hrMode = false }) {
  const toast = useToast();
  const departments = useFetch(() => api.get('/departments').then((r) => r.data), []);
  const designations = useFetch(() => api.get('/designations').then((r) => r.data), []);
  const managers = useFetch(() => api.get('/employees', { limit: 100, status: 'active' }).then((r) => r.data.filter((e) => ['manager', 'hr'].includes(e.role))), []);
  const [v, setV] = useState(blank);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    const er = {};
    if (!v.name.trim()) er.name = 'Required';
    if (!EMAIL_RE.test(v.email)) er.email = 'Enter a valid email';
    if (!v.departmentId) er.departmentId = 'Choose a department';
    if (!v.joinDate) er.joinDate = 'Required';
    if (!(Number(v.basicSalary) > 0)) er.basicSalary = 'Must be greater than 0';
    if (v.phone && !/^[0-9+()\-\s]{1,30}$/.test(v.phone)) er.phone = 'Invalid phone number';
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      const body = { name: v.name, email: v.email, phone: v.phone || undefined, gender: v.gender, dob: v.dob || null, departmentId: v.departmentId, designationId: v.designationId || null, managerId: v.managerId || null, joinDate: v.joinDate, basicSalary: Number(v.basicSalary), status: v.status };
      const r = hrMode ? await api.post('/users/hr', body) : await api.post('/employees', { ...body, role: v.role });
      setCreated(r.data);
      toast.success(`${r.data.employee.name} registered.`);
      onDone();
    } catch (err) { setErrors({ ...fieldErrors(err), form: err.message }); } finally { setBusy(false); }
  }

  if (created) {
    return (
      <Modal title="Employee registered" onClose={onClose}>
        <p><b>{created.employee.name}</b> ({created.employee.code}) can now sign in.</p>
        {created.temporaryPassword ? (
          <div className="alert alert-info">Temporary password (shown once): <code>{created.temporaryPassword}</code><br /><small>They must change it at first sign-in. A copy was also emailed.</small></div>
        ) : <div className="alert alert-success">A temporary password was emailed to {created.employee.email}. They must change it at first sign-in.</div>}
        <div className="form-actions"><Button onClick={onClose}>Done</Button></div>
      </Modal>
    );
  }
  const desigs = (designations.data || []).filter((d) => !d.departmentId || d.departmentId === v.departmentId);
  return (
    <Modal title={hrMode ? 'Create HR login' : 'Register employee'} onClose={onClose} wide>
      <form onSubmit={submit} noValidate className="form-grid">
        <Field label="Full name" error={errors.name}><input value={v.name} onChange={set('name')} maxLength={120} /></Field>
        <Field label="Email (login)" error={errors.email}><input type="email" value={v.email} onChange={set('email')} /></Field>
        <Field label="Phone" error={errors.phone}><input value={v.phone} onChange={set('phone')} /></Field>
        <Field label="Gender"><select value={v.gender} onChange={set('gender')}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></Field>
        <Field label="Date of birth" error={errors.dob}><input type="date" value={v.dob} onChange={set('dob')} /></Field>
        <Field label="Department" error={errors.departmentId}><select value={v.departmentId} onChange={set('departmentId')}><option value="">Select...</option>{(departments.data || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
        <Field label="Designation"><select value={v.designationId} onChange={set('designationId')}><option value="">None</option>{desigs.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</select></Field>
        <Field label="Reports to"><select value={v.managerId} onChange={set('managerId')}><option value="">No manager</option>{(managers.data || []).map((m) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}</select></Field>
        <Field label="Join date" error={errors.joinDate}><input type="date" value={v.joinDate} onChange={set('joinDate')} /></Field>
        <Field label="Basic monthly salary" error={errors.basicSalary} hint="Gross = basic + 40% HRA + 10% medical"><input type="number" min="0" step="0.01" value={v.basicSalary} onChange={set('basicSalary')} /></Field>
        {!hrMode && <Field label="Role"><select value={v.role} onChange={set('role')}><option value="employee">Employee</option><option value="manager">Manager (approves team requests)</option></select></Field>}
        <Field label="Status"><select value={v.status} onChange={set('status')}><option value="active">Active</option><option value="probation">Probation</option></select></Field>
        {errors.form && <div className="alert alert-error full" role="alert">{errors.form}</div>}
        <div className="form-actions full"><Button variant="ghost" type="button" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Register</Button></div>
      </form>
    </Modal>
  );
}

function ImportModal({ onClose, onDone }) {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const post = (dry) => { const fd = new FormData(); fd.append('file', file); return api.upload('/employees/import', fd, dry ? { dryRun: 'true' } : undefined); };

  async function dry() {
    setBusy(true); setReport(null);
    try { setReport((await post(true)).data); } catch (e) { setReport({ fatal: errMsg(e), errors: e.details || [] }); } finally { setBusy(false); }
  }
  async function real() {
    setBusy(true);
    try { const r = await post(false); toast.success(`${r.data.imported} employee(s) imported.`); onDone(); onClose(); } catch (e) { setReport({ fatal: errMsg(e), errors: e.details || [] }); } finally { setBusy(false); }
  }
  const template = 'name,email,department,join_date,basic_salary,role,code,phone,gender,dob,designation,manager_code\nJane Doe,jane@example.com,Engineering,2026-01-05,60000,employee,,,female,,,\n';
  return (
    <Modal title="Import employees (CSV)" onClose={onClose} wide>
      <p className="muted">Required columns: name, email, department (must exist), join_date (YYYY-MM-DD), basic_salary. Optional: code, phone, gender, dob, designation, manager_code, role. Run a dry run first; nothing is saved until you import.</p>
      <a className="btn btn-small btn-ghost" href={`data:text/csv;charset=utf-8,${encodeURIComponent(template)}`} download="employees-template.csv">Download template</a>
      <div className="field"><input type="file" accept=".csv,text/csv" onChange={(e) => { setFile(e.target.files[0] || null); setReport(null); }} /></div>
      {report && report.fatal && <div className="alert alert-error">{report.fatal}</div>}
      {report && !report.fatal && <div className={`alert ${report.errors.length ? 'alert-error' : 'alert-success'}`}>{report.errors.length ? `${report.errors.length} problem(s) found in ${report.total} row(s).` : `All ${report.total} row(s) are valid.`}</div>}
      {report && report.errors && report.errors.length > 0 && (
        <div className="table-wrap"><table><thead><tr><th>Row</th><th>Field</th><th>Reason</th></tr></thead><tbody>{report.errors.map((e, i) => <tr key={i}><td>{e.row}</td><td>{e.field}</td><td>{e.reason}</td></tr>)}</tbody></table></div>
      )}
      <div className="form-actions"><Button variant="ghost" onClick={onClose}>Close</Button><Button disabled={!file} loading={busy} onClick={dry}>Dry run</Button><Button disabled={!report || report.fatal || report.errors.length > 0 || !report.dryRun} loading={busy} onClick={real}>Import</Button></div>
    </Modal>
  );
}

export default function Employees() {
  const { user } = useAuth();
  const toast = useToast();
  const isHr = user.role === 'hr';
  const [q, setQ] = useState({ search: '', departmentId: '', status: '', page: 1 });
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const departments = useFetch(() => api.get('/departments').then((r) => r.data), []);
  const state = useFetch(() => api.get('/employees', { ...q, limit: 15 }), [q.search, q.departmentId, q.status, q.page]);

  useEffect(() => { const t = setTimeout(() => setQ((p) => ({ ...p, search, page: 1 })), 300); return () => clearTimeout(t); }, [search]);

  return (
    <>
      <PageHeader title={user.role === 'manager' ? 'My team' : 'Employees'}>
        {isHr && <><Button small variant="ghost" onClick={() => api.download('/employees/export').catch((e) => toast.error(errMsg(e)))}>Export CSV</Button><Button small variant="ghost" onClick={() => setModal('import')}>Import CSV</Button><Button small onClick={() => setModal('register')}>Register employee</Button></>}
      </PageHeader>
      <Card>
        <div className="filters">
          <label>Search <input placeholder="Name, code or email" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={80} /></label>
          {user.role !== 'manager' && <label>Department <select value={q.departmentId} onChange={(e) => setQ({ ...q, departmentId: e.target.value, page: 1 })}><option value="">All</option>{(departments.data || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}
          <label>Status <select value={q.status} onChange={(e) => setQ({ ...q, status: e.target.value, page: 1 })}><option value="">All</option><option value="active">Active</option><option value="probation">Probation</option><option value="exited">Exited</option></select></label>
        </div>
        <Async state={state} empty={(d) => d.data.length === 0}>{(d) => (
          <>
            <div className="table-wrap"><table>
              <thead><tr><th>Code</th><th>Name</th><th>Department</th><th>Designation</th><th>Role</th><th>Joined</th><th>Status</th></tr></thead>
              <tbody>{d.data.map((e) => (
                <tr key={e.id}><td>{e.code}</td><td><Link to={`/employees/${e.id}`}>{e.name}</Link><div className="muted small">{e.email}</div></td><td>{e.department && e.department.name}</td><td>{e.designation && e.designation.title}</td><td>{e.role}</td><td>{fmtDate(e.joinDate)}</td><td><Badge value={e.status} /></td></tr>
              ))}</tbody>
            </table></div>
            <Pagination pagination={d.pagination} onPage={(page) => setQ({ ...q, page })} />
          </>
        )}</Async>
      </Card>
      {modal === 'register' && <RegisterModal onClose={() => setModal(null)} onDone={state.reload} />}
      {modal === 'import' && <ImportModal onClose={() => setModal(null)} onDone={state.reload} />}
    </>
  );
}
