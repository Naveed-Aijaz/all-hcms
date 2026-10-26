import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/Auth.jsx';
import { useToast } from '../context/Toast.jsx';
import { useFetch, fmtMoney, errMsg } from '../hooks.js';
import { Async, Badge, Button, Card, Modal, PageHeader, Pagination } from '../components/ui.jsx';

function Row({ k, v, bold }) { return <tr className={bold ? 'row-bold' : ''}><td>{k}</td><td className="num">{v}</td></tr>; }

export default function Payslips() {
  const { user } = useAuth();
  const toast = useToast();
  const privileged = user.role === 'admin' || user.role === 'hr';
  const [employeeId, setEmployeeId] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const employees = useFetch(() => (privileged ? api.get('/employees', { limit: 100 }).then((r) => r.data) : Promise.resolve([])), []);
  const state = useFetch(() => (privileged && !employeeId ? Promise.resolve({ data: [], pagination: null, hint: true }) : api.get('/payroll/payslips', { page, limit: 12, employeeId: privileged ? employeeId : undefined })), [employeeId, page]);

  async function pdf(p) { try { await api.download(`/payroll/payslips/${p.id}/pdf`); } catch (e) { toast.error(errMsg(e)); } }
  return (
    <>
      <PageHeader title={privileged ? 'Payslips' : 'My payslips'} />
      <Card>
        {privileged && <div className="filters"><label>Employee <select value={employeeId} onChange={(e) => { setEmployeeId(e.target.value); setPage(1); }}><option value="">Select an employee...</option>{(employees.data || []).map((e) => <option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}</select></label></div>}
        <Async state={state} empty={(d) => d.data.length === 0 && !d.hint}>{(d) => d.hint ? <div className="muted">Choose an employee to see their payslips.</div> : (
          <>
            <div className="table-wrap"><table><thead><tr><th>Month</th><th>Gross</th><th>Deduction</th><th>Tax</th><th>Net</th><th>Status</th><th /></tr></thead><tbody>
              {d.data.map((p) => <tr key={p.id}><td>{p.month}</td><td>{fmtMoney(p.payableGross)}</td><td>{fmtMoney(p.deduction)}</td><td>{fmtMoney(p.tax)}</td><td><b>{fmtMoney(p.net)}</b></td><td><Badge value={p.finalized ? 'finalized' : 'draft'} /></td><td><Button small variant="ghost" onClick={() => setOpen(p)}>View</Button> <Button small onClick={() => pdf(p)}>PDF</Button></td></tr>)}
            </tbody></table></div>
            <Pagination pagination={d.pagination} onPage={setPage} />
          </>
        )}</Async>
      </Card>
      {open && (
        <Modal title={`Payslip ${open.month}`} onClose={() => setOpen(null)}>
          <p><b>{open.employee.name}</b> ({open.employee.code})<br /><span className="muted">{open.employee.department} {open.employee.designation && `- ${open.employee.designation}`}</span></p>
          <table className="slip"><tbody>
            <Row k="Basic" v={fmtMoney(open.basic)} /><Row k="HRA" v={fmtMoney(open.hra)} /><Row k="Medical" v={fmtMoney(open.medical)} /><Row k="Gross (monthly)" v={fmtMoney(open.gross)} bold />
            <Row k={`Working days ${open.eligibleDays}/${open.workingDays}`} v={fmtMoney(open.earnedGross)} />
            <Row k={`Absent ${open.absentDays}, unpaid leave ${open.unpaidLeaveDays}, half days ${open.halfDays}`} v={`- ${fmtMoney(open.deduction)}`} />
            <Row k="Payable gross" v={fmtMoney(open.payableGross)} bold /><Row k="Income tax" v={`- ${fmtMoney(open.tax)}`} /><Row k="Net pay" v={fmtMoney(open.net)} bold />
          </tbody></table>
          <div className="form-actions"><Button onClick={() => pdf(open)}>Download PDF</Button></div>
        </Modal>
      )}
    </>
  );
}
