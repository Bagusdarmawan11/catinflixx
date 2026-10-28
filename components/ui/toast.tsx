"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";

/* ── Types ── */
export type ToastType = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  leaving?: boolean;
}

interface ToastCtx {
  toast: (message: string, type?: ToastType) => void;
}

/* ── Context ── */
const ToastContext = createContext<ToastCtx | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

/* ── Individual toast pill ── */
function ToastPill({
  item,
  onRemove,
}: {
  item: ToastItem;
  onRemove: (id: string) => void;
}) {
  /* trigger leave animation then actually remove */
  function dismiss() {
    onRemove(item.id);
  }

  /* auto-dismiss after 3.5 s */
  useEffect(() => {
    const t = setTimeout(dismiss, 3500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const styles: Record<ToastType, { icon: React.ReactNode; ring: string; bar: string }> = {
    success: {
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />,
      ring: "border-emerald-500/30",
      bar: "bg-emerald-500",
    },
    error: {
      icon: <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />,
      ring: "border-red-500/30",
      bar: "bg-red-500",
    },
    info: {
      icon: <Info className="w-5 h-5 text-blue-400 flex-shrink-0" />,
      ring: "border-blue-500/30",
      bar: "bg-blue-500",
    },
    warning: {
      icon: <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />,
      ring: "border-amber-500/30",
      bar: "bg-amber-500",
    },
  };

  const s = styles[item.type];

  return (
    <div
      className={`
        relative overflow-hidden
        flex items-center gap-3
        bg-gray-900/95 backdrop-blur-md
        border ${s.ring}
        text-white px-4 py-3 rounded-xl
        shadow-2xl shadow-black/50
        min-w-[260px] max-w-sm w-full
        ${item.leaving ? "toast-leave" : "toast-enter"}
      `}
    >
      {/* Coloured left bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${s.bar} rounded-l-xl`} />

      <div className="ml-1">{s.icon}</div>
      <p className="text-sm flex-1 leading-snug">{item.message}</p>

      <button
        onClick={dismiss}
        className="text-gray-500 hover:text-white transition-colors flex-shrink-0"
        aria-label="Tutup notifikasi"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ── Provider ── */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const removeToast = useCallback((id: string) => {
    /* mark as leaving first so animation plays */
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
    );
    /* remove from DOM after animation ends (~260ms) */
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 280);
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = `toast-${++counter.current}`;
      setToasts((prev) => [...prev, { id, message, type }]);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Portal-like fixed container */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-5 right-4 z-[9999] flex flex-col-reverse gap-2 items-end pointer-events-none"
      >
        {toasts.map((item) => (
          <div key={item.id} className="pointer-events-auto">
            <ToastPill item={item} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
