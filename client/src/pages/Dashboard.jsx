import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Pie, PieChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../context/Auth.jsx';
import { useToast } from '../context/Toast.jsx';
import { api } from '../api.js';
import { useFetch, fmtDateTime, fmtMinutes, fmtMoney, errMsg } from '../hooks.js';
import { Async, Button, Card, Empty, PageHeader, StatCard } from '../components/ui.jsx';
import CheckInWidget from '../components/CheckInWidget.jsx';

const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777'];
const pctText = (v) => (v === null || v === undefined ? '-' : `${v}%`);

function Announcements({ items }) {
  return (
    <Card title="Announcements" actions={<Link to="/announcements">All</Link>}>
      {items.length === 0 ? <Empty>No announcements yet.</Empty> : items.map((a) => (
        <div key={a.id} className="ann"><b>{a.title}</b><div>{a.body}</div><small className="muted">{a.authorName} - {fmtDateTime(a.createdAt)}</small></div>
      ))}
    </Card>
  );
}

function Filters({ f, setF, departments }) {
  return (
    <div className="filters">
      <label>From <input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
      <label>To <input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
      <label>Department
        <select value={f.departmentId} onChange={(e) => setF({ ...f, departmentId: e.target.value })}>
          <option value="">All</option>
          {(departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </label>
    </div>
  );
}

function AiSummary({ which, f }) {
  const toast = useToast();
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try { setState((await api.post('/ai/summary', { dashboard: which, from: f.from || undefined, to: f.to || undefined, departmentId: f.departmentId || undefined })).data); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <Card title="AI summary" actions={<Button small loading={busy} onClick={run}>Summarize</Button>}>
      {!state ? <div className="muted">Click Summarize for 3-5 insights based only on the numbers on this page.</div> : (
        <>
          <ul className="bullets">{state.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
          <small className="muted">{state.aiGenerated ? 'AI-generated from the dashboard numbers.' : 'AI is unavailable; showing a basic automatic summary.'}</small>
        </>
      )}
    </Card>
  );
}

function AttendanceCharts({ att }) {
  return (
    <div className="grid2">
      <Card title="Attendance trend (%)">
        {att.trend.length === 0 ? <Empty>No attendance data in this range.</Empty> : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={att.trend.map((t) => ({ ...t, day: t.date.slice(5) }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis domain={[0, 100]} /><Tooltip /><Line type="monotone" dataKey="rate" name="Attendance rate" stroke="#2563eb" dot={false} /></LineChart>
          </ResponsiveContainer>
        )}
      </Card>
      <Card title="Absenteeism by department (%)">
        {att.byDepartment.length === 0 ? <Empty>No data.</Empty> : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={att.byDepartment.map((d) => ({ name: d.name, absenteeism: d.absenteeismPercent || 0 }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="absenteeism" fill="#dc2626" /></BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}

function LeaveAndLate({ leave, att }) {
  return (
    <div className="grid2">
      <Card title="Leave by type (approved days in range)">
        {leave.byType.every((t) => t.approvedDays === 0) ? <Empty>No approved leave in this range.</Empty> : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={leave.byType.map((t) => ({ name: t.name, days: t.approvedDays }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="days" fill="#16a34a" /></BarChart>
          </ResponsiveContainer>
        )}
        <div className="table-wrap"><table><thead><tr><th>Type</th><th>Used this year</th><th>Utilization</th></tr></thead><tbody>
          {leave.byType.map((t) => <tr key={t.code}><td>{t.name}</td><td>{t.approvedDaysYear}</td><td>{t.quotaPerEmployee === null ? 'unlimited' : pctText(t.utilizationPercent)}</td></tr>)}
        </tbody></table></div>
      </Card>
      <Card title="Top 5 late-comers">
        {att.lateComers.length === 0 ? <Empty>No late arrivals in this range.</Empty> : (
          <div className="table-wrap"><table><thead><tr><th>Employee</th><th>Late arrivals</th></tr></thead><tbody>
            {att.lateComers.map((l) => <tr key={l.employeeId}><td>{l.name} <small className="muted">{l.code}</small></td><td>{l.lateCount}</td></tr>)}
          </tbody></table></div>
        )}
      </Card>
    </div>
  );
}

function useFilters() {
  const [f, setF] = useState({ from: '', to: '', departmentId: '' });
  const params = { from: f.from, to: f.to, departmentId: f.departmentId };
  return [f, setF, params];
}

function HrDashboard() {
  const [f, setF, params] = useFilters();
  const departments = useFetch(() => api.get('/departments').then((r) => r.data), []);
  const state = useFetch(() => api.get('/dashboard/hr', params).then((r) => r.data), [f.from, f.to, f.departmentId]);
  return (
    <>
      <PageHeader title="HR dashboard" />
      <Filters f={f} setF={setF} departments={departments.data} />
      <Async state={state}>{(d) => (
        <>
          <div className="stats">
            <StatCard label="Headcount" value={d.kpis.headcount} />
            <StatCard label="Present today" value={d.kpis.presentToday} tone="green" />
            <StatCard label="On leave today" value={d.kpis.onLeaveToday} tone="blue" />
            <StatCard label="Late today" value={d.kpis.lateToday} tone="amber" />
            <StatCard label="Pending approvals" value={d.kpis.pendingApprovals} sub={`${d.kpis.pendingLeaves} leave, ${d.kpis.pendingCorrections} corrections`} tone="red" />
            <StatCard label="Attendance rate" value={pctText(d.attendance.attendanceRate)} sub={`${d.attendance.from} to ${d.attendance.to}`} />
            <StatCard label="Late %" value={pctText(d.attendance.latePercent)} />
            <StatCard label="Absenteeism" value={pctText(d.attendance.absenteeismPercent)} />
          </div>
          <AiSummary which="hr" f={f} />
          <AttendanceCharts att={d.attendance} />
          <LeaveAndLate leave={d.leave} att={d.attendance} />
          <Announcements items={d.announcements} />
        </>
      )}</Async>
    </>
  );
}

function AdminDashboard() {
  const [f, setF, params] = useFilters();
  const departments = useFetch(() => api.get('/departments').then((r) => r.data), []);
  const state = useFetch(() => api.get('/dashboard/admin', params).then((r) => r.data), [f.from, f.to, f.departmentId]);
  return (
    <>
      <PageHeader title="Company dashboard" />
      <Filters f={f} setF={setF} departments={departments.data} />
      <Async state={state}>{(d) => (
        <>
          <div className="stats">
            <StatCard label="Headcount" value={d.kpis.headcount} />
            <StatCard label="Attrition YTD" value={pctText(d.kpis.attritionYtdPercent)} sub={`${d.kpis.exitsYtd} exit(s)`} tone="red" />
            <StatCard label="Payroll cost (latest)" value={d.kpis.payrollCostLatest ? fmtMoney(d.kpis.payrollCostLatest.gross) : '-'} sub={d.kpis.payrollCostLatest ? `${d.kpis.payrollCostLatest.month}${d.kpis.payrollCostLatest.finalized ? '' : ' (draft)'}` : 'No payroll yet'} />
            <StatCard label="Average gross salary" value={fmtMoney(d.kpis.avgGross)} />
            <StatCard label="Present today" value={d.kpis.presentToday} tone="green" />
            <StatCard label="On leave today" value={d.kpis.onLeaveToday} tone="blue" />
            <StatCard label="Attendance rate" value={pctText(d.attendance.attendanceRate)} />
          </div>
          <AiSummary which="admin" f={f} />
          <div className="grid2">
            <Card title="Headcount by department">{d.headcountByDepartment.length === 0 ? <Empty>No employees yet.</Empty> : (
              <ResponsiveContainer width="100%" height={240}><BarChart data={d.headcountByDepartment}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="headcount" fill="#2563eb" /></BarChart></ResponsiveContainer>)}</Card>
            <Card title="Payroll cost by month">{d.payrollCostByMonth.length === 0 ? <Empty>Run payroll to see costs.</Empty> : (
              <ResponsiveContainer width="100%" height={240}><BarChart data={d.payrollCostByMonth}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend /><Bar dataKey="gross" name="Gross payable" fill="#2563eb" /><Bar dataKey="net" name="Net" fill="#16a34a" /></BarChart></ResponsiveContainer>)}</Card>
          </div>
          <div className="grid2">
            <Card title="Payroll cost by department (latest month)">{d.payrollCostByDepartment.length === 0 ? <Empty>No payroll yet.</Empty> : (
              <ResponsiveContainer width="100%" height={240}><BarChart data={d.payrollCostByDepartment}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="gross" name="Gross payable" fill="#7c3aed" /></BarChart></ResponsiveContainer>)}</Card>
            <Card title="Average gross by department / designation">
              <div className="table-wrap"><table><thead><tr><th>Department</th><th>Avg gross</th></tr></thead><tbody>{d.avgGrossByDepartment.map((x) => <tr key={x.name}><td>{x.name}</td><td>{fmtMoney(x.avgGross)}</td></tr>)}</tbody></table></div>
              <div className="table-wrap"><table><thead><tr><th>Designation</th><th>Avg gross</th></tr></thead><tbody>{d.avgGrossByDesignation.map((x) => <tr key={x.name}><td>{x.name}</td><td>{fmtMoney(x.avgGross)}</td></tr>)}</tbody></table></div>
            </Card>
          </div>
          <div className="grid2">
            <Card title="Gender">{Object.values(d.gender).every((v) => !v) ? <Empty>No data.</Empty> : (
              <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={Object.entries(d.gender).filter(([, v]) => v).map(([name, value]) => ({ name, value }))} dataKey="value" nameKey="name" outerRadius={80} label>{Object.keys(d.gender).map((k, i) => <Cell key={k} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>)}</Card>
            <Card title="Tenure"><ResponsiveContainer width="100%" height={220}><BarChart data={Object.entries(d.tenure).map(([name, value]) => ({ name, value }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#0891b2" /></BarChart></ResponsiveContainer></Card>
          </div>
          <AttendanceCharts att={d.attendance} />
          <LeaveAndLate leave={d.leave} att={d.attendance} />
          <div className="grid2">
            <Announcements items={d.announcements} />
            <Card title="Recent activity" actions={<Link to="/audit">Audit log</Link>}>
              {d.auditFeed.length === 0 ? <Empty>No activity.</Empty> : d.auditFeed.map((a) => <div key={a.id} className="feed"><b>{a.actor}</b> <small className="muted">{a.action}</small><div>{a.summary}</div><small className="muted">{fmtDateTime(a.createdAt)}</small></div>)}
            </Card>
          </div>
        </>
      )}</Async>
    </>
  );
}

function SelfDashboard() {
  const { user } = useAuth();
  const state = useFetch(() => api.get('/dashboard/me').then((r) => r.data), []);
  const team = useFetch(() => (user.role === 'manager' ? api.get('/attendance/board').then((r) => r.data) : Promise.resolve(null)), [user.role]);
  return (
    <>
      <PageHeader title={`Hello, ${user.name.split(' ')[0]}`} />
      <Card title="Today"><CheckInWidget onChange={state.reload} /></Card>
      <Async state={state}>{(d) => {
        const k = d.kpis;
        const pct = Math.min(100, Math.round((k.weekMinutes / k.weekTargetMinutes) * 100));
        return (
          <>
            <div className="stats">
              <StatCard label="Hours this week" value={fmtMinutes(k.weekMinutes)} sub={`of 40h (${pct}%)`} />
              <StatCard label="Late arrivals this month" value={k.lateCountThisMonth} tone="amber" />
              <StatCard label="Absent days this month" value={k.monthSummary.absent} tone="red" />
              <StatCard label="Last payslip" value={k.lastPayslip ? fmtMoney(k.lastPayslip.net) : '-'} sub={k.lastPayslip ? `${k.lastPayslip.month} net` : 'None yet'} />
              <StatCard label="Unread notifications" value={k.unreadNotifications} />
            </div>
            <div className="progress" aria-label="Weekly hours"><div style={{ width: `${pct}%` }} /></div>
            <div className="grid2">
              <Card title="Leave balance" actions={<Link to="/leave">Apply</Link>}>
                <div className="table-wrap"><table><thead><tr><th>Type</th><th>Quota</th><th>Used</th><th>Pending</th><th>Left</th></tr></thead><tbody>
                  {k.leaveBalances.map((b) => <tr key={b.code}><td>{b.name}</td><td>{b.unlimited ? 'unlimited' : b.quota}</td><td>{b.used}</td><td>{b.pending}</td><td>{b.unlimited ? '-' : b.remaining}</td></tr>)}
                </tbody></table></div>
              </Card>
              <Announcements items={d.announcements} />
            </div>
            {user.role === 'manager' && team.data && (
              <Card title={`My team today (${team.data.date})`} actions={<Link to="/attendance/board">Open board</Link>}>
                <div className="stats stats-small">{Object.entries(team.data.summary).filter(([, v]) => v).map(([s, v]) => <StatCard key={s} label={s.replace(/_/g, ' ')} value={v} />)}</div>
                {team.data.data.length === 0 && <Empty>No direct reports yet.</Empty>}
              </Card>
            )}
          </>
        );
      }}</Async>
    </>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  if (user.role === 'admin') return <AdminDashboard />;
  if (user.role === 'hr') return <HrDashboard />;
  return <SelfDashboard />;
}
