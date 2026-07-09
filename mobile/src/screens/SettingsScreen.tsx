import { useClerk } from "@clerk/clerk-expo";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Clipboard, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Btn from "../components/Btn";
import Input from "../components/Input";
import Spinner from "../components/Spinner";
import { useRoleOverride, type PreviewRole } from "../contexts/RoleOverride";
import { api } from "../lib/api";
import { APP_ENV, IS_DEV_BUILD } from "../lib/env";
import { colors, font, radius, spacing } from "../theme";

export default function SettingsScreen() {
  const { signOut } = useClerk();
  const qc = useQueryClient();
  const { override, setOverride, clearOverride } = useRoleOverride();
  const { data: trainer, isLoading } = useQuery({
    queryKey: ["trainer-me"],
    queryFn: api.trainer.me,
  });
  const { data: subscription } = useQuery({
    queryKey: ["subscription"],
    queryFn: api.trainer.subscription,
  });

  // Same cache key as AddClientScreen so the code stays in sync between screens.
  const { data: joinCode } = useQuery({
    queryKey: ["trainer", "join-code"],
    queryFn: api.trainer.joinCode,
  });
  const generateCode = useMutation({
    mutationFn: api.trainer.generateJoinCode,
    onSuccess: (res) => qc.setQueryData(["trainer", "join-code"], res),
    onError: (err) => Alert.alert("Error", (err as Error).message),
  });
  const [codeCopied, setCodeCopied] = useState(false);

  const [businessName, setBusinessName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [defaultUnit, setDefaultUnit] = useState<"lbs" | "kg">("lbs");
  const [defaultDistanceUnit, setDefaultDistanceUnit] = useState<"in" | "cm">("in");

  useEffect(() => {
    if (trainer?.profile) {
      setBusinessName(trainer.profile.business_name ?? "");
      setLogoUrl(trainer.profile.logo_url ?? "");
      setDefaultUnit(trainer.profile.default_unit);
      setDefaultDistanceUnit(trainer.profile.default_distance_unit);
    }
  }, [trainer]);

  const save = useMutation({
    mutationFn: () =>
      api.trainer.update({
        business_name: businessName,
        logo_url: logoUrl,
        default_unit: defaultUnit,
        default_distance_unit: defaultDistanceUnit,
      }),
    onSuccess: () => Alert.alert("Saved", "Settings updated."),
    onError: (e) => Alert.alert("Error", (e as Error).message),
  });

  if (isLoading) return <Spinner />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      {/* Excluded from the render tree entirely in production builds. */}
      {IS_DEV_BUILD && (
        <View style={[styles.section, styles.devSection]}>
          <Text style={styles.devSectionTitle}>Developer Options</Text>
          <Text style={styles.sectionHint}>Build: {APP_ENV}</Text>
          <Text style={styles.devLabel}>Preview as:</Text>
          <View style={styles.unitRow}>
            {(["trainer", "client"] as PreviewRole[]).map((role) => {
              const active = (override ?? "trainer") === role;
              return (
                <TouchableOpacity
                  key={role}
                  style={[styles.unitBtn, active && styles.devBtnActive]}
                  onPress={() => setOverride(role === "trainer" ? null : role)}
                >
                  <Text style={[styles.unitBtnText, active && { color: "#000" }]}>
                    {role === "trainer" ? "Trainer" : "Client"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.sectionHint}>
            Dev only — switches which view renders for this account. Session-only; resets on
            logout, never saved to the database.
          </Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your trainer code</Text>
        <Text style={styles.sectionHint}>
          Share this code with clients — they enter it when signing up (or later in their app) to
          get matched to you as their trainer.
        </Text>
        {joinCode?.code ? (
          <>
            <Text style={styles.code} selectable>
              {joinCode.code}
            </Text>
            <TouchableOpacity
              style={styles.copyBtn}
              onPress={() => {
                Clipboard.setString(joinCode.code!);
                setCodeCopied(true);
                setTimeout(() => setCodeCopied(false), 1500);
              }}
            >
              <Text style={styles.copyBtnText}>{codeCopied ? "Copied!" : "Copy code"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  "Generate a new code?",
                  "Your current code stops working immediately — anyone still holding it won't be able to join.",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Generate new code", onPress: () => generateCode.mutate() },
                  ]
                )
              }
              disabled={generateCode.isPending}
            >
              <Text style={styles.regenerate}>Generate a new code</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Btn
            label={generateCode.isPending ? "Creating..." : "Create my code"}
            onPress={() => generateCode.mutate()}
            loading={generateCode.isPending}
            fullWidth
          />
        )}
      </View>

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
        <Text style={styles.sectionTitle}>Default height unit</Text>
        <Text style={styles.sectionHint}>
          Used for height-based exercises (box jumps, box-assisted push-ups, etc).
        </Text>
        <View style={styles.unitRow}>
          {(["in", "cm"] as const).map((u) => (
            <TouchableOpacity
              key={u}
              style={[styles.unitBtn, defaultDistanceUnit === u && styles.unitBtnActive]}
              onPress={() => setDefaultDistanceUnit(u)}
            >
              <Text style={[styles.unitBtnText, defaultDistanceUnit === u && styles.unitBtnTextActive]}>
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
            {
              text: "Sign out",
              style: "destructive",
              onPress: () => {
                clearOverride(); // role override is session-only — never survives logout
                signOut();
              },
            },
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
  code: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.accent,
    letterSpacing: 6,
    textAlign: "center",
    fontFamily: "monospace",
    paddingVertical: spacing.sm,
  },
  copyBtn: {
    backgroundColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    alignItems: "center",
  },
  copyBtnText: { color: colors.white, fontWeight: "600", fontSize: font.sm },
  regenerate: { fontSize: font.sm, color: colors.muted, textAlign: "center", textDecorationLine: "underline" },
  divider: { height: 1, backgroundColor: colors.border },
  devSection: { borderColor: "#3b82f6" + "60", borderStyle: "dashed" },
  devSectionTitle: { fontSize: font.base, fontWeight: "600", color: "#3b82f6" },
  devLabel: { fontSize: font.sm, fontWeight: "500", color: colors.white },
  devBtnActive: { backgroundColor: "#3b82f6" },
});
