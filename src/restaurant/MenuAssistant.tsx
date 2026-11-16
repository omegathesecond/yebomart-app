import { useEffect, useRef, useState } from "react";
import { call, money, type MenuItem, type PublicMenu } from "./api";
import { ErrorMessage } from "./shared";
import { DishPhoto, prepareDishPhoto, usePhotoPreview } from "./photos";
export interface MenuSuggestion {
  productId: string;
  quantity: number;
}
interface Reply {
  answer: string;
  suggestedItems: MenuSuggestion[];
}
interface Turn {
  role: "user" | "assistant";
  content: string;
}
export function MenuAssistant({
  menu,
  focus,
  onClearFocus,
  onSuggestions,
  basketLocked = false,
}: {
  menu: PublicMenu;
  focus?: MenuItem;
  onClearFocus: () => void;
  onSuggestions: (items: MenuSuggestion[]) => void;
  basketLocked?: boolean;
}) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [reply, setReply] = useState<Reply>();
  const [photo, setPhoto] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<unknown>();
  const preview = usePhotoPreview(photo);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focus) {
      setPhoto(undefined);
      setError(null);
    }
  }, [focus?.id]);
  async function send() {
    setBusy(true);
    setError(null);
    const prompt =
      question.trim() ||
      (photo
        ? "Find available dishes on this menu that look closest to my meal photo. Explain what is uncertain."
        : focus
          ? "Tell me about " + focus.name + " and help me decide what to order."
          : "");
    try {
      if (!prompt) throw new Error("Ask a question or add a meal photo.");
      const body = new FormData();
      body.append("question", prompt);
      body.append(
        "history",
        JSON.stringify(
          turns
            .slice(-8)
            .map((t) => ({ ...t, content: t.content.slice(0, 1200) })),
        ),
      );
      if (photo) body.append("photo", photo);
      else if (focus) body.append("productId", focus.id);
      const result = await call<Reply>(
        "/restaurants/" + menu.slug + "/ask",
        "POST",
        body,
      );
      setTurns(
        (t) =>
          [
            ...t,
            {
              role: "user",
              content:
                (photo
                  ? "[Meal photo] "
                  : focus
                    ? "[" + focus.name + "] "
                    : "") + prompt,
            },
            { role: "assistant", content: result.answer },
          ].slice(-8) as Turn[],
      );
      setReply(result);
      setQuestion("");
      setPhoto(undefined);
      onClearFocus();
      setTimeout(
        () =>
          bottom.current?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          }),
        0,
      );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      id="menu-assistant"
      className="bg-sand border border-line p-5 mb-8 space-y-4 scroll-mt-5"
    >
      <p className="eyebrow">Your menu companion</p>
      <h2 className="font-semibold text-2xl">
        Show us what you’re in the mood for.
      </h2>
      <p className="text-sm text-mute">
        Ask Yebo AI, choose a dish photo, or send a picture of a meal you like.
        We’ll help you choose from this restaurant’s available menu.
      </p>
      {turns.length > 0 && (
        <div
          role="log"
          aria-label="Menu conversation"
          className="max-h-96 overflow-auto space-y-4 border-y border-line py-4"
        >
          {turns.map((turn, i) => (
            <div
              key={i}
              className={
                turn.role === "user"
                  ? "ml-8 border-l-2 border-brand pl-3"
                  : "mr-3"
              }
            >
              <p className="eyebrow mb-1">
                {turn.role === "user" ? "You" : "Yebo"}
              </p>
              <p className="text-sm whitespace-pre-wrap">{turn.content}</p>
            </div>
          ))}
          <div ref={bottom} />
        </div>
      )}
      {focus && (
        <div className="flex items-center gap-3 border border-line p-3">
          <DishPhoto
            url={focus.imageUrl!}
            name={focus.name}
            className="h-20 w-24"
          />
          <div>
            <p className="font-medium">Ask about {focus.name}</p>
            <p className="m text-sm">
              {money(menu.currency, Math.round(focus.price * 100))}
            </p>
            <button className="btn btn-ghost text-xs" onClick={onClearFocus}>
              Choose another photo
            </button>
          </div>
        </div>
      )}
      {preview && (
        <div className="space-y-2">
          <DishPhoto
            url={preview}
            name="Your meal reference photo"
            className="max-h-60 w-full"
          />
          <button
            className="btn btn-ghost"
            disabled={busy}
            onClick={() => setPhoto(undefined)}
          >
            Remove my photo
          </button>
        </div>
      )}
      <ErrorMessage error={error} />
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <label className="grid gap-2 text-sm">
          What would you like to know?
          <textarea
            aria-label="Ask about the menu"
            className="input min-w-0"
            maxLength={1000}
            rows={2}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={
              photo
                ? "You can just send the photo, or add a preference."
                : "Something filling? A lighter meal? Tell us your budget or preferences."
            }
          />
        </label>
        <div className="flex flex-wrap gap-3 items-center">
          <label className="btn btn-secondary cursor-pointer">
            {preparing ? "Preparing photo…" : "Add a meal photo"}
            <input
              aria-label="Meal photo for the assistant"
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              disabled={busy || preparing}
              onChange={async (e) => {
                const value = e.target.files?.[0];
                e.target.value = "";
                if (!value) return;
                setPreparing(true);
                setError(null);
                try {
                  setPhoto(await prepareDishPhoto(value));
                  onClearFocus();
                } catch (e) {
                  setError(e);
                } finally {
                  setPreparing(false);
                }
              }}
            />
          </label>
          <button
            className="btn btn-primary"
            disabled={
              busy ||
              preparing ||
              (!photo && !focus && question.trim().length < 3)
            }
          >
            {busy
              ? "Looking at your menu…"
              : photo && !question.trim()
                ? "Find something like this"
                : focus && !question.trim()
                  ? "Tell me about this dish"
                  : "Ask Yebo"}
          </button>
          {turns.length > 0 && (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => {
                setTurns([]);
                setReply(undefined);
                setError(null);
              }}
            >
              New conversation
            </button>
          )}
        </div>
      </form>
      <p className="text-xs text-mute">
        Your reference photo is used for this conversation and is not added to
        the public menu. Pictures cannot confirm allergens or ingredients—check
        these with the restaurant.
      </p>
      {reply?.suggestedItems.length > 0 && (
        <div className="space-y-3 border-t border-line pt-4">
          <h3 className="font-semibold">Your suggested dishes</h3>
          {reply.suggestedItems.map((i) => {
            const item = menu.items.find((m) => m.id === i.productId);
            return item ? (
              <div
                key={i.productId}
                className="flex gap-3 items-center border-b border-line pb-3"
              >
                {item.imageUrl && (
                  <DishPhoto
                    url={item.imageUrl}
                    name={item.name}
                    className="w-20 h-20"
                  />
                )}
                <div>
                  <p>
                    {i.quantity} × {item.name}
                  </p>
                  <p className="m text-sm text-mute">
                    {money(
                      menu.currency,
                      Math.round(item.price * 100) * i.quantity,
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <ErrorMessage
                key={i.productId}
                error="The menu has changed. Refresh it before adding these suggestions."
              />
            );
          })}
          <button
            className="btn btn-secondary"
            disabled={
              basketLocked ||
              reply.suggestedItems.some(
                (i) =>
                  !menu.items.some((m) => m.id === i.productId && m.available),
              )
            }
            onClick={() => {
              onSuggestions(reply.suggestedItems);
              setReply(undefined);
            }}
          >
            Add suggestions to my basket
          </button>
          <p className="text-xs text-mute">
            Review quantities, your collection time and the total before you
            place an order.
          </p>
        </div>
      )}
    </section>
  );
}
