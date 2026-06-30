export default function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        className="stepper-btn"
        onClick={() => onChange(Math.max(min, round(value - step)))}
        aria-label="decrease"
      >
        −
      </button>
      <div className="min-w-[64px] text-center text-2xl font-bold text-white tabular-nums">
        {value}
        {suffix && <span className="ml-1 text-sm font-medium text-muted">{suffix}</span>}
      </div>
      <button type="button" className="stepper-btn" onClick={() => onChange(round(value + step))} aria-label="increase">
        +
      </button>
    </div>
  );
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
