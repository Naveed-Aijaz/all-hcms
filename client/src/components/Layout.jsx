import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/Auth.jsx';
import { api, assetUrl } from '../api.js';
import AiChat from './AiChat.jsx';

const MENUS = {
  admin: [['/', 'Dashboard'], ['/employees', 'Employees'], ['/attendance/board', 'Attendance board'], ['/leave/approvals', 'Leave (HR staff)'], ['/payroll', 'Payroll'], ['/payslips', 'Payslips'], ['/org', 'Organization setup'], ['/users', 'Logins'], ['/announcements', 'Announcements'], ['/audit', 'Audit log']],
  hr: [['/', 'Dashboard'], ['/employees', 'Employees'], ['/attendance', 'My attendance'], ['/attendance/board', 'Attendance board'], ['/attendance/corrections', 'Corrections'], ['/leave', 'My leave'], ['/leave/approvals', 'Leave approvals'], ['/payroll', 'Payroll'], ['/payslips', 'My payslips'], ['/announcements', 'Announcements']],
  manager: [['/', 'Dashboard'], ['/employees', 'My team'], ['/attendance', 'My attendance'], ['/attendance/board', 'Team attendance'], ['/attendance/corrections', 'Team corrections'], ['/leave', 'My leave'], ['/leave/approvals', 'Team leave approvals'], ['/payslips', 'My payslips'], ['/announcements', 'Announcements']],
  employee: [['/', 'Dashboard'], ['/attendance', 'My attendance'], ['/leave', 'My leave'], ['/payslips', 'My payslips'], ['/announcements', 'Announcements']],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () => api.get('/notifications', { unread: 'true', limit: 1 }).then((r) => alive && setUnread(r.unread || 0)).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const menu = MENUS[user.role] || [];
  const close = () => setOpen(false);
  return (
    <div className="shell">
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="brand">HCM Lite</div>
        <nav onClick={close}>
          {menu.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>{label}</NavLink>
          ))}
        </nav>
      </aside>
      {open && <div className="scrim" onClick={close} />}
      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" aria-label="Toggle menu" onClick={() => setOpen((o) => !o)}>=</button>
          <div className="spacer" />
          <button className="icon-btn bell" onClick={() => nav('/notifications')} aria-label={`Notifications (${unread} unread)`}>
            Alerts{unread > 0 && <span className="bell-count">{unread > 99 ? '99+' : unread}</span>}
          </button>
          <button className="user-chip" onClick={() => nav(user.employeeId ? '/profile' : '/account')} title="Profile">
            {user.photo ? <img src={assetUrl(`/uploads/profiles/${user.photo}`)} alt="" className="avatar" /> : <span className="avatar avatar-ph">{user.name.slice(0, 1).toUpperCase()}</span>}
            <span className="user-meta"><b>{user.name}</b><small>{user.role}</small></span>
          </button>
          <button className="btn btn-small btn-ghost" onClick={() => { logout(); nav('/login'); }}>Sign out</button>
        </header>
        <main className="content"><Outlet /></main>
      </div>
      <AiChat />
    </div>
  );
}
