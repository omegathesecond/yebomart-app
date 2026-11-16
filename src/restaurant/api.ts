import api from "@/api/client";
export interface Navigation {
  id: string;
  name: string;
  href: string;
  group: string;
}
export interface Workspace {
  modules: string[];
  choices: string[];
  role: string;
  kitchen: boolean;
  navigation: Navigation[];
  businessType: string;
  restaurantConfigured: boolean;
}
export interface MenuItem {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  available: boolean;
  imageUrl?: string;
}
export interface Hours {
  day: number;
  open: string;
  close: string;
}
export interface RestaurantProfile {
  slug: string;
  description: string;
  publicPhone: string;
  published: boolean;
  acceptingOrders: boolean;
  hours: Hours[];
  leadMinutes: number;
  slotMinutes: number;
  slotCapacity: number;
  tables: string[];
  menuProductIds: string[];
  unavailableProductIds: string[];
  allowCash: boolean;
  allowOnline: boolean;
  allowAssistant: boolean;
  paymentsConnected?: boolean;
  items?: MenuItem[];
}
export interface PublicMenu {
  name: string;
  slug: string;
  description: string;
  phone: string;
  address: string;
  currency: string;
  timezone: string;
  hours: Hours[];
  acceptingOrders: boolean;
  leadMinutes: number;
  allowCash: boolean;
  allowOnline: boolean;
  allowAssistant: boolean;
  tables: string[];
  taxRate: number;
  taxInclusive: boolean;
  items: MenuItem[];
}
export interface Ticket {
  id: string;
  number: string;
  status: string;
  items: {
    productId: string;
    name: string;
    quantity: number;
    unitPrice?: number;
    notes: string;
  }[];
  totalMinor?: number;
  currency?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  checkoutState?: string;
  requestedFor: string;
  mode: string;
  tableName?: string;
  failure?: string;
  customerName?: string;
  customerPhone?: string;
  saleId?: string;
}
export async function call<T>(
  path: string,
  method = "GET",
  body?: unknown,
  headers?: HeadersInit,
): Promise<T> {
  const r = await api.request<T>("/api" + path, {
    method,
    ...(body !== undefined
      ? { body: body instanceof FormData ? body : JSON.stringify(body) }
      : {}),
    headers,
  });
  if (r.error) throw Object.assign(new Error(r.error), { status: r.status });
  if (r.data === undefined)
    throw new Error("The server returned no result. Please retry.");
  return r.data;
}
export const money = (currency: string, minor: number) =>
  currency +
  " " +
  (minor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export const profileBody = (p: RestaurantProfile) => {
  const {
    slug,
    description,
    publicPhone,
    published,
    acceptingOrders,
    hours,
    leadMinutes,
    slotMinutes,
    slotCapacity,
    tables,
    menuProductIds,
    unavailableProductIds,
    allowCash,
    allowOnline,
    allowAssistant,
  } = p;
  return {
    slug,
    description,
    publicPhone,
    published,
    acceptingOrders,
    hours,
    leadMinutes,
    slotMinutes,
    slotCapacity,
    tables,
    menuProductIds,
    unavailableProductIds,
    allowCash,
    allowOnline,
    allowAssistant,
  };
};
