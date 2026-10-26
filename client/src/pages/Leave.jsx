import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useToast } from '../context/Toast.jsx';
import { useFetch, fmtDate, errMsg } from '../hooks.js';
import { Async, Badge, Button, Card, Field, PageHeader, Pagination, fieldErrors } from '../components/ui.jsx';

const iso = (d) => d.toISOString().slice(0, 10);

function SmartLeave({ onForm }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  async function run() {
    if (text.trim().length < 3) return;
    setBusy(true);
    try {
      const r = (await api.post('/ai/smart-leave', { text })).data;
      if (r.fallback) toast.info(r.message || 'Could not read that request. Please fill in the form.');
      else { onForm(r.form); toast.success('Form pre-filled. Please check the details and submit.'); }
    } catch (e) { toast.error(e.status === 429 ? 'Hourly AI limit reached. Please fill in the form.' : errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <div className="smart">
      <input placeholder={"Try: \"I need next Monday and Tuesday off for a family wedding\""} value={text} maxLength={500} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} aria-label="Describe your leave" />
      <Button small loading={busy} onClick={run}>Fill form with AI</Button>
      <small className="muted">AI only pre-fills the form. Nothing is submitted until you confirm.</small>
    </div>
  );
}

function ApplyForm({ types, onDone, prefill }) {
  const toast = useToast();
  const [v, setV] = useState({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });
  const [errors, setErrors] = useState({});
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });

  useEffect(() => { if (prefill) setV((p) => ({ ...p, ...prefill })); }, [prefill]);
  useEffect(() => { if (!v.leaveTypeId && types.length) setV((p) => ({ ...p, leaveTypeId: types[0].leaveTypeId })); }, [types, v.leaveTypeId]);
  useEffect(() => {
    setPreview(null);
    if (!v.leaveTypeId || !v.startDate || !v.endDate) return undefined;
    if (v.endDate < v.startDate) { setPreview({ error: 'End date cannot be before the start date.' }); return undefined; }
    let live = true;
    const t = setTimeout(() => {
      api.post('/leaves/preview', { leaveTypeId: v.leaveTypeId, startDate: v.startDate, endDate: v.endDate })
        .then((r) => live && setPreview(r.data)).catch((e) => live && setPreview({ error: e.message }));
    }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [v.leaveTypeId, v.startDate, v.endDate]);

  async function submit(e) {
    e.preventDefault();
    const er = {};
    if (!v.leaveTypeId) er.leaveTypeId = 'Choose a leave type';
    if (!v.startDate) er.startDate = 'Required';
    if (!v.endDate) er.endDate = 'Required';
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try { await api.post('/leaves', v); toast.success('Leave request submitted for approval.'); setV({ leaveTypeId: v.leaveTypeId, startDate: '', endDate: '', reason: '' }); onDone(); }
    catch (err) { setErrors({ ...fieldErrors(err), form: err.message }); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} noValidate className="form-grid">
      <Field label="Leave type" error={errors.leaveTypeId}><select value={v.leaveTypeId} onChange={set('leaveTypeId')}>{types.map((t) => <option key={t.leaveTypeId} value={t.leaveTypeId}>{t.name}{t.unlimited ? '' : ` (${t.remaining} left)`}</option>)}</select></Field>
      <Field label="From" error={errors.startDate}><input type="date" value={v.startDate} onChange={set('startDate')} /></Field>
      <Field label="To" error={errors.endDate}><input type="date" value={v.endDate} min={v.startDate} onChange={set('endDate')} /></Field>
      <Field label="Reason (optional)"><input value={v.reason} maxLength={500} onChange={set('reason')} /></Field>
      <div className="full">
        {preview && preview.error && <div className="alert alert-error">{preview.error}</div>}
        {preview && !preview.error && <div className="alert alert-info">{preview.days} working day(s) (weekends and public holidays excluded){preview.remainingAfter !== null ? ` - ${preview.remainingAfter} day(s) left after this request` : ''}.</div>}
        {errors.form && <div className="alert alert-error">{errors.form}</div>}
      </div>
      <div className="form-actions full"><Button type="submit" loading={busy} disabled={preview && !!preview.error}>Submit request</Button></div>
    </form>
  );
}

export default function Leave() {
  const toast = useToast();
  const [prefill, setPrefill] = useState(null);
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  const balances = useFetch(() => api.get('/leaves/balance').then((r) => r.data), [tick]);
  const history = useFetch(() => api.get('/leaves', { scope: 'mine', page, limit: 10 }), [page, tick]);
  const today = iso(new Date());

  async function cancel(id) {
    try { await api.post(`/leaves/${id}/cancel`); toast.success('Leave cancelled.'); setTick((t) => t + 1); } catch (e) { toast.error(errMsg(e)); }
  }
  return (
    <>
      <PageHeader title="My leave" />
      <Card title="Balance (this year)">
        <Async state={balances}>{(rows) => (
          <div className="table-wrap"><table><thead><tr><th>Type</th><th>Paid</th><th>Quota</th><th>Used</th><th>Pending</th><th>Remaining</th></tr></thead><tbody>
            {rows.map((b) => <tr key={b.leaveTypeId}><td>{b.name}</td><td>{b.paid ? 'Yes' : 'No'}</td><td>{b.unlimited ? 'unlimited' : b.quota}</td><td>{b.used}</td><td>{b.pending}</td><td><b>{b.unlimited ? '-' : b.remaining}</b></td></tr>)}
          </tbody></table></div>
        )}</Async>
      </Card>
      <Card title="Apply for leave">
        <SmartLeave onForm={setPrefill} />
        {balances.data && <ApplyForm types={balances.data} prefill={prefill} onDone={() => setTick((t) => t + 1)} />}
      </Card>
      <Card title="History">
        <Async state={history} empty={(d) => d.data.length === 0}>{(d) => (
          <>
            <div className="table-wrap"><table><thead><tr><th>Type</th><th>Dates</th><th>Days</th><th>Status</th><th>Comment</th><th /></tr></thead><tbody>
              {d.data.map((l) => <tr key={l.id}><td>{l.leaveType.name}</td><td>{fmtDate(l.startDate)} - {fmtDate(l.endDate)}</td><td>{l.days}</td><td><Badge value={l.status} /></td><td>{l.decisionComment || '-'}</td>
                <td>{(l.status === 'pending' || (l.status === 'approved' && l.startDate > today)) && <Button small variant="ghost" onClick={() => cancel(l.id)}>Cancel</Button>}</td></tr>)}
            </tbody></table></div>
            <Pagination pagination={d.pagination} onPage={setPage} />
          </>
        )}</Async>
      </Card>
    </>
  );
}
