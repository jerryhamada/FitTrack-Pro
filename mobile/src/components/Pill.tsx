import { StyleSheet, Text, View } from "react-native";
import { colors, font, spacing } from "../theme";

type Tone = "default" | "accent" | "danger";

interface PillProps {
  children: React.ReactNode;
  tone?: Tone;
}

export default function Pill({ children, tone = "default" }: PillProps) {
  return (
    <View style={[styles.pill, toneStyles[tone]]}>
      <Text style={[styles.text, textStyles[tone]]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 999,
  },
  text: {
    fontSize: font.xs,
    fontWeight: "600",
  },
});

const toneStyles = StyleSheet.create({
  default: { backgroundColor: "rgba(255,255,255,0.08)" },
  accent: { backgroundColor: colors.accentDim },
  danger: { backgroundColor: colors.dangerDim },
});

const textStyles = StyleSheet.create({
  default: { color: colors.muted },
  accent: { color: colors.accent },
  danger: { color: colors.danger },
});
