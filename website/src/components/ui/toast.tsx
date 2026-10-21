'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

const ToastContext = createContext<(message: string) => void>(() => undefined);

/** `const toast = useToast(); toast('Saved')` */
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; message: string }[]>([]);

  const show = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current.slice(-2), { id, message }]);
    setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 3200);
  }, []);

  const value = useMemo(() => show, [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((item) => <div key={item.id} className="toast">{item.message}</div>)}
      </div>
    </ToastContext.Provider>
  );
}
