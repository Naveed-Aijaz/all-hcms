import { useState } from 'react';
import { useFetch, fmtMinutes, fmtTime, monthNow } from '../hooks.js';
import { Async, Badge } from './ui.jsx';

const shift = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };
const LABEL = { present: 'P', late: 'L', half_day: 'H', missing_checkout: 'M', absent: 'A', on_leave: 'LV', holiday: 'HOL', weekend: '', not_marked: '-', upcoming: '', 'n/a': '' };

/** Month grid of attendance statuses. `load(month)` must return the /attendance month view. */
export default function MonthCalendar({ load, refreshKey }) {
  const [month, setMonth] = useState(monthNow());
  const state = useFetch(() => load(month), [month, refreshKey]);
  return (
    <div>
      <div className="cal-nav">
        <button className="btn btn-small" onClick={() => setMonth(shift(month, -1))}>Prev</button>
        <b>{month}</b>
        <button className="btn btn-small" onClick={() => setMonth(shift(month, 1))}>Next</button>
      </div>
      <Async state={state}>{(d) => {
        const first = new Date(`${d.month}-01T00:00:00Z`).getUTCDay();
        const lead = (first + 6) % 7; // Monday first
        const s = d.summary;
        return (
          <>
            <div className="cal-head">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((x) => <div key={x}>{x}</div>)}</div>
            <div className="cal-grid">
              {Array.from({ length: lead }).map((_, i) => <div key={`b${i}`} className="cal-cell cal-blank" />)}
              {d.days.map((day) => (
                <div key={day.date} className={`cal-cell cal-${day.status}`} title={`${day.date}: ${day.status.replace(/_/g, ' ')}${day.holiday ? ` (${day.holiday})` : ''}${day.checkIn ? ` | ${fmtTime(day.checkIn)} - ${fmtTime(day.checkOut)}` : ''}`}>
                  <span className="cal-day">{Number(day.date.slice(8))}</span>
                  <span className="cal-tag">{LABEL[day.status] ?? ''}</span>
                </div>
              ))}
            </div>
            <div className="legend">P present - L late - H half day - M missing check-out - A absent - LV leave - HOL holiday</div>
            <div className="badges">
              <Badge value="present" label={`Present ${s.present}`} /> <Badge value="late" label={`Late ${s.late}`} /> <Badge value="half_day" label={`Half ${s.half_day}`} />
              <Badge value="missing_checkout" label={`No check-out ${s.missing_checkout}`} /> <Badge value="absent" label={`Absent ${s.absent}`} /> <Badge value="on_leave" label={`Leave ${s.on_leave}`} />
              <span className="muted"> Worked {fmtMinutes(s.workedMinutes)} over {s.workingDays} working day(s)</span>
            </div>
          </>
        );
      }}</Async>
    </div>
  );
}
