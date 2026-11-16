import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { call, money, type PublicMenu as Menu, type Ticket } from "./api";
import { ErrorMessage, Field, Loading, Section } from "./shared";
const orderKey = (id: string) => "yebomart-order:" + id;
function secret() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}
export function RestaurantWebsite() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ["public-menu", slug],
    queryFn: () => call<Menu>("/restaurants/" + slug),
    staleTime: 10000,
    refetchOnWindowFocus: true,
  });
  const [basket, setBasket] = useState<
    Record<string, { quantity: number; notes: string }>
  >({});
  const [date, setDate] = useState("");
  const [at, setAt] = useState("");
  const [table, setTable] = useState(params.get("table") ?? "");
  const [mode, setMode] = useState(params.get("table") ? "DINE_IN" : "PICKUP");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notify, setNotify] = useState(false);
  const [method, setMethod] = useState("CASH");
  const [review, setReview] = useState(false);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{
    answer: string;
    suggestedItems: { productId: string; quantity: number }[];
  }>();
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState<any>(() => {
    const raw = sessionStorage.getItem("yebomart-pending:" + slug);
    return raw ? JSON.parse(raw) : null;
  });
  useEffect(() => {
    if (q.data) {
      const p = Object.fromEntries(
        new Intl.DateTimeFormat("en-CA", {
          timeZone: q.data.timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
          .formatToParts(new Date())
          .map((v) => [v.type, v.value]),
      );
      setDate(p.year + "-" + p.month + "-" + p.day);
      setMethod(q.data.allowCash ? "CASH" : "ONLINE");
    }
  }, [q.data?.timezone]);
  const slots = useQuery({
    queryKey: ["public-slots", slug, date],
    queryFn: () =>
      call<{ at: string; label: string; remaining: number }[]>(
        "/restaurants/" + slug + "/slots?date=" + date,
      ),
    enabled: !!date && !!q.data?.acceptingOrders,
    staleTime: 10000,
  });
  if (q.isPending)
    return (
      <main className="min-h-screen bg-cream">
        <Loading />
      </main>
    );
  if (q.error)
    return (
      <main className="max-w-xl mx-auto p-6">
        <h1 className="text-2xl mb-5">The menu could not open</h1>
        <ErrorMessage error={q.error} />
        <button className="btn-primary mt-5" onClick={() => q.refetch()}>
          Try again
        </button>
      </main>
    );
  const m = q.data;
  const lines = Object.entries(basket)
    .filter(([, v]) => v.quantity > 0)
    .map(([id, v]) => ({ id, item: m.items.find((i) => i.id === id), ...v }));
  const subtotal = lines.reduce(
    (n, l) => n + (l.item ? Math.round(l.item.price * 100) * l.quantity : 0),
    0,
  );
  const total = m.taxInclusive
    ? subtotal
    : subtotal + Math.round((subtotal * m.taxRate) / 100);
  const invalid = lines.some((l) => !l.item?.available);
  function change(id: string, delta: number) {
    if (pending) return;
    setBasket((b) => ({
      ...b,
      [id]: {
        notes: b[id]?.notes ?? "",
        quantity: Math.max(0, Math.min(20, (b[id]?.quantity ?? 0) + delta)),
      },
    }));
    setReview(false);
  }
  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const pendingKey = "yebomart-pending:" + slug;
      let payload;
      const existing = sessionStorage.getItem(pendingKey);
      if (existing) payload = JSON.parse(existing);
      else {
        payload = {
          requestKey: crypto.randomUUID(),
          accessToken: secret(),
          expectedTotalMinor: total,
          customerName: name.trim(),
          customerPhone: phone.trim(),
          notifyWhatsApp: notify,
          mode,
          ...(mode === "DINE_IN" ? { tableName: table } : {}),
          requestedFor: at,
          paymentMethod: method,
          items: lines.map((l) => ({
            productId: l.item!.id,
            quantity: l.quantity,
            notes: l.notes,
          })),
        };
        sessionStorage.setItem(pendingKey, JSON.stringify(payload));
        setPending(payload);
      }
      const ticket = await call<Ticket>(
        "/restaurants/" + slug + "/orders",
        "POST",
        payload,
      );
      sessionStorage.setItem(orderKey(ticket.id), payload.accessToken);
      sessionStorage.removeItem(pendingKey);
      setPending(null);
      navigate("/r/" + slug + "/order/" + ticket.id);
    } catch (e) {
      if ((e as any)?.status >= 400 && (e as any)?.status < 500) {
        sessionStorage.removeItem("yebomart-pending:" + slug);
        setPending(null);
      }
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const groups = [...new Set(m.items.map((i) => i.category || "Menu"))];
  return (
    <div className="min-h-screen bg-cream text-ink pb-20 lg:pb-0">
      <header className="bg-ink text-cream">
        <div className="max-w-5xl mx-auto px-5 py-12">
          <p className="eyebrow text-brand">
            Welcome ·{" "}
            {m.acceptingOrders ? "Order ahead or at your table" : "Our menu"}
          </p>
          <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight mt-4">
            {m.name}
          </h1>
          <p className="text-mist max-w-2xl mt-5 whitespace-pre-line">
            {m.description}
          </p>
          <div className="flex flex-wrap gap-5 text-sm mt-5">
            {m.address && <span>{m.address}</span>}
            <a className="underline" href={"tel:" + m.phone}>
              {m.phone}
            </a>
          </div>
          <p className="text-xs text-mist mt-5">
            {m.currency} ·{" "}
            {m.taxRate
              ? m.taxInclusive
                ? "Prices include " + m.taxRate + "% tax"
                : m.taxRate + "% tax added at checkout"
              : "No tax added"}{" "}
            · Collection times use {m.timezone}
          </p>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-5 grid lg:grid-cols-[1fr_360px] gap-10">
        <div>
          {!m.acceptingOrders && (
            <p className="border-l-2 border-warn p-4 mb-5">
              Online orders are paused. You can still browse the menu and
              contact the restaurant.
            </p>
          )}
          <details className="border-y border-line py-4 mb-8">
            <summary className="cursor-pointer text-sm">
              Opening hours & allergy information
            </summary>
            <div className="mt-4 space-y-2 text-sm">
              {m.hours.map((h, i) => (
                <p key={i}>
                  {
                    [
                      "Sunday",
                      "Monday",
                      "Tuesday",
                      "Wednesday",
                      "Thursday",
                      "Friday",
                      "Saturday",
                    ][h.day]
                  }{" "}
                  · {h.open}–{h.close}
                </p>
              ))}
              <p className="text-mute pt-3">
                Tell staff about allergies before ordering. A menu description
                or AI answer does not confirm a dish is safe for an allergy.
              </p>
            </div>
          </details>
          {m.allowAssistant && (
            <section className="bg-sand border border-line p-5 mb-8 space-y-4">
              <h2 className="font-semibold text-xl">
                What are you in the mood for?
              </h2>
              <p className="text-sm text-mute">
                Ask about this menu. Yebo AI can suggest dishes for your basket.
              </p>
              <form
                className="flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setAsking(true);
                  setError(null);
                  try {
                    setAnswer(
                      await call("/restaurants/" + slug + "/ask", "POST", {
                        question,
                      }),
                    );
                  } catch (e) {
                    setError(e);
                  } finally {
                    setAsking(false);
                  }
                }}
              >
                <input
                  aria-label="Ask about the menu"
                  className="input min-w-0"
                  maxLength={1000}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="What would you suggest for lunch?"
                />
                <button
                  className="btn-primary"
                  disabled={asking || question.trim().length < 3}
                >
                  {asking ? "Thinking…" : "Ask"}
                </button>
              </form>
              {answer && (
                <div className="text-sm space-y-3">
                  <p>{answer.answer}</p>
                  {answer.suggestedItems.length > 0 && (
                    <button
                      className="btn-secondary"
                      onClick={() => {
                        answer.suggestedItems.forEach((i) =>
                          setBasket((b) => ({
                            ...b,
                            [i.productId]: {
                              quantity: Math.min(
                                20,
                                (b[i.productId]?.quantity ?? 0) + i.quantity,
                              ),
                              notes: b[i.productId]?.notes ?? "",
                            },
                          })),
                        );
                        setReview(false);
                        setAnswer(undefined);
                      }}
                    >
                      Add suggestions to my basket
                    </button>
                  )}
                </div>
              )}
            </section>
          )}
          {groups.map((group) => (
            <section key={group} className="mb-10">
              <h2 className="text-2xl font-semibold border-b border-ink pb-3">
                {group}
              </h2>
              {m.items
                .filter((i) => (i.category || "Menu") === group)
                .map((i) => (
                  <article
                    key={i.id}
                    className="flex justify-between items-start gap-4 py-6 border-b border-line"
                  >
                    <div>
                      <h3 className="font-semibold text-lg">{i.name}</h3>
                      {i.description && (
                        <p className="text-mute text-sm mt-2">
                          {i.description}
                        </p>
                      )}
                      <p className="m mt-3">
                        {money(m.currency, Math.round(i.price * 100))}
                      </p>
                      {!i.available && (
                        <p className="text-sm text-bad mt-2">
                          Sold out for now
                        </p>
                      )}
                    </div>
                    {m.acceptingOrders && i.available && (
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          className="btn-secondary px-3"
                          aria-label={"Remove one " + i.name}
                          disabled={!basket[i.id]?.quantity}
                          onClick={() => change(i.id, -1)}
                        >
                          −
                        </button>
                        <span className="m" aria-live="polite">
                          {basket[i.id]?.quantity ?? 0}
                        </span>
                        <button
                          className="btn-secondary px-3"
                          aria-label={"Add one " + i.name}
                          disabled={basket[i.id]?.quantity >= 20}
                          onClick={() => change(i.id, 1)}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </article>
                ))}
            </section>
          ))}
        </div>
        <aside id="your-order" className="scroll-mt-5">
          <div className="lg:sticky lg:top-5 border border-line p-5 space-y-5">
            <p className="eyebrow">Your order</p>
            <h2 className="text-2xl font-semibold">Let’s get that ready.</h2>
            <ErrorMessage error={error} />
            {!lines.length ? (
              <p className="text-sm text-mute">
                Choose something from the menu to get started.
              </p>
            ) : (
              <>
                <div className="space-y-4">
                  {lines.map((l, i) => (
                    <div
                      className="border-b border-line pb-4"
                      key={l.item?.id ?? i}
                    >
                      <div className="flex justify-between gap-4 text-sm">
                        <span>
                          {l.quantity} × {l.item?.name ?? "Unavailable item"}
                        </span>
                        <span>
                          {l.item &&
                            money(
                              m.currency,
                              Math.round(l.item.price * 100) * l.quantity,
                            )}
                        </span>
                      </div>
                      <button
                        className="btn-ghost text-xs mt-2"
                        disabled={!!pending || busy}
                        onClick={() => {
                          setBasket((b) => ({
                            ...b,
                            [l.id]: { quantity: 0, notes: "" },
                          }));
                          setReview(false);
                        }}
                      >
                        Remove
                      </button>
                      <input
                        disabled={!l.item || !!pending || busy}
                        aria-label={"Note for " + l.item?.name}
                        className="input text-xs mt-3"
                        maxLength={300}
                        value={l.notes}
                        placeholder="Note for the kitchen (optional)"
                        onChange={(e) => {
                          const id = l.item!.id;
                          setBasket((b) => ({
                            ...b,
                            [id]: { ...b[id], notes: e.target.value },
                          }));
                          setReview(false);
                        }}
                      />
                    </div>
                  ))}
                </div>
                <p className="flex justify-between font-semibold text-lg">
                  <span>
                    Total {m.taxRate && !m.taxInclusive ? "including tax" : ""}
                  </span>
                  <span>{money(m.currency, total)}</span>
                </p>
                {invalid && (
                  <ErrorMessage error="A dish in your basket is no longer available. Refresh the menu and remove it before ordering." />
                )}
                {pending && (
                  <div className="border border-warn p-4 text-sm space-y-3">
                    <p>
                      We’re checking your saved order for {pending.customerName}
                      : {money(m.currency, pending.expectedTotalMinor)}. Keep
                      the same request to avoid placing it twice.
                    </p>
                    <button
                      className="btn-primary"
                      disabled={busy}
                      onClick={submit}
                    >
                      {busy ? "Checking…" : "Retry my saved order"}
                    </button>
                  </div>
                )}
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (review) submit();
                    else setReview(true);
                  }}
                  onChange={() => setReview(false)}
                >
                  <fieldset className="space-y-4" disabled={!!pending || busy}>
                    <Field label="How will you enjoy it?">
                      <select
                        className="input"
                        value={mode}
                        onChange={(e) => setMode(e.target.value)}
                      >
                        <option value="PICKUP">I’ll collect it</option>
                        {m.tables.length > 0 && (
                          <option value="DINE_IN">I’m at a table</option>
                        )}
                      </select>
                    </Field>
                    {mode === "DINE_IN" && (
                      <Field label="Your table">
                        <select
                          className="input"
                          value={table}
                          required
                          onChange={(e) => setTable(e.target.value)}
                        >
                          <option value="">Choose your table</option>
                          {m.tables.map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                      </Field>
                    )}
                    <Field label="Which day?">
                      <input
                        className="input"
                        type="date"
                        required
                        value={date}
                        onChange={(e) => {
                          setDate(e.target.value);
                          setAt("");
                        }}
                      />
                    </Field>
                    <ErrorMessage error={slots.error} />
                    <Field
                      label={
                        mode === "DINE_IN"
                          ? "When would you like it?"
                          : "Collection time"
                      }
                      help={
                        "Allow at least " +
                        m.leadMinutes +
                        " minutes. Pre-order up to 14 days ahead."
                      }
                    >
                      <select
                        className="input"
                        required
                        value={at}
                        onChange={(e) => setAt(e.target.value)}
                      >
                        <option value="">
                          {slots.isPending
                            ? "Finding available times…"
                            : slots.data?.length
                              ? "Choose a time"
                              : "No slots — try another day"}
                        </option>
                        {slots.data?.map((s) => (
                          <option key={s.at} value={s.at}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Your name">
                      <input
                        className="input"
                        required
                        minLength={2}
                        maxLength={120}
                        autoComplete="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </Field>
                    <Field
                      label="Your phone number"
                      help="Include the country code, such as +268…"
                    >
                      <input
                        className="input"
                        type="tel"
                        autoComplete="tel"
                        required
                        pattern="\+[1-9][0-9]{6,14}"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </Field>
                    <Field label="How would you like to pay?">
                      <select
                        className="input"
                        value={method}
                        onChange={(e) => setMethod(e.target.value)}
                      >
                        {m.allowCash && (
                          <option value="CASH">Cash at the counter</option>
                        )}
                        {m.allowOnline && (
                          <option value="ONLINE">
                            Secure online card checkout
                          </option>
                        )}
                      </select>
                    </Field>
                    <label className="flex gap-3 text-xs">
                      <input
                        type="checkbox"
                        checked={notify}
                        onChange={(e) => setNotify(e.target.checked)}
                      />
                      Send me WhatsApp updates about this order. I can also
                      follow progress on my order page.
                    </label>
                    <p className="text-xs text-mute">
                      Your name, phone and order are shared with this restaurant
                      to fulfil your order.
                    </p>
                    {review && (
                      <div
                        className="border border-brand p-4 space-y-2 text-sm"
                        role="status"
                      >
                        <p className="font-semibold">
                          Ready to place your order?
                        </p>
                        <p>
                          {mode === "DINE_IN" ? table : "Collection"} ·{" "}
                          {new Date(at).toLocaleString(undefined, {
                            timeZone: m.timezone,
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>
                        <p>
                          {name} · {phone}
                        </p>
                        <p>
                          {money(m.currency, total)} ·{" "}
                          {method === "CASH"
                            ? "pay cash at the counter"
                            : "continue to secure payment after placing"}
                        </p>
                      </div>
                    )}
                    <button
                      className="btn-primary w-full"
                      disabled={busy || invalid || !m.acceptingOrders}
                    >
                      {busy
                        ? "Placing your order…"
                        : review
                          ? "Place order · " + money(m.currency, total)
                          : "Review my order"}
                    </button>
                    <p className="text-xs text-mute">
                      If a connection drops, retry in this browser. The same
                      order request is reused to avoid duplicates.
                    </p>
                  </fieldset>
                </form>
              </>
            )}
          </div>
        </aside>
      </main>
      {lines.length>0&&<a href="#your-order" className="fixed bottom-0 left-0 right-0 z-40 bg-ink text-cream px-5 py-4 flex justify-between items-center lg:hidden safe-area-bottom"><span>View my basket · {lines.reduce((n,l)=>n+l.quantity,0)} items</span><span className="m">{money(m.currency,total)} ↑</span></a>}
      <footer className="border-t border-line p-6 text-center text-xs text-mute">
        {m.name} · Powered by{" "}
        <a href="https://yebomart.com" className="underline">
          YeboMart
        </a>
      </footer>
    </div>
  );
}
export function RestaurantOrderStatus() {
  const { slug, id } = useParams();
  const token = sessionStorage.getItem(orderKey(id!));
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const headers = { "X-Order-Token": token ?? "" };
  const q = useQuery({
    queryKey: ["public-order", id, token],
    queryFn: () =>
      call<Ticket>("/restaurant-orders/" + id, "GET", undefined, headers),
    enabled: !!token,
    refetchInterval: 5000,
    retry: 1,
  });
  const m = useQuery({
    queryKey: ["public-menu", slug],
    queryFn: () => call<Menu>("/restaurants/" + slug),
  });
  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const result = await call<{ url: string }>(
        "/restaurant-orders/" + id + "/checkout",
        "POST",
        {},
        headers,
      );
      const target = new URL(result.url);
      if (target.protocol !== "https:")
        throw new Error(
          "The payment service returned an invalid checkout address.",
        );
      location.assign(target.href);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const t = await call<Ticket>(
        "/restaurant-orders/" + id + "/confirm-payment",
        "POST",
        {},
        headers,
      );
      await q.refetch();
      if (t.paymentStatus !== "PAID")
        throw new Error(
          "YeboPay has not confirmed this payment yet. Please check again shortly.",
        );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="min-h-screen bg-cream p-5">
      <div className="max-w-xl mx-auto py-8 space-y-6">
        <Link className="text-sm underline" to={"/r/" + slug}>
          ← Back to {m.data?.name ?? "the menu"}
        </Link>
        <p className="eyebrow">Your order</p>
        {!token ? (
          <ErrorMessage error="For your privacy, open this order in the same browser where you placed it. Contact the restaurant with your order number if you need help." />
        ) : q.isPending ? (
          <Loading />
        ) : q.error ? (
          <ErrorMessage error={q.error} />
        ) : (
          <>
            <h1 className="text-4xl font-semibold">#{q.data.number}</h1>
            <p className="text-xl">
              {
                (
                  {
                    NEW: "Sent to the restaurant",
                    ACCEPTED: "Accepted — you’re in the queue",
                    PREPARING: "The kitchen is preparing your order",
                    READY: "Ready to collect",
                    COMPLETED: "Handed over. Enjoy your meal!",
                    CANCELLED: "This order was cancelled",
                  } as Record<string, string>
                )[q.data.status]
              }
            </p>
            <p className="text-sm text-mute">
              {q.data.mode === "DINE_IN" ? q.data.tableName : "Collection"} ·{" "}
              {new Date(q.data.requestedFor).toLocaleString(undefined, {
                timeZone: m.data?.timezone,
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
            <div className="border-y border-line divide-y divide-line">
              {q.data.items.map((i) => (
                <div key={i.productId} className="py-4">
                  <p>
                    {i.quantity} × {i.name}
                  </p>
                  {i.notes && (
                    <p className="text-xs text-mute mt-2">
                      Your note: {i.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <p className="flex justify-between text-xl font-semibold">
              <span>Total</span>
              <span>{money(q.data.currency!, q.data.totalMinor!)}</span>
            </p>
            <p className="border-l-2 border-brand pl-4">
              {q.data.paymentStatus === "PAID"
                ? "Payment confirmed"
                : q.data.paymentMethod === "CASH"
                  ? "Pay cash at the restaurant counter"
                  : "Online payment still needs confirmation"}
            </p>
            <ErrorMessage error={q.data.failure || error} />
            {q.data.paymentMethod === "ONLINE" &&
              q.data.paymentStatus !== "PAID" &&
              q.data.status !== "CANCELLED" && (
                <div className="grid gap-3">
                  {["NONE", "READY"].includes(q.data.checkoutState!) && (
                    <button
                      className="btn-primary"
                      disabled={busy}
                      onClick={pay}
                    >
                      {q.data.checkoutState === "READY"
                        ? "Return to secure payment"
                        : "Continue to secure payment"}
                    </button>
                  )}
                  <button
                    className="btn-secondary"
                    disabled={busy}
                    onClick={confirm}
                  >
                    I’ve paid — check payment
                  </button>
                  <p className="text-xs text-mute">
                    Returning from checkout does not confirm payment. We check
                    the payment with YeboPay before the restaurant accepts it.
                  </p>
                </div>
              )}
            <p className="text-xs text-mute">
              Keep this page open to follow progress. WhatsApp updates depend on
              your consent and the restaurant’s messaging allowance.
            </p>
          </>
        )}
        {m.data?.phone && (
          <a className="btn-secondary" href={"tel:" + m.data.phone}>
            Contact the restaurant
          </a>
        )}
      </div>
    </main>
  );
}
