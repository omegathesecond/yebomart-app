import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { call, money } from "./api";
import { ErrorMessage, Field, Loading, Section } from "./shared";
interface Report {
  business: string;
  currency: string;
  from: string;
  to: string;
  periodLabel: string;
  orders: number;
  completed: number;
  cancelled: number;
  open: number;
  collectedMinor: number;
  unpaidMinor: number;
  averagePrepMinutes: number | null;
  topItems: { name: string; quantity: number }[];
  unavailableItems: number;
  needsReconciliation: number;
}
interface Subscription {
  id: string;
  kind: string;
  channel: string;
  recipient: string;
  localHour: number;
  enabled: boolean;
}
interface Delivery {
  id: string;
  channel: string;
  recipient: string;
  status: string;
  error: string;
  messageId: string;
  createdAt: string;
}
export function RestaurantReports() {
  const { shop } = useAuthStore();
  const [days, setDays] = useState(1);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState("DAILY");
  const [channel, setChannel] = useState("WHATSAPP");
  const [recipient, setRecipient] = useState(shop?.ownerPhone ?? "");
  const [hour, setHour] = useState(18);
  const [consent, setConsent] = useState(false);
  const [notice, setNotice] = useState("");
  const report = useQuery({
    queryKey: ["restaurant-report", shop?.id, days],
    queryFn: () => call<Report>("/restaurant/reports?days=" + days),
  });
  const subscriptions = useQuery({
    queryKey: ["restaurant-subscriptions", shop?.id],
    queryFn: () =>
      call<{ subscriptions: Subscription[]; deliveries: Delivery[] }>(
        "/restaurant/subscriptions",
      ),
    refetchInterval: 15000,
  });
  async function save(data: unknown) {
    setBusy(true);
    setError(null);
    try {
      await call("/restaurant/subscriptions", "PUT", data);
      await subscriptions.refetch();
      setConsent(false);
      setNotice("Report preferences saved.");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  if (report.isPending) return <Loading />;
  const r = report.data;
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <p className="eyebrow">Restaurant reports</p>
      <div className="flex flex-wrap justify-between gap-4">
        <h1 className="text-3xl font-semibold">
          What matters to your restaurant.
        </h1>
        <select
          aria-label="Report period"
          className="input w-44"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={1}>Last 24 hours</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>
      <ErrorMessage error={error || report.error || subscriptions.error} />
      {notice && (
        <p role="status" className="text-sm border-l-2 border-ok p-3">
          {notice}
        </p>
      )}
      {r && (
        <>
          <p className="text-xs text-mute">
            {r.periodLabel} · {new Date(r.from).toLocaleString()} to{" "}
            {new Date(r.to).toLocaleString()}
          </p>
          <div className="grid sm:grid-cols-3 gap-6 border-y border-line py-6">
            {[
              {
                label: "Payments recorded",
                value: money(r.currency, r.collectedMinor),
              },
              {
                label: "Unpaid open orders",
                value: money(r.currency, r.unpaidMinor),
              },
              {
                label: "Accepted to ready",
                value:
                  r.averagePrepMinutes === null
                    ? "No completed sample"
                    : r.averagePrepMinutes + " minutes",
              },
            ].map((v) => (
              <div key={v.label}>
                <p className="eyebrow">{v.label}</p>
                <p className="text-3xl mt-3">{v.value}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
            {[
              ["Orders", r.orders],
              ["Completed", r.completed],
              ["Still open", r.open],
              ["Cancelled", r.cancelled],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-sm text-mute">{label}</p>
                <p className="m text-3xl mt-2">{value}</p>
              </div>
            ))}
          </div>
          <Section title="Needs your attention">
            <p>
              {r.needsReconciliation
                ? r.needsReconciliation +
                  " payment or sale records need checking before handover."
                : "No payment reconciliation issues in this period."}
            </p>
            <p>
              {r.unavailableItems
                ? r.unavailableItems +
                  " dishes are marked sold out. Review your menu when they are ready to sell again."
                : "No dishes manually marked sold out."}
            </p>
            <p className="text-sm text-mute">
              Payments are recorded cash or confirmed YeboPay payments.
              Restaurant reports cover website and QR orders. Your main sales
              reports include all recorded till and restaurant sales. Profit
              needs complete item costs.
            </p>
          </Section>
          <Section title="What guests are choosing">
            <p className="text-xs text-mute">
              Quantities from completed orders in this period.
            </p>
            {r.topItems.length ? (
              r.topItems.map((i) => (
                <p
                  key={i.name}
                  className="flex justify-between border-b border-line py-3"
                >
                  <span>{i.name}</span>
                  <span className="m">{i.quantity}</span>
                </p>
              ))
            ) : (
              <p className="text-mute">
                Your best sellers will appear after orders are completed.
              </p>
            )}
          </Section>
        </>
      )}
      <Section title="Choose what comes to you">
        <p className="text-mute">
          Subscribe to a daily summary, a Monday weekly report, or daily
          insights with actions based on your orders. Choose WhatsApp or email
          and the time in {shop?.timezone}.
        </p>
        <p className="text-sm border-l-2 border-warn p-3">
          WhatsApp uses your plan’s messaging allowance. Daily summaries use the
          daily-report allowance; other updates use customer-message allowance.
          Email costs 1 credit per accepted send. Messages stop when the
          applicable balance runs out. Delivery is never replaced with SMS.
        </p>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            save({
              kind,
              channel,
              recipient,
              localHour: hour,
              enabled: true,
              consent,
            });
          }}
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="What would help?">
              <select
                className="input"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                <option value="DAILY">Daily summary</option>
                <option value="WEEKLY">Weekly report · Monday</option>
                <option value="INSIGHTS">Daily insights & actions</option>
              </select>
            </Field>
            <Field label="Send it by">
              <select
                className="input"
                value={channel}
                onChange={(e) => {
                  setChannel(e.target.value);
                  setRecipient(
                    e.target.value === "WHATSAPP" ? shop?.ownerPhone ?? "" : "",
                  );
                }}
              >
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EMAIL">Email</option>
              </select>
            </Field>
            <Field
              label={
                channel === "WHATSAPP"
                  ? "WhatsApp number with country code"
                  : "Email address"
              }
            >
              <input
                className="input"
                type={channel === "EMAIL" ? "email" : "tel"}
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                required
              />
            </Field>
            <Field label="Send after (business local time)">
              <select
                className="input"
                value={hour}
                onChange={(e) => setHour(Number(e.target.value))}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option value={i} key={i}>
                    {String(i).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <label className="flex gap-3 text-sm">
            <input
              type="checkbox"
              required
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            I have permission to send these reports to this recipient and agree
            to the stated messaging usage.
          </label>
          <button className="btn btn-primary" disabled={busy || !consent}>
            {busy ? "Saving…" : "Subscribe to this report"}
          </button>
        </form>
        {subscriptions.data?.subscriptions.map((s) => (
          <div
            className="border-t border-line py-4 flex flex-wrap justify-between gap-4"
            key={s.id}
          >
            <div>
              <p>
                {s.kind.toLowerCase()} ·{" "}
                {s.channel === "EMAIL" ? "Email" : "WhatsApp"} ·{" "}
                {s.enabled ? "On" : "Off"}
              </p>
              <p className="text-xs text-mute mt-2">
                {s.recipient} · after {String(s.localHour).padStart(2, "0")}:00
              </p>
            </div>
            {s.enabled && (
              <button
                className="btn btn-secondary"
                disabled={busy}
                onClick={() =>
                  save({
                    kind: s.kind,
                    channel: s.channel,
                    recipient: s.recipient,
                    localHour: s.localHour,
                    enabled: false,
                    consent: true,
                  })
                }
              >
                Unsubscribe
              </button>
            )}
          </div>
        ))}
      </Section>
      <Section title="Message history">
        <p className="text-sm text-mute">
          “Accepted” means YeboLink accepted the request; it does not prove
          delivery to the phone or inbox. An unknown send is held for checking
          and is never automatically sent again.
        </p>
        <div className="space-y-4">
          {subscriptions.data?.deliveries.length === 0 && (
            <p className="text-mute">No messages queued yet.</p>
          )}
          {subscriptions.data?.deliveries.map((d) => (
            <div className="border-t border-line py-4" key={d.id}>
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span>
                  {d.channel} · {d.recipient}
                </span>
                <span className="m">{d.status.toLowerCase()}</span>
              </div>
              <p className="text-xs text-mute mt-2">
                {new Date(d.createdAt).toLocaleString()}
              </p>
              {d.error && <ErrorMessage error={d.error} />}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
