import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell, { EMAIL_RE } from './AuthShell.jsx';
import { Button, Field } from '../components/ui.jsx';
import { api } from '../api.js';
import { useAuth } from '../context/Auth.jsx';
import { useToast } from '../context/Toast.jsx';

export default function Login() {
  const { startSession } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const er = {};
    if (!EMAIL_RE.test(email)) er.email = 'Enter a valid email';
    if (!password) er.password = 'Enter your password';
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      const r = await api.post('/auth/login', { email, password });
      startSession(r.data);
      if (r.data.user.mustChangePassword) { toast.info('Please choose a new password to continue.'); nav('/change-password'); } else nav('/');
    } catch (err) {
      setErrors({ form: err.status === 429 ? err.message : err.message });
    } finally { setBusy(false); }
  }

  return (
    <AuthShell title="Sign in" subtitle="Use the email and password given to you by your administrator or HR.">
      <form onSubmit={submit} noValidate>
        <Field label="Email" error={errors.email}><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoFocus /></Field>
        <Field label="Password" error={errors.password}><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>
        {errors.form && <div className="alert alert-error" role="alert">{errors.form}</div>}
        <Button type="submit" loading={busy}>Sign in</Button>
        <p className="center"><Link to="/forgot-password">Forgot your password?</Link></p>
      </form>
    </AuthShell>
  );
}
