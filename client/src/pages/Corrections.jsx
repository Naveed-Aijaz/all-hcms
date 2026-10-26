import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/Auth.jsx';
import { useToast } from '../context/Toast.jsx';
import { useFetch, fmtDate, errMsg } from '../hooks.js';
import { Async, Badge, Button, Card, Field, Modal, PageHeader, Pagination } from '../components/ui.jsx';

export default function Corrections() {
  const { user } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const state = useFetch(() => api.get('/attendance/corrections', { status, page, limit: 15, scope: 'team' }), [status, page]);

  async function decide(decision) {
    if (decision === 'reject' && !comment.trim()) return toast.error('Please add a comment when rejecting.');
    setBusy(true);
    try { await api.post(`/attendance/corrections/${target.id}/decision`, { decision, comment: comment.trim() || undefined }); toast.success(`Correction ${decision === 'approve' ? 'approved' : 'rejected'}.`); setTarget(null); setComment(''); state.reload(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <>
      <PageHeader title={user.role === 'manager' ? 'Team attendance corrections' : 'Attendance corrections'} />
      <Card>
        <div className="filters"><label>Status <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="">All</option></select></label></div>
        <Async state={state} empty={(d) => d.data.length === 0}>{(d) => (
          <>
            <div className="table-wrap"><table><thead><tr><th>Employee</th><th>Date</th><th>Requested times</th><th>Reason</th><th>Status</th><th /></tr></thead><tbody>
              {d.data.map((c) => <tr key={c.id}><td>{c.employee && c.employee.name}</td><td>{fmtDate(c.date)}</td><td>{c.checkIn}{c.checkOut ? ` - ${c.checkOut}` : ''}</td><td>{c.reason}</td><td><Badge value={c.status} /></td><td>{c.status === 'pending' && <Button small onClick={() => setTarget(c)}>Review</Button>}</td></tr>)}
            </tbody></table></div>
            <Pagination pagination={d.pagination} onPage={setPage} />
          </>
        )}</Async>
      </Card>
      {target && (
        <Modal title="Review correction" onClose={() => setTarget(null)}>
          <p><b>{target.employee && target.employee.name}</b> - {fmtDate(target.date)}<br />{target.checkIn}{target.checkOut ? ` to ${target.checkOut}` : ''}<br /><i>{target.reason}</i></p>
          <Field label="Comment (required to reject)"><textarea rows={2} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} /></Field>
          <div className="form-actions"><Button variant="danger" loading={busy} onClick={() => decide('reject')}>Reject</Button><Button loading={busy} onClick={() => decide('approve')}>Approve</Button></div>
        </Modal>
      )}
    </>
  );
}
