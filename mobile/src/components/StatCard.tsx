import { StyleSheet, Text, View } from "react-native";
import { colors, font, radius, spacing } from "../theme";

interface StatCardProps {
  label: string;
  value: string;
  accent?: boolean;
}

export default function StatCard({ label, value, accent }: StatCardProps) {
  return (
    <View style={[styles.card, accent && styles.accentCard]}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    alignItems: "center",
  },
  accentCard: {
    borderColor: colors.accent + "40",
    backgroundColor: colors.accentDim,
  },
  value: {
    fontSize: font.xl,
    fontWeight: "700",
    color: colors.white,
    marginBottom: 4,
  },
  label: {
    fontSize: font.xs,
    color: colors.muted,
    textAlign: "center",
  },
});
