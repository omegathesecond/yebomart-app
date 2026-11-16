import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MenuAssistant } from "./MenuAssistant";
import api from "@/api/client";
vi.mock("@/stores/authStore", () => ({ useAuthStore: vi.fn() }));
vi.mock("@/api/client", () => ({ default: { request: vi.fn() } }));
vi.mock("./photos", () => ({
  prepareDishPhoto: async (file: File) => file,
  usePhotoPreview: () => undefined,
  DishPhoto: () => null,
}));
const menu: any = {
  slug: "test",
  currency: "SZL",
  items: [{ id: "soup", name: "Soup", available: true, price: 25 }],
};
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.resetAllMocks();
  vi.mocked(api.request).mockResolvedValue({
    data: {
      answer: "Try the soup for E25.",
      suggestedItems: [{ productId: "soup", quantity: 1 }],
    },
  } as any);
});
it("sends a photo without requiring typed text, and adds suggestions only on request", async () => {
  const add = vi.fn();
  render(
    <MenuAssistant menu={menu} onClearFocus={() => {}} onSuggestions={add} />,
  );
  fireEvent.change(screen.getByLabelText("Meal photo for the assistant"), {
    target: { files: [new File(["food"], "meal.png", { type: "image/png" })] },
  });
  fireEvent.click(
    await screen.findByRole("button", { name: "Find something like this" }),
  );
  await screen.findByText("Try the soup for E25.");
  const body = (vi.mocked(api.request).mock.calls[0][1] as any)
    .body as FormData;
  expect(body.get("photo")).toBeInstanceOf(File);
  expect(body.get("question")).toMatch(/meal photo/);
  expect(add).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /Add.*basket/i }));
  expect(add).toHaveBeenCalledWith([{ productId: "soup", quantity: 1 }]);
  fireEvent.change(screen.getByLabelText("Ask about the menu"), {
    target: { value: "Is that filling?" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ask Yebo" }));
  await waitFor(() => expect(api.request).toHaveBeenCalledTimes(2));
  const next = (vi.mocked(api.request).mock.calls[1][1] as any)
    .body as FormData;
  expect(JSON.parse(next.get("history") as string)).toEqual([
    expect.objectContaining({ role: "user" }),
    { role: "assistant", content: "Try the soup for E25." },
  ]);
});
it("surfaces an assistant failure without a made-up answer or basket change", async () => {
  vi.mocked(api.request).mockRejectedValue(
    new Error("Menu assistant is unavailable"),
  );
  const add = vi.fn();
  render(
    <MenuAssistant menu={menu} onClearFocus={() => {}} onSuggestions={add} />,
  );
  fireEvent.change(screen.getByLabelText("Ask about the menu"), {
    target: { value: "What is available?" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ask Yebo" }));
  await screen.findByText("Menu assistant is unavailable");
  expect(add).not.toHaveBeenCalled();
  expect(screen.queryByRole("log")).not.toBeInTheDocument();
});
