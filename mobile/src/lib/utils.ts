import type { DistanceUnit, Unit } from "../types";

const LBS_PER_KG = 2.2046226218;

export function toLbs(value: number, unit: Unit): number {
  return unit === "lbs" ? value : value * LBS_PER_KG;
}

export function fromLbs(value: number, unit: Unit): number {
  return unit === "lbs" ? value : value / LBS_PER_KG;
}

export function convertUnit(value: number, from: Unit, to: Unit): number {
  return from === to ? value : fromLbs(toLbs(value, from), to);
}

export function formatWeight(value: number | null, unit: Unit | null): string {
  if (value == null) return "BW";
  return `${value % 1 === 0 ? value : value.toFixed(1)} ${unit ?? "lbs"}`;
}

export function formatHeight(value: number | null, unit: DistanceUnit | null): string {
  if (value == null) return "—";
  return `${value % 1 === 0 ? value : value.toFixed(1)} ${unit ?? "in"}`;
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null) return "--";
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) return `${hrs}h ${mins % 60}m`;
  return `${mins}m`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
