import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthShell, { passwordProblem } from './AuthShell.jsx';
import { Button, Field, Card, PageHeader } from '../components/ui.jsx';
import { api, setToken } from '../api.js';
import { useAuth } from '../context/Auth.jsx';
import { useToast } from '../context/Toast.jsx';

export default function ChangePassword({ forced = false }) {
  const { startSession, logout } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [v, setV] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    const er = {};
    if (!v.currentPassword) er.currentPassword = 'Required';
    const pp = passwordProblem(v.newPassword);
    if (pp) er.newPassword = pp;
    if (v.newPassword !== v.confirm) er.confirm = 'Passwords do not match';
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      const r = await api.post('/auth/change-password', { currentPassword: v.currentPassword, newPassword: v.newPassword });
      setToken(r.data.token); // other sessions are signed out by the server
      startSession(r.data);
      toast.success('Password changed.');
      nav('/');
    } catch (err) { setErrors({ form: err.message }); } finally { setBusy(false); }
  }

  const form = (
    <form onSubmit={submit} noValidate>
      <Field label="Current (temporary) password" error={errors.currentPassword}><input type="password" value={v.currentPassword} onChange={set('currentPassword')} autoComplete="current-password" /></Field>
      <Field label="New password" error={errors.newPassword} hint="8+ characters with a letter and a number"><input type="password" value={v.newPassword} onChange={set('newPassword')} autoComplete="new-password" /></Field>
      <Field label="Confirm new password" error={errors.confirm}><input type="password" value={v.confirm} onChange={set('confirm')} autoComplete="new-password" /></Field>
      {errors.form && <div className="alert alert-error" role="alert">{errors.form}</div>}
      <Button type="submit" loading={busy}>Change password</Button>
    </form>
  );
  if (forced) {
    return (
      <AuthShell title="Choose a new password" subtitle="Your account uses a temporary password. You must change it before continuing.">
        {form}
        <p className="center"><button className="link-btn" onClick={() => { logout(); nav('/login'); }}>Sign out</button></p>
      </AuthShell>
    );
  }
  return (<><PageHeader title="Change password" /><Card className="narrow">{form}</Card></>);
}
