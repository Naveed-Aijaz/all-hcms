import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastCtx = createContext(null);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((type, message) => {
    const id = Math.random().toString(36).slice(2);
    setItems((s) => [...s, { id, type, message }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), type === 'error' ? 6000 : 3500);
  }, []);
  const value = useMemo(() => ({ success: (m) => push('success', m), error: (m) => push('error', m), info: (m) => push('info', m) }), [push]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`} role="status">{t.message}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
