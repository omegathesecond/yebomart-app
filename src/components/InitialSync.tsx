import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useInventoryStore } from "@/stores/inventoryStore";
import { useWorkspace, ErrorMessage, Loading } from "@/restaurant/shared";
interface Props {
  children: React.ReactNode;
}
export function InitialSync({ children }: Props) {
  const { shop, user } = useAuthStore();
  return <ShopSync key={shop?.id + ":" + user?.id}>{children}</ShopSync>;
}
function ShopSync({ children }: Props) {
  const w = useWorkspace();
  const shop = useAuthStore((s) => s.shop);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>();
  const [attempt, setAttempt] = useState(0);
  const signature = w.data
    ? JSON.stringify([w.data.kitchen, w.data.modules, w.data.role])
    : "";
  useEffect(() => {
    if (!w.data || !shop) return;
    let current = true;
    setDone(false);
    setError(null);
    if (w.data.kitchen) {
      useInventoryStore.getState().clearAll();
      setDone(true);
      return;
    }
    useInventoryStore
      .getState()
      .loadAll(shop.id)
      .then(() => {
        if (current) setDone(true);
      })
      .catch((e) => {
        if (current) setError(e);
      });
    return () => {
      current = false;
    };
  }, [signature, shop?.id, attempt]);
  if (error || w.error)
    return (
      <div className="max-w-lg mx-auto p-6 space-y-5">
        <ErrorMessage error={error || w.error} />
        <button
          className="btn btn-primary"
          onClick={() => {
            w.refetch();
            setAttempt((a) => a + 1);
          }}
        >
          Try connecting again
        </button>
      </div>
    );
  if (w.isPending || !done) return <Loading />;
  return <>{children}</>;
}
