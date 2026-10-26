export default function AuthShell({ title, subtitle, children }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand brand-lg">HCM Lite</div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Same policy as the server: 8-72 chars, at least one letter and one number. */
export function passwordProblem(p) {
  if (!p || p.length < 8) return 'At least 8 characters';
  if (p.length > 72) return 'At most 72 characters';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Must contain a letter and a number';
  return null;
}
