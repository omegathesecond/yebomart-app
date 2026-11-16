import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useInventoryStore } from "@/stores/inventoryStore";
import { call, profileBody, money, type RestaurantProfile } from "./api";
import { ErrorMessage, Field, Section, Loading, useWorkspace } from "./shared";
interface DraftItem {
  name: string;
  price: number | null;
  cost: number | null;
  category: string;
  description: string;
  source: string;
  issues: string[];
}
interface ImportDraft {
  id: string;
  draft: { items: Omit<DraftItem, "cost">[]; warnings: string[] };
}
const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export function RestaurantSetup() {
  const { shop } = useAuthStore();
  const workspace = useWorkspace();
  const qc = useQueryClient();
  const products = useInventoryStore((s) => s.products);
  const query = useQuery({
    queryKey: ["restaurant-setup", shop?.id],
    queryFn: () => call<RestaurantProfile | null>("/restaurant"),
    refetchOnWindowFocus: false,
  });
  const team = useQuery({
    queryKey: ["restaurant-team", shop?.id],
    queryFn: () =>
      call<
        { id: string; name: string; role: string; restaurantDuty: string }[]
      >("/restaurant/team"),
  });
  const [form, setForm] = useState<RestaurantProfile>();
  const [error, setError] = useState<unknown>();
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<ImportDraft>();
  const [rows, setRows] = useState<DraftItem[]>([]);
  const [reviewed, setReviewed] = useState(false);
  const [key, setKey] = useState("");
  const [photo, setPhoto] = useState<File>();
  const [photoUrl, setPhotoUrl] = useState("");
  const [qr, setQr] = useState("");
  const [qrTable, setQrTable] = useState("");
  useEffect(() => {
    if (query.data !== undefined)
      setForm(
        query.data ?? {
          slug: (shop?.name ?? "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, ""),
          description: "",
          publicPhone: shop?.ownerPhone ?? "",
          published: false,
          acceptingOrders: false,
          hours: [1, 2, 3, 4, 5, 6].map((day) => ({
            day,
            open: "09:00",
            close: "18:00",
          })),
          leadMinutes: 20,
          slotMinutes: 15,
          slotCapacity: 10,
          tables: [],
          menuProductIds: [],
          unavailableProductIds: [],
          allowCash: true,
          allowOnline: false,
          allowAssistant: false,
        },
      );
  }, [query.data, shop]);
  useEffect(() => {
    if (!photo) {
      setPhotoUrl("");
      return;
    }
    const u = URL.createObjectURL(photo);
    setPhotoUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [photo]);
  const url = form
    ? location.origin +
      "/r/" +
      form.slug +
      (qrTable ? "?table=" + encodeURIComponent(qrTable) : "")
    : "";
  useEffect(() => {
    let live = true;
    setQr("");
    if (query.data?.published)
      QRCode.toDataURL(url, {
        width: 360,
        margin: 3,
        errorCorrectionLevel: "M",
      })
        .then((r) => {
          if (live) setQr(r);
        })
        .catch(setError);
    return () => {
      live = false;
    };
  }, [url, query.data?.published]);
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    await query.refetch();
    await qc.invalidateQueries({ queryKey: ["workspace"] });
    await qc.invalidateQueries({ queryKey: ["overview"] });
  }
  const set = (k: keyof RestaurantProfile, value: unknown) =>
    setForm((f) => (f ? { ...f, [k]: value } : f));
  if (query.isPending || !form)
    return query.error ? <ErrorMessage error={query.error} /> : <Loading />;
  const p = form;
  return (
    <div className="max-w-4xl mx-auto">
      <p className="eyebrow">Restaurant setup</p>
      <h1 className="text-3xl font-semibold mt-2">
        Let’s put your restaurant online.
      </h1>
      <p className="text-mute mt-3 mb-6">
        Use the menu you already have. Review it once, then serve customers from
        your website, QR menu, phone and till.
      </p>
      <div className="sticky top-14 z-20 bg-cream py-2">
        <ErrorMessage error={error} />
        {notice && (
          <p role="status" className="border-l-2 border-ok p-3 text-sm">
            {notice}
          </p>
        )}
        {busy && (
          <p role="status" className="text-sm text-mute p-2">
            Working on it. Please keep this page open…
          </p>
        )}
      </div>
      <Section number="01" title="Tell customers about your restaurant">
        <div className="grid sm:grid-cols-2 gap-5">
          <Field
            label="Website name"
            help="Use letters, numbers and dashes. Your included website opens at this address."
          >
            <div className="text-xs text-mute mb-1">{location.origin}/r/</div>
            <input
              className="input"
              value={p.slug}
              onChange={(e) => set("slug", e.target.value)}
              required
              minLength={3}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
            />
          </Field>
          <Field
            label="Customer contact number"
            help="Include the country code, for example +268…"
          >
            <input
              className="input"
              type="tel"
              value={p.publicPhone}
              onChange={(e) => set("publicPhone", e.target.value)}
            />
          </Field>
        </div>
        <Field label="What should guests know?">
          <textarea
            className="input"
            maxLength={1500}
            value={p.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Tell guests what you serve, where to collect and how to contact you about allergies."
          />
        </Field>
        <h3 className="font-semibold">When can guests collect?</h3>
        <p className="text-sm text-mute">
          Times use your business timezone: {shop?.timezone}. Split overnight
          opening into two days.
        </p>
        <div className="space-y-3">
          {p.hours.map((h, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Opening day"
                className="input w-36"
                value={h.day}
                onChange={(e) =>
                  set(
                    "hours",
                    p.hours.map((x, j) =>
                      j === i ? { ...x, day: Number(e.target.value) } : x,
                    ),
                  )
                }
              >
                {days.map((d, n) => (
                  <option value={n} key={d}>
                    {d}
                  </option>
                ))}
              </select>
              <input
                aria-label="Opening time"
                className="input w-32"
                type="time"
                value={h.open}
                onChange={(e) =>
                  set(
                    "hours",
                    p.hours.map((x, j) =>
                      j === i ? { ...x, open: e.target.value } : x,
                    ),
                  )
                }
              />
              <span>to</span>
              <input
                aria-label="Closing time"
                className="input w-32"
                type="time"
                value={h.close}
                onChange={(e) =>
                  set(
                    "hours",
                    p.hours.map((x, j) =>
                      j === i ? { ...x, close: e.target.value } : x,
                    ),
                  )
                }
              />
              <button
                className="btn-ghost"
                disabled={busy}
                onClick={() =>
                  set(
                    "hours",
                    p.hours.filter((_, j) => j !== i),
                  )
                }
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          className="btn-secondary"
          disabled={p.hours.length >= 21}
          onClick={() =>
            set("hours", [
              ...p.hours,
              { day: 0, open: "09:00", close: "18:00" },
            ])
          }
        >
          Add an opening period
        </button>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Preparation lead time (minutes)">
            <input
              className="input"
              type="number"
              min={0}
              max={1440}
              value={p.leadMinutes}
              onChange={(e) => set("leadMinutes", Number(e.target.value))}
            />
          </Field>
          <Field label="Collection slots">
            <select
              className="input"
              value={p.slotMinutes}
              onChange={(e) => set("slotMinutes", Number(e.target.value))}
            >
              {[5, 10, 15, 20, 30, 60].map((n) => (
                <option key={n} value={n}>
                  Every {n} minutes
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Orders per slot"
            help="Full slots disappear for guests."
          >
            <input
              className="input"
              type="number"
              min={1}
              max={500}
              value={p.slotCapacity}
              onChange={(e) => set("slotCapacity", Number(e.target.value))}
            />
          </Field>
        </div>
        <Field
          label="Table names (optional)"
          help="One per line. Leave empty for collection orders only."
        >
          <textarea
            className="input"
            value={p.tables.join("\n")}
            onChange={(e) => set("tables", e.target.value.split("\n"))}
            onBlur={() =>
              set("tables", p.tables.map((t) => t.trim()).filter(Boolean))
            }
            placeholder={"Table 1\nPatio 2"}
          />
        </Field>
        <button
          className="btn-primary"
          disabled={busy}
          onClick={() =>
            act(async () => {
              await call(
                "/restaurant",
                "PUT",
                profileBody({ ...p, tables: p.tables.filter(Boolean) }),
              );
              await refresh();
              setNotice("Business details saved. Now add your menu.");
            })
          }
        >
          Save business details
        </button>
      </Section>
      <Section number="02" title="Show us your menu">
        <p className="text-mute">
          Take a clear photo of one page or section. Yebo AI reads the names and
          prices; you check them before they become products. Menu reading uses
          your AI allowance or 1 credit when the allowance is used.
        </p>
        {!query.data ? (
          <p className="text-sm">Save your business details first.</p>
        ) : (
          <>
            <Field
              label="Take or choose a menu photo"
              help="JPG, PNG or WebP, up to 6 MB. Photograph prices clearly."
            >
              <input
                className="input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={(e) => {
                  setPhoto(e.target.files?.[0]);
                  setDraft(undefined);
                }}
              />
            </Field>
            {photoUrl && (
              <img
                src={photoUrl}
                alt="Your menu photo for review"
                className="max-h-80 object-contain border border-line"
              />
            )}
            <button
              className="btn-primary"
              disabled={busy || !photo}
              onClick={() =>
                act(async () => {
                  if (!photo || photo.size > 6 * 1024 * 1024)
                    throw new Error("Choose a photo smaller than 6 MB.");
                  const data = new FormData();
                  data.append("photo", photo);
                  const result = await call<ImportDraft>(
                    "/restaurant/import",
                    "POST",
                    data,
                  );
                  setDraft(result);
                  setRows(
                    result.draft.items.map((i) => ({ ...i, cost: null })),
                  );
                  setReviewed(false);
                  setNotice(
                    "Your draft is ready. Check every item below; the live menu has not changed.",
                  );
                })
              }
            >
              {busy ? "Reading your menu…" : "Read this menu photo"}
            </button>
          </>
        )}
        {draft && (
          <div className="space-y-5 border border-line p-4">
            <h3 className="text-xl font-semibold">Let’s check what we read</h3>
            {draft.draft.warnings.map((w, i) => (
              <p key={i} className="text-sm border-l-2 border-warn p-2">
                {w}
              </p>
            ))}
            {rows.map((r, i) => (
              <div key={i} className="border-t border-line py-4 space-y-3">
                <p className="text-xs text-mute">Photo text: {r.source}</p>
                {r.issues.length > 0 && (
                  <p className="text-sm text-bad">
                    Please check: {r.issues.join(" · ")}
                  </p>
                )}
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Item name">
                    <input
                      className="input"
                      maxLength={120}
                      value={r.name}
                      onChange={(e) => {
                        setRows(
                          rows.map((v, j) =>
                            j === i ? { ...v, name: e.target.value } : v,
                          ),
                        );
                        setReviewed(false);
                      }}
                    />
                  </Field>
                  <Field label={"Selling price (" + shop?.currency + ")"}>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      min={0}
                      required
                      value={r.price ?? ""}
                      placeholder="Check the photo and enter price"
                      onChange={(e) => {
                        setRows(
                          rows.map((v, j) =>
                            j === i
                              ? {
                                  ...v,
                                  price:
                                    e.target.value === ""
                                      ? null
                                      : Number(e.target.value),
                                }
                              : v,
                          ),
                        );
                        setReviewed(false);
                      }}
                    />
                  </Field>
                  <Field label="Menu section">
                    <input
                      className="input"
                      value={r.category}
                      maxLength={80}
                      onChange={(e) =>
                        setRows(
                          rows.map((v, j) =>
                            j === i ? { ...v, category: e.target.value } : v,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field
                    label="Cost per item (optional)"
                    help="Leave blank if unknown. Profit needs real costs."
                  >
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      min={0}
                      value={r.cost ?? ""}
                      onChange={(e) =>
                        setRows(
                          rows.map((v, j) =>
                            j === i
                              ? {
                                  ...v,
                                  cost:
                                    e.target.value === ""
                                      ? null
                                      : Number(e.target.value),
                                }
                              : v,
                          ),
                        )
                      }
                    />
                  </Field>
                </div>
                <Field label="Description">
                  <textarea
                    className="input"
                    value={r.description}
                    maxLength={1000}
                    onChange={(e) =>
                      setRows(
                        rows.map((v, j) =>
                          j === i ? { ...v, description: e.target.value } : v,
                        ),
                      )
                    }
                  />
                </Field>
                <button
                  className="btn-ghost"
                  disabled={busy}
                  onClick={() => {
                    setRows(rows.filter((_, j) => j !== i));
                    setReviewed(false);
                  }}
                >
                  Remove this item from the draft
                </button>
              </div>
            ))}
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
              />
              I checked all item names, prices and flagged details against my
              menu.
            </label>
            <button
              className="btn-primary"
              disabled={
                busy ||
                !reviewed ||
                !rows.length ||
                rows.some((r) => r.price === null || !r.name.trim())
              }
              onClick={() =>
                act(async () => {
                  await call(
                    "/restaurant/import/" + draft.id + "/confirm",
                    "POST",
                    { items: rows.map(({ source, issues, ...r }) => r) },
                  );
                  setDraft(undefined);
                  setPhoto(undefined);
                  await useInventoryStore.getState().loadAll(shop!.id);
                  await refresh();
                  setNotice(
                    "Your reviewed items are saved as made-to-order products. Stock counts are not deducted for these dishes.",
                  );
                })
              }
            >
              Confirm {rows.length} menu items
            </button>
          </div>
        )}
        {query.data && (
          <details className="border-t border-line py-4">
            <summary className="cursor-pointer font-medium">
              Use products already in this business
            </summary>
            <div className="mt-4 max-h-64 overflow-auto space-y-3">
              {products.map((item) => (
                <label className="flex gap-3 text-sm" key={item.id}>
                  <input
                    type="checkbox"
                    checked={p.menuProductIds.includes(item.id)}
                    onChange={(e) => {
                      set(
                        "menuProductIds",
                        e.target.checked
                          ? [...p.menuProductIds, item.id]
                          : p.menuProductIds.filter((id) => id !== item.id),
                      );
                      if (!e.target.checked)
                        set(
                          "unavailableProductIds",
                          p.unavailableProductIds.filter(
                            (id) => id !== item.id,
                          ),
                        );
                    }}
                  />
                  {item.name} ·{" "}
                  {money(
                    shop?.currency ?? "",
                    Math.round(item.sellPrice * 100),
                  )}
                </label>
              ))}
            </div>
            <p className="text-xs text-mute mt-4">
              Save business details to apply this selection. Existing stock
              rules stay attached to each product.
            </p>
          </details>
        )}
        {query.data?.items?.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3">
              Your saved menu · {query.data.items.length} items
            </h3>
            <p className="text-sm text-mute mb-3">
              Mark a dish unavailable when it sells out. Guests see changes on
              their next refresh.
            </p>
            {query.data.items.map((item) => (
              <div
                className="flex flex-wrap items-center justify-between gap-3 py-3 border-t border-line"
                key={item.id}
              >
                <div>
                  <p>{item.name}</p>
                  <p className="m text-sm text-mute">
                    {money(shop?.currency ?? "", Math.round(item.price * 100))}
                  </p>
                </div>
                <button
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      await call("/restaurant/menu/" + item.id, "PATCH", {
                        available: !item.available,
                        price: item.price,
                      });
                      await refresh();
                    })
                  }
                >
                  {item.available ? "Mark sold out" : "Make available"}
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>
      <Section number="03" title="How will guests pay?">
        <label className="flex gap-3">
          <input
            type="checkbox"
            checked={p.allowCash}
            onChange={(e) => set("allowCash", e.target.checked)}
          />
          Cash at the counter
        </label>
        <p className="text-sm text-mute">
          Counter staff enter the amount received. Online payments use a
          checkout key belonging to your restaurant, so takings reach your
          YeboPay merchant account.
        </p>
        {workspace.data?.role === "OWNER" && (
          <>
            <Field
              label={
                p.paymentsConnected
                  ? "Replace your YeboPay restaurant key"
                  : "Connect your YeboPay restaurant key"
              }
              help="Use a dedicated merchant key with checkouts.write and wallet.read access. It is encrypted on the server and never shown again."
            >
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Your restaurant checkout key"
              />
            </Field>
            <button
              className="btn-secondary"
              disabled={busy || key.length < 20 || !query.data}
              onClick={() =>
                act(async () => {
                  await call("/restaurant/payments", "POST", { key });
                  setKey("");
                  await refresh();
                  setNotice(
                    "YeboPay key connected. You can now enable online checkout below.",
                  );
                })
              }
            >
              Connect YeboPay
            </button>
          </>
        )}
        <label className="flex gap-3">
          <input
            type="checkbox"
            checked={p.allowOnline}
            disabled={!p.paymentsConnected}
            onChange={(e) => set("allowOnline", e.target.checked)}
          />
          Allow secure online card payment{" "}
          {p.paymentsConnected ? "" : "— connect YeboPay first"}
        </label>
        <p className="text-xs text-mute">
          A customer returning from checkout is only marked paid after the API
          verifies the YeboPay payment. An uncertain attempt stays blocked for
          reconciliation.
        </p>
      </Section>
      <Section number="04" title="Your website and QR menu">
        <label className="flex gap-3">
          <input
            type="checkbox"
            checked={p.allowAssistant}
            onChange={(e) => set("allowAssistant", e.target.checked)}
          />
          Let guests ask Yebo AI about the approved menu
        </label>
        <p className="text-xs text-mute">
          Uses your AI plan allowance. The assistant suggests dishes; guests
          confirm their basket. Allergies and unknown details go to staff.
        </p>
        <label className="flex gap-3">
          <input
            type="checkbox"
            checked={p.published}
            onChange={(e) => {
              set("published", e.target.checked);
              if (!e.target.checked) set("acceptingOrders", false);
            }}
          />
          Publish my menu website
        </label>
        <label className="flex gap-3">
          <input
            type="checkbox"
            checked={p.acceptingOrders}
            disabled={!p.published}
            onChange={(e) => set("acceptingOrders", e.target.checked)}
          />
          Start accepting collection and table orders
        </label>
        <button
          className="btn-primary"
          disabled={busy || !query.data}
          onClick={() =>
            act(async () => {
              await call("/restaurant", "PUT", profileBody(p));
              await refresh();
              setNotice(
                p.published
                  ? "Your menu website is live. Share its link or print the QR code."
                  : "Your website is unpublished.",
              );
            })
          }
        >
          Save website & payment choices
        </button>
        {query.data?.published && (
          <div className="grid sm:grid-cols-2 gap-5 border border-line p-5">
            <div className="space-y-4">
              <p className="font-medium">Your restaurant website is live</p>
              <a
                className="text-brand underline break-all"
                target="_blank"
                rel="noreferrer"
                href={url}
              >
                {url}
              </a>
              {p.tables.length > 0 && (
                <Field label="QR code for">
                  <select
                    className="input"
                    value={qrTable}
                    onChange={(e) => setQrTable(e.target.value)}
                  >
                    <option value="">General menu / collection</option>
                    {p.tables.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </Field>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn-secondary"
                  onClick={() =>
                    act(async () => {
                      await navigator.clipboard.writeText(url);
                      setNotice("Website link copied.");
                    })
                  }
                >
                  Copy link
                </button>
                {qr && (
                  <a
                    className="btn-secondary"
                    download={
                      p.slug + (qrTable ? "-" + qrTable : "") + "-menu-qr.png"
                    }
                    href={qr}
                  >
                    Download QR
                  </a>
                )}
              </div>
              <p className="text-xs text-mute">
                Print and place the code on the matching table. Anyone with the
                link can open the menu without an account.
              </p>
            </div>
            {qr && (
              <img
                className="w-60 max-w-full"
                src={qr}
                alt={
                  "Scannable menu QR code" + (qrTable ? " for " + qrTable : "")
                }
              />
            )}
          </div>
        )}
      </Section>
      <Section number="05" title="Give each colleague the right tools">
        <p className="text-sm text-mute">
          Create colleagues in{" "}
          <Link className="underline" to="/staff">
            Team
          </Link>
          , then choose their duty here. Kitchen accounts see dishes, quantities
          and timings. Counter accounts handle guests and payments.
        </p>
        <ErrorMessage error={team.error} />
        {team.data?.map((u) => (
          <div
            className="flex items-center justify-between gap-3 border-t border-line py-3"
            key={u.id}
          >
            <span>
              {u.name}{" "}
              <span className="text-xs text-mute">{u.role.toLowerCase()}</span>
            </span>
            {u.role === "CASHIER" ? (
              <select
                aria-label={"Duty for " + u.name}
                className="input w-40"
                value={u.restaurantDuty}
                disabled={busy}
                onChange={(e) =>
                  act(async () => {
                    await call("/restaurant/team/" + u.id + "/duty", "PUT", {
                      duty: e.target.value,
                    });
                    await team.refetch();
                  })
                }
              >
                <option value="COUNTER">Counter</option>
                <option value="KITCHEN">Kitchen</option>
              </select>
            ) : (
              <span className="text-sm text-mute">Management</span>
            )}
          </div>
        ))}
        <div className="flex flex-wrap gap-3">
          <Link to="/restaurant/orders" className="btn-primary">
            Open orders & kitchen →
          </Link>
          <Link to="/restaurant/reports" className="btn-secondary">
            Choose reports & WhatsApp updates
          </Link>
        </div>
      </Section>
    </div>
  );
}
