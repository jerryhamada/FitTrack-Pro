import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, font, spacing } from "../theme";

export interface BarDatum {
  label: string; // shown when the bar is tapped
  value: number;
  marked?: boolean; // renders a 🏆 above the bar (PR moments)
}

interface MiniBarChartProps {
  data: BarDatum[];
  unit?: string; // appended to the tapped-value readout
  height?: number;
}

/** Dependency-free vertical bar chart. Tap a bar to read its exact value. */
export default function MiniBarChart({ data, unit, height = 110 }: MiniBarChartProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={styles.readout}>
        {selected != null
          ? `${data[selected].label}: ${Math.round(data[selected].value * 10) / 10}${unit ? ` ${unit}` : ""}`
          : "Tap a bar for details"}
      </Text>
      <View style={[styles.chart, { height }]}>
        {data.map((d, i) => (
          <Pressable
            key={`${d.label}-${i}`}
            style={styles.barSlot}
            onPress={() => setSelected(selected === i ? null : i)}
          >
            {d.marked && <Text style={styles.marker}>🏆</Text>}
            <View
              style={[
                styles.bar,
                {
                  height: Math.max(3, (d.value / max) * (height - (d.marked ? 22 : 8))),
                  backgroundColor:
                    selected === i ? colors.white : d.value > 0 ? colors.accent : colors.border,
                },
              ]}
            />
          </Pressable>
        ))}
      </View>
      {data.length > 1 && (
        <View style={styles.axis}>
          <Text style={styles.axisLabel}>{data[0].label}</Text>
          <Text style={styles.axisLabel}>{data[data.length - 1].label}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { fontSize: font.xs, color: colors.muted },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  barSlot: { flex: 1, height: "100%", justifyContent: "flex-end", alignItems: "center" },
  bar: { borderRadius: 2, width: "100%" },
  marker: { fontSize: 11, marginBottom: 1 },
  axis: { flexDirection: "row", justifyContent: "space-between" },
  axisLabel: { fontSize: font.xs, color: colors.muted },
});
