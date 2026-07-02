import { StyleSheet, Text, View } from "react-native";
import { colors, font, spacing } from "../theme";

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export default function EmptyState({ title, subtitle, action }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {action && <View style={styles.action}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: spacing.xl,
  },
  title: {
    fontSize: font.md,
    fontWeight: "600",
    color: colors.white,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: font.sm,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 20,
  },
  action: {
    marginTop: spacing.base,
  },
});
