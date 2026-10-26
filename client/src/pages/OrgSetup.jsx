import { useState } from 'react';
import { api } from '../api.js';
import { useToast } from '../context/Toast.jsx';
import { useFetch, fmtDate, errMsg } from '../hooks.js';
import { Async, Button, Card, Confirm, Field, Modal, PageHeader, fieldErrors } from '../components/ui.jsx';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function SettingsTab() {
  const toast = useToast();
  const state = useFetch(() => api.get('/settings').then((r) => r.data), []);
  const [v, setV] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const cur = v || (state.data && {
    companyName: state.data.companyName, timezone: state.data.timezone, officeStart: state.data.officeStart, graceMinutes: state.data.graceMinutes, halfDayHours: state.data.halfDayHours, weekend: state.data.weekend,
    lat: state.data.office.lat ?? '', lng: state.data.office.lng ?? '', radiusMeters: state.data.office.radiusMeters, hraPercent: state.data.payroll.hraPercent, medicalPercent: state.data.payroll.medicalPercent,
  });
  const set = (k) => (e) => setV({ ...cur, [k]: e.target.value });
  const toggleDay = (i) => setV({ ...cur, weekend: cur.weekend.includes(i) ? cur.weekend.filter((x) => x !== i) : [...cur.weekend, i] });

  async function save(e) {
    e.preventDefault();
    const er = {};
    if (!cur.companyName.trim()) er.companyName = 'Required';
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(cur.officeStart)) er.officeStart = 'Use HH:mm';
    if (cur.graceMinutes === '' || Number(cur.graceMinutes) < 0 || Number(cur.graceMinutes) > 180) er.graceMinutes = '0 - 180';
    if (Number(cur.halfDayHours) < 1 || Number(cur.halfDayHours) > 12) er.halfDayHours = '1 - 12';
    if (cur.weekend.length > 6) er.weekend = 'At least one working day is required';
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      await api.put('/settings', {
        companyName: cur.companyName, timezone: cur.timezone, officeStart: cur.officeStart, graceMinutes: Number(cur.graceMinutes), halfDayHours: Number(cur.halfDayHours), weekend: cur.weekend,
        office: { lat: cur.lat === '' ? null : Number(cur.lat), lng: cur.lng === '' ? null : Number(cur.lng), radiusMeters: Number(cur.radiusMeters) },
        payroll: { hraPercent: Number(cur.hraPercent), medicalPercent: Number(cur.medicalPercent) },
      });
      toast.success('Settings saved. They apply to new attendance records and new payroll runs.');
      setV(null); state.reload();
    } catch (err) { setErrors({ ...fieldErrors(err), form: err.message }); } finally { setBusy(false); }
  }
  return (
    <Async state={state}>{() => cur && (
      <form onSubmit={save} noValidate className="form-grid">
        <Field label="Company name" error={errors.companyName}><input value={cur.companyName} onChange={set('companyName')} maxLength={120} /></Field>
        <Field label="Timezone (IANA)" error={errors.timezone} hint="e.g. Asia/Karachi"><input value={cur.timezone} onChange={set('timezone')} /></Field>
        <Field label="Office start time" error={errors.officeStart}><input type="time" value={cur.officeStart} onChange={set('officeStart')} /></Field>
        <Field label="Grace period (minutes)" error={errors.graceMinutes}><input type="number" min="0" max="180" value={cur.graceMinutes} onChange={set('graceMinutes')} /></Field>
        <Field label="Half-day if worked less than (hours)" error={errors.halfDayHours}><input type="number" min="1" max="12" step="0.5" value={cur.halfDayHours} onChange={set('halfDayHours')} /></Field>
        <Field label="Weekend days" error={errors.weekend}><div className="checks">{DAYS.map((d, i) => <label key={d} className="check"><input type="checkbox" checked={cur.weekend.includes(i)} onChange={() => toggleDay(i)} /> {d}</label>)}</div></Field>
        <Field label="Office latitude" hint="Reserved for geofencing (optional)"><input type="number" step="any" value={cur.lat} onChange={set('lat')} /></Field>
        <Field label="Office longitude"><input type="number" step="any" value={cur.lng} onChange={set('lng')} /></Field>
        <Field label="Geofence radius (m)"><input type="number" min="10" max="5000" value={cur.radiusMeters} onChange={set('radiusMeters')} /></Field>
        <Field label="HRA % of basic"><input type="number" min="0" max="100" value={cur.hraPercent} onChange={set('hraPercent')} /></Field>
        <Field label="Medical % of basic"><input type="number" min="0" max="100" value={cur.medicalPercent} onChange={set('medicalPercent')} /></Field>
        {errors.form && <div className="alert alert-error full">{errors.form}</div>}
        <div className="form-actions full"><small className="muted">Changes apply to new records only; existing attendance and finalized payslips are not rewritten.</small><Button type="submit" loading={busy}>Save settings</Button></div>
      </form>
    )}</Async>
  );
}

/** Generic list + create/edit/delete for a reference collection. */
function CrudTab({ path, columns, fields, noun, newItem }) {
  const toast = useToast();
  const state = useFetch(() => api.get(`/${path}`, { limit: 200 }).then((r) => r.data), [path]);
  const refs = useFetch(() => (fields.some((f) => f.ref) ? api.get('/departments').then((r) => r.data) : Promise.resolve([])), []);
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const [v, setV] = useState({});
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const open = (item) => { setEdit(item || 'new'); setV(item ? { ...item } : { ...newItem }); setErrors({}); };
  async function save(e) {
    e.preventDefault();
    const er = {};
    fields.forEach((f) => { if (f.required && (v[f.key] === undefined || v[f.key] === '')) er[f.key] = 'Required'; });
    setErrors(er);
    if (Object.keys(er).length) return;
    const body = {};
    fields.forEach((f) => { let x = v[f.key]; if (f.type === 'number') x = Number(x || 0); if (f.ref && x === '') x = null; if (x !== undefined) body[f.key] = x; });
    setBusy(true);
    try { if (edit === 'new') await api.post(`/${path}`, body); else await api.put(`/${path}/${edit.id}`, body); toast.success(`${noun} saved.`); setEdit(null); state.reload(); }
    catch (err) { setErrors({ ...fieldErrors(err), form: err.message }); } finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true);
    try { await api.del(`/${path}/${del.id}`); toast.success(`${noun} deleted.`); setDel(null); state.reload(); } catch (err) { toast.error(errMsg(err)); setDel(null); } finally { setBusy(false); }
  }
  return (
    <>
      <div className="tab-actions"><Button small onClick={() => open(null)}>Add {noun.toLowerCase()}</Button></div>
      <Async state={state} empty={(d) => d.length === 0}>{(rows) => (
        <div className="table-wrap"><table><thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}<th /></tr></thead><tbody>
          {rows.map((r) => <tr key={r.id}>{columns.map((c) => <td key={c.key}>{c.render ? c.render(r, refs.data) : String(r[c.key] ?? '-')}</td>)}<td><Button small variant="ghost" onClick={() => open(r)}>Edit</Button> <Button small variant="danger" onClick={() => setDel(r)}>Delete</Button></td></tr>)}
        </tbody></table></div>
      )}</Async>
      {edit && (
        <Modal title={`${edit === 'new' ? 'Add' : 'Edit'} ${noun.toLowerCase()}`} onClose={() => setEdit(null)}>
          <form onSubmit={save} noValidate>
            {fields.map((f) => (
              <Field key={f.key} label={f.label} error={errors[f.key]}>
                {f.type === 'checkbox' ? <input type="checkbox" checked={!!v[f.key]} onChange={(e) => setV({ ...v, [f.key]: e.target.checked })} />
                  : f.ref ? <select value={v[f.key] || ''} onChange={(e) => setV({ ...v, [f.key]: e.target.value })}><option value="">None</option>{(refs.data || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
                  : <input type={f.type || 'text'} value={v[f.key] ?? ''} min={f.type === 'number' ? 0 : undefined} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />}
              </Field>
            ))}
            {errors.form && <div className="alert alert-error">{errors.form}</div>}
            <div className="form-actions"><Button variant="ghost" type="button" onClick={() => setEdit(null)}>Cancel</Button><Button type="submit" loading={busy}>Save</Button></div>
          </form>
        </Modal>
      )}
      {del && <Confirm danger title={`Delete ${noun.toLowerCase()}?`} message="This cannot be undone. Items that are in use cannot be deleted." loading={busy} onConfirm={remove} onClose={() => setDel(null)} />}
    </>
  );
}

const TABS = {
  settings: { label: 'Company settings', render: () => <SettingsTab /> },
  departments: { label: 'Departments', render: () => <CrudTab path="departments" noun="Department" newItem={{ name: '', description: '' }} columns={[{ key: 'name', label: 'Name' }, { key: 'description', label: 'Description' }]} fields={[{ key: 'name', label: 'Name', required: true }, { key: 'description', label: 'Description' }]} /> },
  designations: { label: 'Designations', render: () => <CrudTab path="designations" noun="Designation" newItem={{ title: '', departmentId: '' }} columns={[{ key: 'title', label: 'Title' }, { key: 'departmentId', label: 'Department', render: (r, deps) => ((deps || []).find((d) => d.id === r.departmentId) || {}).name || 'Any' }]} fields={[{ key: 'title', label: 'Title', required: true }, { key: 'departmentId', label: 'Department (optional)', ref: true }]} /> },
  leave: { label: 'Leave types', render: () => <CrudTab path="leave-types" noun="Leave type" newItem={{ name: '', code: '', annualQuota: 0, unlimited: false, paid: true }} columns={[{ key: 'name', label: 'Name' }, { key: 'code', label: 'Code' }, { key: 'annualQuota', label: 'Annual quota', render: (r) => (r.unlimited ? 'unlimited' : r.annualQuota) }, { key: 'paid', label: 'Paid', render: (r) => (r.paid ? 'Yes' : 'No') }]} fields={[{ key: 'name', label: 'Name', required: true }, { key: 'code', label: 'Code', required: true }, { key: 'annualQuota', label: 'Annual quota (days)', type: 'number' }, { key: 'unlimited', label: 'Unlimited', type: 'checkbox' }, { key: 'paid', label: 'Paid leave', type: 'checkbox' }]} /> },
  holidays: { label: 'Public holidays', render: () => <CrudTab path="holidays" noun="Holiday" newItem={{ date: '', name: '' }} columns={[{ key: 'date', label: 'Date', render: (r) => fmtDate(r.date) }, { key: 'name', label: 'Name' }]} fields={[{ key: 'date', label: 'Date', type: 'date', required: true }, { key: 'name', label: 'Name', required: true }]} /> },
};

export default function OrgSetup() {
  const [tab, setTab] = useState('settings');
  return (
    <>
      <PageHeader title="Organization setup" />
      <div className="tabs" role="tablist">{Object.entries(TABS).map(([k, t]) => <button key={k} role="tab" aria-selected={tab === k} className={`tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>{t.label}</button>)}</div>
      <Card key={tab}>{TABS[tab].render()}</Card>
    </>
  );
}
