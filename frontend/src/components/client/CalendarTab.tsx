import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import Spinner from "../ui/Spinner";
import Modal from "../ui/Modal";
import { categoryColor, formatDateTime } from "../../lib/utils";
import { ChevronLeftIcon } from "../layout/icons";

export default function CalendarTab({ clientId }: { clientId: number }) {
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["calendar", clientId, year, month],
    queryFn: () => api.clients.calendar(clientId, year, month),
  });

  const grid = useMemo(() => {
    const firstWeekday = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const cells: (number | null)[] = Array(firstWeekday).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [year, month]);

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  }

  const dayMap = new Map(data?.days.map((d) => [d.date, d]) ?? []);
  const selectedDay = selectedDate ? dayMap.get(selectedDate) : null;

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => shiftMonth(-1)} className="rounded-lg p-1.5 text-muted hover:bg-white/5 hover:text-white">
          <ChevronLeftIcon />
        </button>
        <span className="text-sm font-semibold text-white">
          {new Date(year, month - 1).toLocaleString(undefined, { month: "long", year: "numeric" })}
        </span>
        <button onClick={() => shiftMonth(1)} className="rounded-lg p-1.5 text-muted hover:bg-white/5 hover:text-white">
          <ChevronLeftIcon style={{ transform: "rotate(180deg)" }} />
        </button>
      </div>

      {isLoading && <Spinner />}

      {!isLoading && (
        <>
          <div className="mb-1 grid grid-cols-7 text-center text-[11px] text-muted">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map((d, i) => {
              if (d === null) return <div key={i} />;
              const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              const day = dayMap.get(dateStr);
              return (
                <button
                  key={i}
                  onClick={() => day && setSelectedDate(dateStr)}
                  className={`flex aspect-square flex-col items-center justify-center rounded-lg text-xs ${
                    day ? "bg-bg font-semibold text-white hover:bg-white/10" : "text-muted"
                  }`}
                >
                  {d}
                  {day && (
                    <div className="mt-0.5 flex gap-0.5">
                      {day.sessions.slice(0, 3).map((s) => (
                        <span
                          key={s.id}
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: categoryColor(s.category) }}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      <Modal open={!!selectedDay} onClose={() => setSelectedDate(null)} title={selectedDate ?? ""}>
        <div className="flex flex-col gap-2">
          {selectedDay?.sessions.map((s) => (
            <button
              key={s.id}
              className="flex items-center justify-between rounded-xl bg-bg p-3 text-left hover:bg-white/5"
              onClick={() => navigate(`/sessions/${s.id}/summary`)}
            >
              <div>
                <p className="text-sm font-medium text-white">{s.label ?? "Session"}</p>
                <p className="text-xs text-muted">{formatDateTime(s.started_at)}</p>
              </div>
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: categoryColor(s.category) }} />
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
