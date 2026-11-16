import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { call } from "./api";
import { useAuthStore } from "@/stores/authStore";
import { useWorkspace, ErrorMessage, Loading } from "./shared";
const labels: Record<string, string> = {
  sell: "Sell at the till",
  catalogue: "Manage products",
  stock: "Count and receive stock",
  customers: "Keep customer accounts",
  suppliers: "Order from suppliers",
  expenses: "Record expenses",
  reports: "Review business reports",
  team: "Manage my team",
  restaurant: "Restaurant, menu website and kitchen",
};
export function WorkspaceSettings() {
  const w = useWorkspace();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string[] | null>(null);
  const [error, setError] = useState<unknown>();
  const [saving, setSaving] = useState(false);
  if (w.isPending) return <Loading />;
  if (w.error) return <ErrorMessage error={w.error} />;
  const choices = selected ?? w.data.modules;
  return (
    <div className="max-w-3xl space-y-5">
      <p className="eyebrow">Your workspace</p>
      <h1 className="text-3xl font-semibold">What does your business need?</h1>
      <p className="text-mute">
        Choose the work you do. Each colleague sees the tools that match their
        role. You can change this as the business grows.
      </p>
      <ErrorMessage error={error} />
      <div className="divide-y divide-line">
        {w.data.choices.map((id) => (
          <label key={id} className="flex items-center gap-4 py-4">
            <input
              type="checkbox"
              checked={choices.includes(id)}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...choices, id]
                    : choices.filter((x) => x !== id),
                )
              }
            />
            {labels[id] ?? id}
          </label>
        ))}
      </div>
      <button
        className="btn-primary"
        disabled={saving || !choices.length}
        onClick={async () => {
          setSaving(true);
          setError(null);
          try {
            await call("/workspace", "PUT", { modules: choices });
            await qc.invalidateQueries({ queryKey: ["workspace"] });
            await qc.invalidateQueries({ queryKey: ["overview"] });
            setSelected(null);
          } catch (e) {
            setError(e);
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving ? "Saving…" : "Save my workspace"}
      </button>
    </div>
  );
}
export function WorkspaceMore() {
  const w = useWorkspace();
  const logout = useAuthStore((s) => s.logout);
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold mb-5">Your business tools</h1>
      <ErrorMessage error={w.error} />
      <div className="divide-y divide-line">
        {w.data?.navigation
          .filter((n) => n.href !== "/")
          .map((n) => (
            <Link
              key={n.href}
              to={n.href}
              className="flex justify-between py-4"
            >
              <span>{n.name}</span>
              <span aria-hidden>→</span>
            </Link>
          ))}
      </div>
      <button className="btn-secondary mt-5" onClick={logout}>
        Sign out
      </button>
    </div>
  );
}
