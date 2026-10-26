import { useEffect } from 'react';

export const Spinner = ({ label = 'Loading...' }) => (
  <div className="center-pad" role="status"><span className="spinner" aria-hidden="true" /> <span>{label}</span></div>
);

export const ErrorBox = ({ error, onRetry }) => (
  <div className="alert alert-error" role="alert">
    <span>{(error && error.message) || String(error)}</span>
    {onRetry && <button className="btn btn-small" onClick={onRetry}>Retry</button>}
  </div>
);

export const Empty = ({ children = 'Nothing here yet.' }) => <div className="empty">{children}</div>;

/** Loading / error / empty handling in one place. */
export function Async({ state, children, empty }) {
  if (state.loading && !state.data) return <Spinner />;
  if (state.error) return <ErrorBox error={state.error} onRetry={state.reload} />;
  if (empty && state.data && empty(state.data)) return <Empty>{typeof empty === 'function' ? 'No records found.' : empty}</Empty>;
  return children(state.data);
}

export const Button = ({ loading, children, variant = 'primary', small, ...rest }) => (
  <button className={`btn btn-${variant}${small ? ' btn-small' : ''}`} disabled={loading || rest.disabled} {...rest}>
    {loading ? 'Please wait...' : children}
  </button>
);

export function Field({ label, error, hint, children }) {
  return (
    <label className={`field${error ? ' has-error' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && !error && <small className="hint">{hint}</small>}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="Close">x</button></div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

const STATUS_COLORS = {
  present: 'green', approved: 'green', active: 'green', finalized: 'green', true: 'green',
  late: 'amber', pending: 'amber', draft: 'amber', half_day: 'amber', probation: 'amber', missing_checkout: 'amber', not_marked: 'gray',
  absent: 'red', rejected: 'red', exited: 'red', cancelled: 'gray', false: 'gray',
  on_leave: 'blue', holiday: 'blue', weekend: 'gray', off: 'gray', upcoming: 'gray', 'n/a': 'gray',
};
export const Badge = ({ value, label }) => <span className={`badge badge-${STATUS_COLORS[String(value)] || 'gray'}`}>{label || String(value).replace(/_/g, ' ')}</span>;

export const StatCard = ({ label, value, sub, tone }) => (
  <div className={`stat${tone ? ` stat-${tone}` : ''}`}>
    <div className="stat-value">{value === null || value === undefined ? '-' : value}</div>
    <div className="stat-label">{label}</div>
    {sub && <div className="stat-sub">{sub}</div>}
  </div>
);

export function Pagination({ pagination, onPage }) {
  if (!pagination || pagination.pages <= 1) return pagination ? <div className="pager-info">{pagination.total} record(s)</div> : null;
  return (
    <div className="pager">
      <button className="btn btn-small" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>Previous</button>
      <span>Page {pagination.page} of {pagination.pages} ({pagination.total})</span>
      <button className="btn btn-small" disabled={pagination.page >= pagination.pages} onClick={() => onPage(pagination.page + 1)}>Next</button>
    </div>
  );
}

export const Card = ({ title, actions, children, className = '' }) => (
  <section className={`card ${className}`}>
    {(title || actions) && <div className="card-head"><h3>{title}</h3><div className="card-actions">{actions}</div></div>}
    {children}
  </section>
);

export const PageHeader = ({ title, children }) => <div className="page-head"><h1>{title}</h1><div className="page-actions">{children}</div></div>;

/** Maps server validation details to { field: message } for inline form errors. */
export const fieldErrors = (err) => Object.fromEntries(((err && err.details) || []).map((d) => [d.field, d.message]));

export function Confirm({ title, message, onConfirm, onClose, loading, danger }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p>{message}</p>
      <div className="form-actions"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>Confirm</Button></div>
    </Modal>
  );
}
