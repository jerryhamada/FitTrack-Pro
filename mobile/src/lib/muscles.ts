// Shared body-region taxonomy — the single source of truth for muscle regions
// used by the Add Exercise body map (Workout Logging), the Exercise Library
// filters/form, and the anatomy diagram in Exercise Detail. Keep these in sync;
// they must match the backend `muscle_group` / `secondary_muscles` values.

export const MUSCLE_REGIONS = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "core",
  "forearms",
] as const;

export type MuscleRegion = (typeof MUSCLE_REGIONS)[number];

export const MUSCLE_LABELS: Record<MuscleRegion, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
  core: "Core",
  forearms: "Forearms",
};

// Which silhouette view each region reads best on. Some show on both.
export const REGION_VIEW: Record<MuscleRegion, ("front" | "back")[]> = {
  chest: ["front"],
  shoulders: ["front", "back"],
  biceps: ["front"],
  forearms: ["front", "back"],
  core: ["front"],
  quads: ["front"],
  back: ["back"],
  triceps: ["back"],
  glutes: ["back"],
  hamstrings: ["back"],
  calves: ["back"],
};
