import { useState } from 'react';
import AuthShell, { EMAIL_RE, passwordProblem } from './AuthShell.jsx';
import { Button, Field, fieldErrors } from '../components/ui.jsx';
import { api } from '../api.js';
import { useAuth } from '../context/Auth.jsx';
import { useToast } from '../context/Toast.jsx';

export default function Setup({ onDone }) {
  const { startSession } = useAuth();
  const toast = useToast();
  const [v, setV] = useState({ companyName: '', adminName: '', adminEmail: '', adminPassword: '', confirm: '', seedDefaults: true });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function submit(e) {
    e.preventDefault();
    const er = {};
    if (!v.companyName.trim()) er.companyName = 'Required';
    if (!v.adminName.trim()) er.adminName = 'Required';
    if (!EMAIL_RE.test(v.adminEmail)) er.adminEmail = 'Enter a valid email';
    const pp = passwordProblem(v.adminPassword);
    if (pp) er.adminPassword = pp;
    if (v.confirm !== v.adminPassword) er.confirm = 'Passwords do not match';
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      const r = await api.post('/setup', { companyName: v.companyName, adminName: v.adminName, adminEmail: v.adminEmail, adminPassword: v.adminPassword, seedDefaults: v.seedDefaults });
      startSession(r.data);
      toast.success('Company created. Welcome!');
      onDone();
    } catch (err) {
      setErrors({ ...fieldErrors(err), form: err.message });
    } finally { setBusy(false); }
  }

  return (
    <AuthShell title="Set up your company" subtitle="First run: create the company and the Admin account.">
      <form onSubmit={submit} noValidate>
        <Field label="Company name" error={errors.companyName}><input value={v.companyName} onChange={set('companyName')} maxLength={120} autoFocus /></Field>
        <Field label="Admin name" error={errors.adminName}><input value={v.adminName} onChange={set('adminName')} maxLength={120} /></Field>
        <Field label="Admin email" error={errors.adminEmail}><input type="email" value={v.adminEmail} onChange={set('adminEmail')} autoComplete="username" /></Field>
        <Field label="Password" error={errors.adminPassword} hint="8+ characters with a letter and a number"><input type="password" value={v.adminPassword} onChange={set('adminPassword')} autoComplete="new-password" /></Field>
        <Field label="Confirm password" error={errors.confirm}><input type="password" value={v.confirm} onChange={set('confirm')} autoComplete="new-password" /></Field>
        <label className="check"><input type="checkbox" checked={v.seedDefaults} onChange={set('seedDefaults')} /> Create the default leave types (Annual 14, Sick 8, Casual 10, Unpaid)</label>
        {errors.form && <div className="alert alert-error" role="alert">{errors.form}</div>}
        <Button type="submit" loading={busy}>Create company</Button>
      </form>
    </AuthShell>
  );
}
