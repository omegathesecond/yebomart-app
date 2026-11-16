import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { call, type Workspace } from "./api";
export function useWorkspace() {
  const { shop, user, isAuthenticated } = useAuthStore();
  return useQuery({
    queryKey: ["workspace", shop?.id, user?.id],
    queryFn: () => call<Workspace>("/workspace"),
    enabled: isAuthenticated,
    staleTime: 10000,
    refetchInterval: 30000,
    retry: 1,
  });
}
export function ErrorMessage({ error }: { error: unknown }) {
  return error ? (
    <div
      role="alert"
      className="border-l-2 border-bad bg-red-50 p-4 text-sm text-ink"
    >
      {error instanceof Error ? error.message : String(error)}
    </div>
  ) : null;
}
export function Loading() {
  return (
    <p role="status" className="p-6 text-mute">
      Connecting to your business…
    </p>
  );
}
export function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <label className="grid gap-2 text-sm font-medium">
        {label}
        {children}
      </label>
      {help && <p className="text-xs font-normal text-mute">{help}</p>}
    </div>
  );
}
export function Section({
  number,
  title,
  children,
}: {
  number?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-line py-6 space-y-5">
      <h2 className="text-xl font-semibold tracking-tight">
        {number && <span className="m mr-3 text-brand">{number}</span>}
        {title}
      </h2>
      {children}
    </section>
  );
}
