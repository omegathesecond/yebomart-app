import { beforeEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import api from "@/api/client";
import { RestaurantWebsite } from "./PublicMenu";
vi.mock("@/stores/authStore", () => ({ useAuthStore: vi.fn() }));
vi.mock("@/api/client", () => ({ default: { request: vi.fn() } }));
const menu = {
  name: "Test Restaurant",
  slug: "test",
  description: "Release test menu",
  phone: "+26878422613",
  address: "Test address",
  currency: "SZL",
  timezone: "UTC",
  hours: [{ day: 1, open: "09:00", close: "18:00" }],
  acceptingOrders: true,
  leadMinutes: 20,
  allowCash: true,
  allowOnline: false,
  allowAssistant: false,
  tables: [],
  taxRate: 15,
  taxInclusive: false,
  items: [
    {
      id: "meal",
      name: "Meal",
      description: "Prepared to order",
      category: "Lunch",
      price: 40,
      available: true,
    },
  ],
};
beforeEach(() => {
  sessionStorage.clear();
  vi.resetAllMocks();
  vi.mocked(api.request).mockImplementation(async (path) =>
    path.includes("/slots")
      ? {
          data: [
            {
              at: new Date(Date.now() + 3600000).toISOString(),
              label: "12:00",
              remaining: 2,
            },
          ],
        }
      : ({ data: menu } as any),
  );
});
function mount() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={["/r/test"]}>
        <Routes>
          <Route path="/r/:slug" element={<RestaurantWebsite />} />
          <Route path="/r/:slug/order/:id" element={<p>Order page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
it("requires a review before placing a server-priced order with consent off", async () => {
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Add one Meal" }));
  fireEvent.change(screen.getByLabelText("Your name"), {
    target: { value: "Test Guest" },
  });
  fireEvent.change(screen.getByLabelText("Your phone number"), {
    target: { value: "+26878422613" },
  });
  await screen.findByRole("option", { name: "12:00" });
  fireEvent.change(screen.getByLabelText("Collection time"), {
    target: {
      value: (
        screen.getByRole("option", { name: "12:00" }) as HTMLOptionElement
      ).value,
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "Review my order" }));
  expect(screen.getByText("Ready to place your order?")).toBeInTheDocument();
  expect(
    vi
      .mocked(api.request)
      .mock.calls.some(([path]) => path.endsWith("/orders")),
  ).toBe(false);
  vi.mocked(api.request).mockImplementation(async (path, options) =>
    path.endsWith("/orders")
      ? { data: { id: "new-order" } }
      : ({ data: menu } as any),
  );
  fireEvent.click(screen.getByRole("button", { name: /Place order/ }));
  await screen.findByText("Order page");
  const request = vi
    .mocked(api.request)
    .mock.calls.find(([path]) => path.endsWith("/orders"));
  const body = JSON.parse(request![1]!.body as string);
  expect(body).toMatchObject({
    expectedTotalMinor: 4600,
    notifyWhatsApp: false,
    items: [{ productId: "meal", quantity: 1, notes: "" }],
  });
  expect(body.accessToken).toMatch(/^[0-9a-f]{64}$/);
  expect(body.items[0]).not.toHaveProperty("price");
});
it("surfaces a menu outage without substituting a successful sample menu", async () => {
  vi.mocked(api.request).mockResolvedValue({
    error: "Menu service unavailable",
  });
  mount();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Menu service unavailable",
  );
  expect(screen.queryByText("Test Restaurant")).toBeNull();
});
it("does not offer ordering when the restaurant pauses orders", async () => {
  vi.mocked(api.request).mockResolvedValue({
    data: { ...menu, acceptingOrders: false },
  } as any);
  mount();
  expect(
    await screen.findByText(/Online orders are paused/),
  ).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add one Meal" })).toBeNull();
});
