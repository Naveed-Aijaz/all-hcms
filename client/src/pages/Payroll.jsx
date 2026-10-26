import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/Auth.jsx';
import { useToast } from '../context/Toast.jsx';
import { useFetch, fmtMoney, monthNow, errMsg } from '../hooks.js';
import { Async, Badge, Button, Card, Confirm, Field, PageHeader, Pagination, StatCard } from '../components/ui.jsx';

function RunDetail({ id, canFinalize, onChanged }) {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const state = useFetch(() => api.get(`/payroll/runs/${id}`, { page, limit: 25 }), [id, page]);

  async function finalize() {
    setBusy(true);
    try { await api.post(`/payroll/runs/${id}/finalize`); toast.success('Payroll finalized and locked. Employees were notified.'); setConfirm(false); state.reload(); onChanged(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <Async state={state}>{(r) => {
      const run = r.data.run;
      return (
        <Card title={`Payroll ${run.month}`} actions={<><Badge value={run.status} />{canFinalize && run.status === 'draft' && <Button small onClick={() => setConfirm(true)}>Finalize</Button>}</>}>
          <div className="stats stats-small">
            <StatCard label="Employees" value={run.totals.headcount} />
            <StatCard label="Gross payable" value={fmtMoney(run.totals.gross)} />
            <StatCard label="Deductions" value={fmtMoney(run.totals.deduction)} />
            <StatCard label="Tax" value={fmtMoney(run.totals.tax)} />
            <StatCard label="Net pay" value={fmtMoney(run.totals.net)} tone="green" />
          </div>
          <div className="table-wrap"><table>
            <thead><tr><th>Employee</th><th>Gross</th><th>Work days</th><th>Absent</th><th>Unpaid</th><th>Half</th><th>Paid leave</th><th>Deduction</th><th>Tax</th><th>Net</th></tr></thead>
            <tbody>{r.data.payslips.map((p) => <tr key={p.id}><td>{p.employee.name}<div className="muted small">{p.employee.code}</div></td><td>{fmtMoney(p.gross)}</td><td>{p.eligibleDays}/{p.workingDays}</td><td>{p.absentDays}</td><td>{p.unpaidLeaveDays}</td><td>{p.halfDays}</td><td>{p.paidLeaveDays}</td><td>{fmtMoney(p.deduction)}</td><td>{fmtMoney(p.tax)}</td><td><b>{fmtMoney(p.net)}</b></td></tr>)}</tbody>
          </table></div>
          <Pagination pagination={r.pagination} onPage={setPage} />
          {confirm && <Confirm title="Finalize payroll?" message={`This locks ${run.month}. It can no longer be recalculated or edited.`} loading={busy} onConfirm={finalize} onClose={() => setConfirm(false)} />}
        </Card>
      );
    }}</Async>
  );
}

export default function Payroll() {
  const { user } = useAuth();
  const toast = useToast();
  const [month, setMonth] = useState(monthNow());
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const runs = useFetch(() => api.get('/payroll/runs').then((r) => r.data), []);

  async function run() {
    setBusy(true);
    try { const r = await api.post('/payroll/runs', { month }); toast.success(`Draft for ${month} calculated.`); setSelected(r.data.id); runs.reload(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <>
      <PageHeader title="Payroll" />
      {user.role === 'hr' && (
        <Card title="Run payroll">
          <div className="inline-form"><Field label="Month"><input type="month" value={month} max={monthNow()} onChange={(e) => setMonth(e.target.value)} /></Field><Button loading={busy} onClick={run}>Create / recalculate draft</Button></div>
          <small className="muted">Only the Admin can finalize a draft. Recalculating replaces the draft with current attendance and leave data.</small>
        </Card>
      )}
      <Card title="Payroll runs">
        <Async state={runs} empty={(d) => d.length === 0}>{(d) => (
          <div className="table-wrap"><table><thead><tr><th>Month</th><th>Status</th><th>Employees</th><th>Gross payable</th><th>Net</th><th /></tr></thead><tbody>
            {d.map((r) => <tr key={r.id} className={selected === r.id ? 'row-active' : ''}><td>{r.month}</td><td><Badge value={r.status} /></td><td>{r.totals.headcount}</td><td>{fmtMoney(r.totals.gross)}</td><td>{fmtMoney(r.totals.net)}</td><td><Button small variant="ghost" onClick={() => setSelected(r.id)}>Open</Button></td></tr>)}
          </tbody></table></div>
        )}</Async>
      </Card>
      {selected && <RunDetail id={selected} canFinalize={user.role === 'admin'} onChanged={runs.reload} />}
      <Card title="How payroll is calculated">
        <ul className="bullets small">
          <li>Gross = basic + 40% HRA + 10% medical (= 1.5 x basic). Per-day = gross / working days in the month (weekends and public holidays excluded).</li>
          <li>Deducted days = absent days + unpaid leave days + 0.5 x half days. Paid leave, holidays and weekends are never deducted.</li>
          <li>Joiners and leavers are prorated by their eligible working days. Today and future days of the current month are treated as worked.</li>
          <li>Tax = annual slab on gross x 12, divided by 12 (illustrative slabs). Net = payable gross - tax.</li>
        </ul>
      </Card>
    </>
  );
}
