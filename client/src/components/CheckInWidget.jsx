import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Button, Badge } from './ui.jsx';
import { fmtTime, fmtMinutes, errMsg } from '../hooks.js';
import { useToast } from '../context/Toast.jsx';

/** Check in / out. The server stamps the time; this widget only triggers the action. */
export default function CheckInWidget({ onChange }) {
  const toast = useToast();
  const [state, setState] = useState({ loading: true, record: null, error: null });
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  const load = () => api.get('/attendance/today').then((r) => setState({ loading: false, record: r.data.record, error: null })).catch((e) => setState({ loading: false, record: null, error: e }));
  useEffect(() => { load(); const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);

  async function act(kind) {
    setBusy(true);
    try {
      const r = await api.post(`/attendance/${kind}`);
      setState({ loading: false, record: r.data, error: null });
      toast.success(kind === 'check-in' ? (r.data.late ? 'Checked in (late).' : 'Checked in. Have a great day!') : `Checked out. Worked ${fmtMinutes(r.data.workedMinutes)}.`);
      onChange && onChange();
    } catch (e) {
      toast.error(errMsg(e));
      load();
    } finally { setBusy(false); }
  }

  const { loading, record, error } = state;
  if (loading) return <div className="muted">Loading attendance...</div>;
  if (error) return <div className="alert alert-error">{error.message} <button className="btn btn-small" onClick={load}>Retry</button></div>;
  const running = record && !record.checkOut ? Math.max(0, Math.floor((now - new Date(record.checkIn).getTime()) / 60000)) : null;
  return (
    <div className="checkin">
      <div>
        <div className="checkin-status">{!record ? 'Not checked in yet' : record.checkOut ? 'Day complete' : 'You are checked in'} {record && <Badge value={record.status} />}</div>
        <div className="muted">
          {record ? `In ${fmtTime(record.checkIn)}${record.checkOut ? ` - Out ${fmtTime(record.checkOut)} - ${fmtMinutes(record.workedMinutes)}` : ` - ${fmtMinutes(running)} so far`}` : 'Time is recorded by the server when you press the button.'}
        </div>
      </div>
      <div className="checkin-actions">
        {!record && <Button loading={busy} onClick={() => act('check-in')}>Check in</Button>}
        {record && !record.checkOut && <Button loading={busy} variant="danger" onClick={() => act('check-out')}>Check out</Button>}
      </div>
    </div>
  );
}
