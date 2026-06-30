import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import Spinner from "../components/ui/Spinner";

export default function SettingsPage() {
  const { data: trainer, isLoading } = useQuery({ queryKey: ["trainer-me"], queryFn: api.trainer.me });
  const { data: subscription } = useQuery({ queryKey: ["subscription"], queryFn: api.trainer.subscription });

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
    mutationFn: () => api.trainer.update({ business_name: businessName, logo_url: logoUrl, default_unit: defaultUnit }),
  });

  if (isLoading) return <Spinner />;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold text-white">Settings</h1>

      <div className="card mb-4">
        <h3 className="mb-3 font-semibold text-white">Branding</h3>
        <p className="mb-3 text-xs text-muted">Stub for white-label use — name/logo appear on exports in a future phase.</p>
        <div className="flex flex-col gap-3">
          <input className="input-ctrl" placeholder="Business name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          <input className="input-ctrl" placeholder="Logo URL" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
        </div>
      </div>

      <div className="card mb-4">
        <h3 className="mb-3 font-semibold text-white">Units</h3>
        <p className="mb-3 text-xs text-muted">Default unit for new clients (each client can still override this individually).</p>
        <select className="input-ctrl" value={defaultUnit} onChange={(e) => setDefaultUnit(e.target.value as "lbs" | "kg")}>
          <option value="lbs">lbs</option>
          <option value="kg">kg</option>
        </select>
      </div>

      <div className="card mb-4">
        <h3 className="mb-2 font-semibold text-white">Notifications</h3>
        <p className="text-sm text-muted">Stub for now — push/email notification preferences land in a later phase.</p>
      </div>

      <div className="card mb-4">
        <h3 className="mb-2 font-semibold text-white">Subscription</h3>
        <p className="text-sm text-white">Status: {subscription?.status ?? "—"}</p>
        <p className="text-xs text-muted">Billing isn't live in Phase 1 — this is a stub for the future SaaS layer.</p>
      </div>

      <button className="btn-primary w-full" onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? "Saving..." : "Save Settings"}
      </button>
    </div>
  );
}
