import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";
import { colors, font, spacing } from "../theme";
import { REGION_VIEW, type MuscleRegion } from "../lib/muscles";

interface BodyDiagramProps {
  primary: MuscleRegion | null;
  secondary: MuscleRegion[];
}

type Emphasis = "primary" | "secondary" | "none";

const BASE = "#2a2f3a"; // muted body fill — medical-illustration neutral
const OUTLINE = "#3a4150";

/** A muscle region as one or more simple shapes on a given view. */
type Shape =
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { kind: "rect"; x: number; y: number; w: number; h: number; r?: number };

// Region → shapes per view. Coordinates are in a 100 × 240 viewBox per figure.
const FRONT: Partial<Record<MuscleRegion, Shape[]>> = {
  shoulders: [
    { kind: "ellipse", cx: 30, cy: 62, rx: 8, ry: 7 },
    { kind: "ellipse", cx: 70, cy: 62, rx: 8, ry: 7 },
  ],
  chest: [
    { kind: "ellipse", cx: 42, cy: 74, rx: 9, ry: 7 },
    { kind: "ellipse", cx: 58, cy: 74, rx: 9, ry: 7 },
  ],
  biceps: [
    { kind: "ellipse", cx: 24, cy: 84, rx: 5, ry: 9 },
    { kind: "ellipse", cx: 76, cy: 84, rx: 5, ry: 9 },
  ],
  core: [{ kind: "rect", x: 42, y: 84, w: 16, h: 26, r: 5 }],
  forearms: [
    { kind: "ellipse", cx: 19, cy: 104, rx: 4.5, ry: 10 },
    { kind: "ellipse", cx: 81, cy: 104, rx: 4.5, ry: 10 },
  ],
  quads: [
    { kind: "ellipse", cx: 42, cy: 150, rx: 7, ry: 20 },
    { kind: "ellipse", cx: 58, cy: 150, rx: 7, ry: 20 },
  ],
};

const BACK: Partial<Record<MuscleRegion, Shape[]>> = {
  shoulders: [
    { kind: "ellipse", cx: 30, cy: 62, rx: 8, ry: 7 },
    { kind: "ellipse", cx: 70, cy: 62, rx: 8, ry: 7 },
  ],
  back: [
    { kind: "rect", x: 38, y: 70, w: 24, h: 22, r: 6 },
    { kind: "rect", x: 42, y: 92, w: 16, h: 14, r: 4 },
  ],
  triceps: [
    { kind: "ellipse", cx: 24, cy: 84, rx: 5, ry: 9 },
    { kind: "ellipse", cx: 76, cy: 84, rx: 5, ry: 9 },
  ],
  forearms: [
    { kind: "ellipse", cx: 19, cy: 104, rx: 4.5, ry: 10 },
    { kind: "ellipse", cx: 81, cy: 104, rx: 4.5, ry: 10 },
  ],
  glutes: [
    { kind: "ellipse", cx: 43, cy: 124, rx: 8, ry: 8 },
    { kind: "ellipse", cx: 57, cy: 124, rx: 8, ry: 8 },
  ],
  hamstrings: [
    { kind: "ellipse", cx: 42, cy: 152, rx: 7, ry: 18 },
    { kind: "ellipse", cx: 58, cy: 152, rx: 7, ry: 18 },
  ],
  calves: [
    { kind: "ellipse", cx: 42, cy: 196, rx: 6, ry: 15 },
    { kind: "ellipse", cx: 58, cy: 196, rx: 6, ry: 15 },
  ],
};

function emphasisOf(
  region: MuscleRegion,
  primary: MuscleRegion | null,
  secondary: MuscleRegion[]
): Emphasis {
  if (region === primary) return "primary";
  if (secondary.includes(region)) return "secondary";
  return "none";
}

function fillFor(e: Emphasis): string {
  if (e === "primary") return colors.accent;
  if (e === "secondary") return colors.accent + "40"; // translucent
  return BASE;
}

function strokeFor(e: Emphasis): string | undefined {
  return e === "secondary" ? colors.accent : undefined;
}

function FigureSvg({
  shapes,
  primary,
  secondary,
  width = 120,
  height = 264,
}: {
  shapes: Partial<Record<MuscleRegion, Shape[]>>;
  primary: MuscleRegion | null;
  secondary: MuscleRegion[];
  width?: number;
  height?: number;
}) {
  // Silhouette outline — a clean, generic humanoid built from soft shapes so the
  // muscle overlays read clearly on top. Muted, no internal clutter.
  return (
    <Svg width={width} height={height} viewBox="0 0 100 240">
        {/* base body */}
        <Circle cx={50} cy={22} r={12} fill={BASE} />
        <Rect x={40} y={34} width={20} height={8} rx={3} fill={BASE} />
        {/* torso */}
        <Path
          d="M34 46 Q50 40 66 46 L64 112 Q50 118 36 112 Z"
          fill={BASE}
          stroke={OUTLINE}
          strokeWidth={0.5}
        />
        {/* arms */}
        <Path d="M34 48 Q22 52 18 74 L16 116 L23 116 L27 78 Q30 58 36 56 Z" fill={BASE} />
        <Path d="M66 48 Q78 52 82 74 L84 116 L77 116 L73 78 Q70 58 64 56 Z" fill={BASE} />
        {/* pelvis + legs */}
        <Path d="M36 110 Q50 116 64 110 L62 130 L50 134 L38 130 Z" fill={BASE} />
        <Path d="M38 128 L36 210 L46 210 L50 136 Z" fill={BASE} />
        <Path d="M62 128 L64 210 L54 210 L50 136 Z" fill={BASE} />

        {/* muscle overlays */}
        {(Object.keys(shapes) as MuscleRegion[]).map((region) => {
          const e = emphasisOf(region, primary, secondary);
          if (e === "none") return null; // keep it clean — only show highlighted regions
          const fill = fillFor(e);
          const stroke = strokeFor(e);
          return shapes[region]!.map((sh, i) =>
            sh.kind === "ellipse" ? (
              <Ellipse
                key={`${region}-${i}`}
                cx={sh.cx}
                cy={sh.cy}
                rx={sh.rx}
                ry={sh.ry}
                fill={fill}
                stroke={stroke}
                strokeWidth={stroke ? 1.5 : 0}
              />
            ) : (
              <Rect
                key={`${region}-${i}`}
                x={sh.x}
                y={sh.y}
                width={sh.w}
                height={sh.h}
                rx={sh.r ?? 0}
                fill={fill}
                stroke={stroke}
                strokeWidth={stroke ? 1.5 : 0}
              />
            )
          );
        })}
    </Svg>
  );
}

function Figure({
  shapes,
  primary,
  secondary,
  label,
}: {
  shapes: Partial<Record<MuscleRegion, Shape[]>>;
  primary: MuscleRegion | null;
  secondary: MuscleRegion[];
  label: string;
}) {
  return (
    <View style={styles.figure}>
      <FigureSvg shapes={shapes} primary={primary} secondary={secondary} />
      <Text style={styles.figureLabel}>{label}</Text>
    </View>
  );
}

/** Compact single-figure thumbnail highlighting one muscle — used on the
 * Exercise Library category cards. Picks whichever silhouette view (front/back)
 * shows the region best. */
export function MuscleThumb({ muscle, width = 44 }: { muscle: MuscleRegion; width?: number }) {
  const view = REGION_VIEW[muscle]?.[0] ?? "front";
  return (
    <FigureSvg
      shapes={view === "front" ? FRONT : BACK}
      primary={muscle}
      secondary={[]}
      width={width}
      height={width * 2.2}
    />
  );
}

export default function BodyDiagram({ primary, secondary }: BodyDiagramProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.figures}>
        <Figure shapes={FRONT} primary={primary} secondary={secondary} label="Front" />
        <Figure shapes={BACK} primary={primary} secondary={secondary} label="Back" />
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: colors.accent }]} />
          <Text style={styles.legendText}>Primary</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: colors.accent + "40", borderColor: colors.accent, borderWidth: 1 }]} />
          <Text style={styles.legendText}>Secondary</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: spacing.sm },
  figures: { flexDirection: "row", justifyContent: "center", gap: spacing.xl },
  figure: { alignItems: "center", gap: spacing.xs },
  figureLabel: { color: colors.muted, fontSize: font.xs, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1 },
  legend: { flexDirection: "row", gap: spacing.lg },
  legendItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  legendText: { color: colors.muted, fontSize: font.xs },
});
