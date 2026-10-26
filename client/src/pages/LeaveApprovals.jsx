import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/Auth.jsx';
import { useToast } from '../context/Toast.jsx';
import { useFetch, fmtDate, errMsg } from '../hooks.js';
import { Async, Badge, Button, Card, Field, Modal, PageHeader, Pagination } from '../components/ui.jsx';

export default function LeaveApprovals() {
  const { user } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const state = useFetch(() => api.get('/leaves', { status, page, limit: 15 }), [status, page]);

  async function decide(decision) {
    if (decision === 'reject' && !comment.trim()) return toast.error('Please add a comment when rejecting.');
    setBusy(true);
    try {
      await api.post(`/leaves/${target.id}/decision`, { decision, comment: comment.trim() || undefined });
      toast.success(`Leave ${decision === 'approve' ? 'approved' : 'rejected'}. The employee was notified.`);
      setTarget(null); setComment(''); state.reload();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  const title = user.role === 'manager' ? 'Team leave approvals' : user.role === 'admin' ? 'Leave requests (view; Admin decides HR staff requests only)' : 'Leave approvals';
  return (
    <>
      <PageHeader title={title} />
      <Card>
        <div className="filters"><label>Status <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option><option value="">All</option></select></label></div>
        <Async state={state} empty={(d) => d.data.length === 0}>{(d) => (
          <>
            <div className="table-wrap"><table><thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th>Days</th><th>Reason</th><th>Status</th><th /></tr></thead><tbody>
              {d.data.map((l) => <tr key={l.id}><td>{l.employee.name}<div className="muted small">{l.employee.code}</div></td><td>{l.leaveType.name}</td><td>{fmtDate(l.startDate)} - {fmtDate(l.endDate)}</td><td>{l.days}</td><td>{l.reason || '-'}</td><td><Badge value={l.status} />{l.decisionComment && <div className="muted small">{l.decisionComment}</div>}</td>
                <td>{l.status === 'pending' && l.employee.id !== user.employeeId && <Button small onClick={() => setTarget(l)}>Review</Button>}</td></tr>)}
            </tbody></table></div>
            <Pagination pagination={d.pagination} onPage={setPage} />
          </>
        )}</Async>
      </Card>
      {target && (
        <Modal title="Review leave request" onClose={() => setTarget(null)}>
          <p><b>{target.employee.name}</b> - {target.leaveType.name}<br />{fmtDate(target.startDate)} to {fmtDate(target.endDate)} ({target.days} working day(s))<br /><i>{target.reason || 'No reason given'}</i></p>
          <Field label="Comment (required to reject)"><textarea rows={2} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} /></Field>
          <div className="form-actions"><Button variant="danger" loading={busy} onClick={() => decide('reject')}>Reject</Button><Button loading={busy} onClick={() => decide('approve')}>Approve</Button></div>
        </Modal>
      )}
    </>
  );
}
