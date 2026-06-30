import { useEffect, useState } from "react";
import { setToastListener } from "../../lib/toast";

export default function ToastHost() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setToastListener((msg) => setMessage(msg));
    return () => setToastListener(null);
  }, []);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(t);
  }, [message]);

  if (!message) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 md:bottom-6">
      <div className="flex items-start justify-between gap-3 rounded-xl border border-danger bg-surface px-4 py-3 text-sm text-white shadow-lg">
        <span>{message}</span>
        <button className="text-muted hover:text-white" onClick={() => setMessage(null)} aria-label="Dismiss">
          ×
        </button>
      </div>
    </div>
  );
}
