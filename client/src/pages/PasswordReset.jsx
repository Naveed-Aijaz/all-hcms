import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthShell, { EMAIL_RE, passwordProblem } from './AuthShell.jsx';
import { Button, Field } from '../components/ui.jsx';
import { api } from '../api.js';
import { useToast } from '../context/Toast.jsx';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) return setError('Enter a valid email');
    setError('');
    setBusy(true);
    try { await api.post('/auth/forgot-password', { email }); setSent(true); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <AuthShell title="Forgot password" subtitle="We will email you a link that is valid for a short time and works once.">
      {sent ? (
        <div className="alert alert-success">If an account exists for that email, a reset link has been sent. Check your inbox.</div>
      ) : (
        <form onSubmit={submit} noValidate>
          <Field label="Email" error={error}><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></Field>
          <Button type="submit" loading={busy}>Send reset link</Button>
        </form>
      )}
      <p className="center"><Link to="/login">Back to sign in</Link></p>
    </AuthShell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const nav = useNavigate();
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const er = {};
    const pp = passwordProblem(pw);
    if (pp) er.pw = pp;
    if (pw !== confirm) er.confirm = 'Passwords do not match';
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: pw });
      toast.success('Password updated. Please sign in.');
      nav('/login');
    } catch (err) { setErrors({ form: err.message }); } finally { setBusy(false); }
  }

  if (!/^[a-f0-9]{64}$/.test(token)) {
    return <AuthShell title="Reset password"><div className="alert alert-error">This reset link is not valid. <Link to="/forgot-password">Request a new one</Link>.</div></AuthShell>;
  }
  return (
    <AuthShell title="Choose a new password">
      <form onSubmit={submit} noValidate>
        <Field label="New password" error={errors.pw} hint="8+ characters with a letter and a number"><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" autoFocus /></Field>
        <Field label="Confirm new password" error={errors.confirm}><input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" /></Field>
        {errors.form && <div className="alert alert-error" role="alert">{errors.form} <Link to="/forgot-password">Request a new link</Link></div>}
        <Button type="submit" loading={busy}>Update password</Button>
      </form>
    </AuthShell>
  );
}
