import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { ClientCreateResponse } from "../types";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
  goals: z.string().optional(),
  starting_bodyweight: z.coerce.number().optional().or(z.literal("")),
  starting_body_fat_pct: z.coerce.number().optional().or(z.literal("")),
  preferred_unit: z.enum(["lbs", "kg"]).default("lbs"),
});
type FormValues = z.infer<typeof schema>;

export default function AddClientPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [created, setCreated] = useState<ClientCreateResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { preferred_unit: "lbs" } });

  const createClient = useMutation({
    mutationFn: (body: FormValues) =>
      api.clients.create({
        ...body,
        starting_bodyweight: body.starting_bodyweight === "" ? undefined : Number(body.starting_bodyweight),
        starting_body_fat_pct: body.starting_body_fat_pct === "" ? undefined : Number(body.starting_body_fat_pct),
      }),
    onSuccess: (res) => {
      setCreated(res);
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });

  if (created) {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="mb-1 text-2xl font-bold text-white">{created.client.name} added</h1>
        <p className="mb-6 text-sm text-muted">
          Client login isn't live yet (that lands in Phase 2) — share this invite link manually for now.
        </p>
        <div className="card mb-6 flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-muted">Invite link</span>
          <code className="break-all rounded-lg bg-bg p-3 text-xs text-accent">{created.invite.invite_link}</code>
          <button
            className="btn-secondary mt-1"
            onClick={() => {
              navigator.clipboard.writeText(created.invite.invite_link);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
          <p className="text-xs text-muted">Expires {new Date(created.invite.expires_at).toLocaleString()}</p>
        </div>
        <button className="btn-primary w-full" onClick={() => navigate(`/clients/${created.client.id}`)}>
          Go to client profile
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-bold text-white">Add a Client</h1>
      <form
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((values) => createClient.mutate(values))}
      >
        <Field label="Name" error={errors.name?.message}>
          <input className="input-ctrl" {...register("name")} placeholder="Ava Burkley" />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <input className="input-ctrl" type="email" {...register("email")} placeholder="ava@example.com" />
        </Field>
        <Field label="Goals (optional)">
          <textarea className="input-ctrl !h-24 resize-none py-3" {...register("goals")} placeholder="Build strength, lose 10lbs..." />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Starting bodyweight">
            <input className="input-ctrl" type="number" step="0.1" {...register("starting_bodyweight")} />
          </Field>
          <Field label="Starting body fat %">
            <input className="input-ctrl" type="number" step="0.1" {...register("starting_body_fat_pct")} />
          </Field>
        </div>
        <Field label="Preferred unit">
          <select className="input-ctrl" {...register("preferred_unit")}>
            <option value="lbs">lbs</option>
            <option value="kg">kg</option>
          </select>
        </Field>
        {createClient.isError && (
          <p className="text-sm text-danger">{(createClient.error as Error).message}</p>
        )}
        <button className="btn-primary mt-2" type="submit" disabled={isSubmitting || createClient.isPending}>
          {createClient.isPending ? "Adding..." : "Add Client & Generate Invite"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-muted">{label}</span>
      {children}
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  );
}
