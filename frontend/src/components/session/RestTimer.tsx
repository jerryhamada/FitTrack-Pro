import { useEffect, useRef, useState } from "react";

export default function RestTimer({ resetSignal }: { resetSignal: number }) {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setSeconds(0);
    setRunning(true);
  }, [resetSignal]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <div className="flex items-center justify-between rounded-xl bg-bg p-3">
      <div>
        <p className="text-[11px] uppercase tracking-wide text-muted">Rest Timer</p>
        <p className="text-2xl font-bold tabular-nums text-accent">
          {mins}:{String(secs).padStart(2, "0")}
        </p>
      </div>
      <div className="flex gap-2">
        <button className="btn-secondary !h-10 !px-3 text-xs" onClick={() => setRunning((r) => !r)}>
          {running ? "Pause" : "Resume"}
        </button>
        <button className="btn-secondary !h-10 !px-3 text-xs" onClick={() => setSeconds(0)}>
          Reset
        </button>
      </div>
    </div>
  );
}
