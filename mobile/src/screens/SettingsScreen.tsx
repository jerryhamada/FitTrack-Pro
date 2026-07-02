import { useClerk } from "@clerk/clerk-expo";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Btn from "../components/Btn";
import Input from "../components/Input";
import Spinner from "../components/Spinner";
import { api } from "../lib/api";
import { colors, font, radius, spacing } from "../theme";

export default function SettingsScreen() {
  const { signOut } = useClerk();
  const { data: trainer, isLoading } = useQuery({
    queryKey: ["trainer-me"],
    queryFn: api.trainer.me,
  });
  const { data: subscription } = useQuery({
    queryKey: ["subscription"],
    queryFn: api.trainer.subscription,
  });

  const [businessName, setBusinessName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [defaultUnit, setDefaultUnit] = useState<"lbs" | "kg">("lbs");

  useEffect(() => {
    if (trainer?.profile) {
      setBusinessName(trainer.profile.business_name ?? "");
      setLogoUrl(trainer.profile.logo_url ?? "");
      setDefaultUnit(trainer.profile.default_unit);
    }
  }, [trainer]);

  const save = useMutation({
    mutationFn: () =>
      api.trainer.update({
        business_name: businessName,
        logo_url: logoUrl,
        default_unit: defaultUnit,
      }),
    onSuccess: () => Alert.alert("Saved", "Settings updated."),
    onError: (e) => Alert.alert("Error", (e as Error).message),
  });

  if (isLoading) return <Spinner />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Branding</Text>
        <Text style={styles.sectionHint}>
          Name/logo appear on exports in a future phase.
        </Text>
        <Input
          label="Business name"
          value={businessName}
          onChangeText={setBusinessName}
          placeholder="My Training Co."
        />
        <Input
          label="Logo URL"
          value={logoUrl}
          onChangeText={setLogoUrl}
          placeholder="https://..."
          keyboardType="url"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Default unit</Text>
        <Text style={styles.sectionHint}>
          Applied to new clients (each client can override individually).
        </Text>
        <View style={styles.unitRow}>
          {(["lbs", "kg"] as const).map((u) => (
            <TouchableOpacity
              key={u}
              style={[styles.unitBtn, defaultUnit === u && styles.unitBtnActive]}
              onPress={() => setDefaultUnit(u)}
            >
              <Text style={[styles.unitBtnText, defaultUnit === u && styles.unitBtnTextActive]}>
                {u}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <Text style={styles.sectionHint}>
          Push/email notification preferences land in a later phase.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subscription</Text>
        <Text style={styles.subscriptionStatus}>
          Status: {subscription?.status ?? "—"}
        </Text>
        <Text style={styles.sectionHint}>
          Billing isn't live in Phase 1 — this is a stub for the future SaaS layer.
        </Text>
      </View>

      <Btn
        label={save.isPending ? "Saving..." : "Save Settings"}
        onPress={() => save.mutate()}
        loading={save.isPending}
        fullWidth
      />

      <View style={styles.divider} />

      <Btn
        label="Sign out"
        variant="danger"
        onPress={() =>
          Alert.alert("Sign out", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            { text: "Sign out", style: "destructive", onPress: () => signOut() },
          ])
        }
        fullWidth
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.base, gap: spacing.base },
  title: { fontSize: font.xl, fontWeight: "700", color: colors.white },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    gap: spacing.sm,
  },
  sectionTitle: { fontSize: font.base, fontWeight: "600", color: colors.white },
  sectionHint: { fontSize: font.xs, color: colors.muted },
  unitRow: {
    flexDirection: "row",
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  unitBtn: { flex: 1, padding: spacing.sm, alignItems: "center" },
  unitBtnActive: { backgroundColor: colors.accent },
  unitBtnText: { fontWeight: "600", fontSize: font.sm, color: colors.muted },
  unitBtnTextActive: { color: "#000" },
  subscriptionStatus: { fontSize: font.sm, color: colors.white },
  divider: { height: 1, backgroundColor: colors.border },
});
