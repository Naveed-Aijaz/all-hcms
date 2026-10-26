import { useState } from 'react';
import { api } from '../api.js';
import { useToast } from '../context/Toast.jsx';
import { useFetch, fmtDate, fmtDateTime } from '../hooks.js';
import { Async, Badge, Button, Card, Field, Modal, PageHeader, Pagination, fieldErrors } from '../components/ui.jsx';
import CheckInWidget from '../components/CheckInWidget.jsx';
import MonthCalendar from '../components/MonthCalendar.jsx';

function CorrectionModal({ onClose, onDone }) {
  const toast = useToast();
  const [v, setV] = useState({ date: new Date().toISOString().slice(0, 10), checkIn: '09:00', checkOut: '17:00', reason: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    const er = {};
    if (!v.date) er.date = 'Required';
    if (!v.checkIn) er.checkIn = 'Required';
    if (v.checkOut && v.checkOut <= v.checkIn) er.checkOut = 'Must be after check-in';
    if (!v.reason.trim()) er.reason = 'Please give a reason';
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try { await api.post('/attendance/corrections', { date: v.date, checkIn: v.checkIn, checkOut: v.checkOut || null, reason: v.reason }); toast.success('Correction requested. Your approver has been notified.'); onDone(); onClose(); }
    catch (err) { setErrors({ ...fieldErrors(err), form: err.message }); } finally { setBusy(false); }
  }
  return (
    <Modal title="Request attendance correction" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <Field label="Date" error={errors.date} hint="Within the last 30 days"><input type="date" value={v.date} max={new Date().toISOString().slice(0, 10)} onChange={set('date')} /></Field>
        <div className="grid2">
          <Field label="Check-in time" error={errors.checkIn}><input type="time" value={v.checkIn} onChange={set('checkIn')} /></Field>
          <Field label="Check-out time" error={errors.checkOut}><input type="time" value={v.checkOut} onChange={set('checkOut')} /></Field>
        </div>
        <Field label="Reason" error={errors.reason}><textarea rows={3} maxLength={500} value={v.reason} onChange={set('reason')} /></Field>
        {errors.form && <div className="alert alert-error">{errors.form}</div>}
        <div className="form-actions"><Button variant="ghost" type="button" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Submit request</Button></div>
      </form>
    </Modal>
  );
}

export default function Attendance() {
  const [tick, setTick] = useState(0);
  const [modal, setModal] = useState(false);
  const [page, setPage] = useState(1);
  const corr = useFetch(() => api.get('/attendance/corrections', { scope: 'mine', page, limit: 5 }), [page, tick]);
  return (
    <>
      <PageHeader title="My attendance"><Button small variant="ghost" onClick={() => setModal(true)}>Request correction</Button></PageHeader>
      <Card title="Today"><CheckInWidget onChange={() => setTick((t) => t + 1)} /></Card>
      <Card title="Calendar"><MonthCalendar refreshKey={tick} load={(m) => api.get('/attendance/me', { month: m }).then((r) => r.data)} /></Card>
      <Card title="My correction requests">
        <Async state={corr} empty={(d) => d.data.length === 0}>{(d) => (
          <>
            <div className="table-wrap"><table><thead><tr><th>Date</th><th>Times</th><th>Reason</th><th>Status</th><th>Decision</th></tr></thead><tbody>
              {d.data.map((c) => <tr key={c.id}><td>{fmtDate(c.date)}</td><td>{c.checkIn}{c.checkOut ? ` - ${c.checkOut}` : ''}</td><td>{c.reason}</td><td><Badge value={c.status} /></td><td>{c.decisionComment || '-'}{c.decidedAt ? <div className="muted small">{fmtDateTime(c.decidedAt)}</div> : null}</td></tr>)}
            </tbody></table></div>
            <Pagination pagination={d.pagination} onPage={setPage} />
          </>
        )}</Async>
      </Card>
      {modal && <CorrectionModal onClose={() => setModal(false)} onDone={() => setTick((t) => t + 1)} />}
    </>
  );
}
