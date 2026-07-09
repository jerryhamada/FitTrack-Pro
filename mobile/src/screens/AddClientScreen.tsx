import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  Alert,
  Clipboard,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { z } from "zod";
import Btn from "../components/Btn";
import Input from "../components/Input";
import { api } from "../lib/api";
import type { ClientCreateResponse, GoalType } from "../types";
import type { RootStackParamList } from "../navigation/types";
import { colors, font, radius, spacing } from "../theme";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const GOAL_OPTIONS: { value: GoalType; label: string }[] = [
  { value: "strength", label: "Strength" },
  { value: "hypertrophy", label: "Hypertrophy" },
  { value: "fat_loss", label: "Fat Loss" },
  { value: "endurance", label: "Endurance" },
  { value: "general_fitness", label: "General Fitness" },
];

const FREQUENCY_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  goals: z.string().optional(),
  goal_type: z.enum(["strength", "hypertrophy", "fat_loss", "endurance", "general_fitness"]).optional(),
  training_frequency_target: z.number().int().min(1).max(7).optional(),
});
type FormValues = z.infer<typeof schema>;

export default function AddClientScreen() {
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();
  const [created, setCreated] = useState<ClientCreateResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const { data: trainer } = useQuery({ queryKey: ["trainer", "me"], queryFn: api.trainer.me });
  const { data: joinCode } = useQuery({ queryKey: ["trainer", "join-code"], queryFn: api.trainer.joinCode });

  const generateCode = useMutation({
    mutationFn: api.trainer.generateJoinCode,
    onSuccess: (res) => qc.setQueryData(["trainer", "join-code"], res),
    onError: (err) => Alert.alert("Error", (err as Error).message),
  });

  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const createClient = useMutation({
    // No unit picker here — new clients just inherit the trainer's app-wide default unit.
    mutationFn: (body: FormValues) =>
      api.clients.create({ ...body, preferred_unit: trainer?.profile?.default_unit ?? "lbs" }),
    onSuccess: (res) => {
      setCreated(res);
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (err) => Alert.alert("Error", (err as Error).message),
  });

  if (created) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{created.client.name} added</Text>
        <Text style={styles.subtitle}>
          {created.invite.delivered
            ? `✓ Invite emailed to ${created.client.email}. They'll tap the link to install the app and sign up as your client.`
            : `We couldn't email the invite automatically — copy the link below and send it to ${created.client.email} yourself.`}
        </Text>
        <View style={styles.card}>
          <Text style={styles.linkLabel}>Invite link</Text>
          <Text style={styles.link} selectable>{created.invite.invite_link}</Text>
          <TouchableOpacity
            style={styles.copyBtn}
            onPress={() => {
              Clipboard.setString(created.invite.invite_link);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            <Text style={styles.copyBtnText}>{copied ? "Copied!" : "Copy link"}</Text>
          </TouchableOpacity>
          <Text style={styles.expires}>
            Expires {new Date(created.invite.expires_at).toLocaleString()}
          </Text>
        </View>
        <Btn
          label="Go to client profile"
          onPress={() => navigation.replace("ClientProfile", { clientId: created.client.id })}
          fullWidth
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Add a Client</Text>

      <Controller
        control={control}
        name="name"
        render={({ field: { onChange, value } }) => (
          <Input label="Name" value={value} onChangeText={onChange} placeholder="Ava Burkley" error={errors.name?.message} />
        )}
      />
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, value } }) => (
          <Input
            label="Email"
            value={value ?? ""}
            onChangeText={onChange}
            placeholder="ava@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.email?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="goals"
        render={({ field: { onChange, value } }) => (
          <Input label="Goals (optional)" value={value ?? ""} onChangeText={onChange} placeholder="Build strength, lose 10lbs..." multiline style={{ height: 88, paddingTop: spacing.sm }} />
        )}
      />

      <View>
        <Text style={styles.fieldLabel}>Goal (optional)</Text>
        <Controller
          control={control}
          name="goal_type"
          render={({ field: { onChange, value } }) => (
            <View style={styles.chipRow}>
              {GOAL_OPTIONS.map((g) => (
                <TouchableOpacity
                  key={g.value}
                  style={[styles.chip, value === g.value && styles.chipActive]}
                  onPress={() => onChange(value === g.value ? undefined : g.value)}
                >
                  <Text style={[styles.chipText, value === g.value && styles.chipTextActive]}>
                    {g.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        />
      </View>

      <View>
        <Text style={styles.fieldLabel}>Target frequency (optional)</Text>
        <Controller
          control={control}
          name="training_frequency_target"
          render={({ field: { onChange, value } }) => (
            <View style={styles.chipRow}>
              {FREQUENCY_OPTIONS.map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[styles.chip, value === n && styles.chipActive]}
                  onPress={() => onChange(value === n ? undefined : n)}
                >
                  <Text style={[styles.chipText, value === n && styles.chipTextActive]}>{n}x/wk</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        />
      </View>

      <Btn
        label={createClient.isPending ? "Adding..." : "Add Client & Send Invite"}
        onPress={handleSubmit((v) => createClient.mutate(v))}
        loading={createClient.isPending}
        fullWidth
      />

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.card}>
        <Text style={styles.linkLabel}>Your trainer code</Text>
        <Text style={styles.codeHint}>
          Share this code with clients — they enter it when signing up (or later in their app) to
          join you instantly, no invite needed.
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.base, gap: spacing.base },
  title: { fontSize: font.xl, fontWeight: "700", color: colors.white },
  subtitle: { fontSize: font.sm, color: colors.muted },
  fieldLabel: { fontSize: font.sm, fontWeight: "500", color: colors.muted, marginBottom: spacing.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    gap: spacing.sm,
  },
  linkLabel: { fontSize: font.xs, textTransform: "uppercase", letterSpacing: 1, color: colors.muted },
  link: { fontSize: font.xs, color: colors.accent, fontFamily: "monospace" },
  copyBtn: {
    backgroundColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    alignItems: "center",
  },
  copyBtnText: { color: colors.white, fontWeight: "600", fontSize: font.sm },
  expires: { fontSize: font.xs, color: colors.muted },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: font.xs, color: colors.muted, textTransform: "uppercase", letterSpacing: 1 },
  codeHint: { fontSize: font.sm, color: colors.muted, lineHeight: 19 },
  code: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.accent,
    letterSpacing: 6,
    textAlign: "center",
    fontFamily: "monospace",
    paddingVertical: spacing.sm,
  },
  regenerate: { fontSize: font.sm, color: colors.muted, textAlign: "center", textDecorationLine: "underline" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: font.sm, fontWeight: "600", color: colors.muted },
  chipTextActive: { color: "#000" },
});
