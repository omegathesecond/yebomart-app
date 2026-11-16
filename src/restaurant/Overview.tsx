import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { call, money, type Navigation } from "./api";
import { ErrorMessage, Loading } from "./shared";
interface OverviewData {
  name: string;
  currency: string;
  kitchen: boolean;
  role: string;
  financial: any;
  operational: { status: string; _count: number }[] | null;
  website: {
    published: boolean;
    acceptingOrders: boolean;
    slug: string;
  } | null;
  navigation: Navigation[];
}
export function Overview() {
  const shop = useAuthStore((s) => s.shop);
  const q = useQuery({
    queryKey: ["overview", shop?.id],
    queryFn: () => call<OverviewData>("/workspace/overview"),
    refetchInterval: 15000,
  });
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorMessage error={q.error} />;
  const d = q.data;
  const f = d.financial;
  return (
    <div className="max-w-6xl mx-auto space-y-7">
      <div>
        <p className="eyebrow">
          {d.kitchen ? "Kitchen" : "Your business today"}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight mt-2">{d.name}</h1>
        <p className="text-mute mt-2">
          {d.kitchen
            ? "Here is what needs preparing. Open the kitchen to keep orders moving."
            : d.role === "CASHIER"
              ? "Ready for your shift. Take orders, collect payment and hand over."
              : "See what needs attention, then get on with your day."}
        </p>
      </div>
      {!d.website&&d.navigation.some(n=>n.href==='/restaurant/setup')&&<section className="bg-ink text-cream p-6 space-y-4"><p className="eyebrow">Start here</p><h2 className="text-2xl font-semibold">Put your menu to work.</h2><p className="text-mist">Photograph your menu, check the items and publish your included website.</p><Link className="btn btn-primary" to="/restaurant/setup">Set up my restaurant →</Link></section>}
      {d.website && (
        <div className="bg-ink text-cream p-6 flex flex-wrap gap-5 items-center justify-between">
          <div>
            <p className="eyebrow">Restaurant</p>
            <p className="text-xl mt-2">
              {d.website.acceptingOrders
                ? "Your website is taking orders"
                : d.website.published
                  ? "Your menu is live. Orders are paused."
                  : "Finish your menu and open your website"}
            </p>
          </div>
          <Link
            className="btn btn-primary"
            to={
              d.kitchen
                ? "/restaurant/orders"
                : d.website.published
                  ? "/restaurant/orders"
                  : "/restaurant/setup"
            }
          >
            {d.kitchen
              ? "Open kitchen"
              : d.website.published
                ? "See orders"
                : "Continue setup"}{" "}
            →
          </Link>
        </div>
      )}
      {d.operational && (
        <div className="grid grid-cols-2 lg:grid-cols-4 border-y border-line">
          {["NEW", "ACCEPTED", "PREPARING", "READY"].map((status) => (
            <Link key={status} to="/restaurant/orders" className="py-5 pr-4">
              <p className="eyebrow">
                {status === "NEW"
                  ? "Needs accepting"
                  : status === "READY"
                    ? "Ready to collect"
                    : status.toLowerCase()}
              </p>
              <p className="m text-4xl mt-3">
                {d.operational!.find((r) => r.status === status)?._count ?? 0}
              </p>
            </Link>
          ))}
        </div>
      )}
      {f && (
        <div className="grid gap-6 sm:grid-cols-3 border-y border-line py-6">
          <div>
            <p className="eyebrow">Sales today</p>
            <p className="text-3xl mt-2">
              {money(d.currency, Math.round(f.grossSales * 100))}
            </p>
          </div>
          <div>
            <p className="eyebrow">Transactions</p>
            <p className="m text-3xl mt-2">{f.totalTransactions}</p>
          </div>
          <div>
            <p className="eyebrow">
              {f.profitComplete
                ? "Net profit today"
                : "Profit needs complete costs"}
            </p>
            <p className="text-3xl mt-2">
              {f.profitComplete
                ? money(d.currency, Math.round(f.netProfit * 100))
                : "—"}
            </p>
            <p className="text-xs text-mute mt-2">
              {!f.profitComplete &&
                "Add ingredient or item costs before relying on profit."}
            </p>
          </div>
        </div>
      )}
      <section>
        <h2 className="text-lg font-semibold mb-4">Your next step</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {d.navigation
            .filter((n) => n.href !== "/")
            .slice(0, d.kitchen ? 1 : 9)
            .map((n) => (
              <Link
                to={n.href}
                key={n.href}
                className="flex justify-between border border-line p-5 hover:border-brand"
              >
                <span>{n.name}</span>
                <span>→</span>
              </Link>
            ))}
        </div>
      </section>
    </div>
  );
}
