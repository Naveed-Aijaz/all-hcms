import { useCallback, useEffect, useRef, useState } from 'react';

/** Runs `fn` on mount and whenever `deps` change; exposes loading/error/reload. */
export function useFetch(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const seq = useRef(0);
  const run = useCallback(() => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve()
      .then(fn)
      .then((data) => { if (id === seq.current) setState({ data, loading: false, error: null }); })
      .catch((error) => { if (id === seq.current) setState({ data: null, loading: false, error }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { run(); }, [run]);
  return { ...state, reload: run };
}

export const fmtDate = (s) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '-');
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-');
export const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '-');
export const fmtMoney = (n) => (n === null || n === undefined ? '-' : Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
export const fmtMinutes = (m) => `${Math.floor((m || 0) / 60)}h ${String((m || 0) % 60).padStart(2, '0')}m`;
export const monthNow = () => new Date().toISOString().slice(0, 7);
export const errMsg = (e) => (e && e.message) || 'Something went wrong';
