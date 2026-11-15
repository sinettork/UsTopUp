export type PendingOrder = {
  gameSlug: string;
  productTitle: string;
  packageId: string;
  packageLabel: string;
  creditLabel: string;
  bonusLabel: string | null;
  priceMinor: number;
  currency: string;
  customerInputs: Record<string, string>;
  inputLabels: Record<string, string>;
};

import { useSyncExternalStore } from "react";

const PENDING_ORDER_KEY = "nexuspay-pending-order-v1";

function isStringRecord(value: unknown): value is Record<string, string> {
  return !!value && typeof value === "object" &&
    Object.values(value).every((item) => typeof item === "string");
}

function isPendingOrder(value: unknown): value is PendingOrder {
  if (!value || typeof value !== "object") return false;
  const order = value as Record<string, unknown>;
  return typeof order.gameSlug === "string" &&
    typeof order.productTitle === "string" &&
    typeof order.packageId === "string" &&
    typeof order.packageLabel === "string" &&
    typeof order.creditLabel === "string" &&
    (typeof order.bonusLabel === "string" || order.bonusLabel === null) &&
    typeof order.priceMinor === "number" &&
    typeof order.currency === "string" &&
    isStringRecord(order.customerInputs) &&
    isStringRecord(order.inputLabels);
}

export function savePendingOrder(order: PendingOrder) {
  cacheValid = false;
  try {
    window.localStorage.setItem(PENDING_ORDER_KEY, JSON.stringify(order));
  } catch {
    // Storage can be unavailable (private mode); checkout then shows its empty state.
  }
}

export function clearPendingOrder() {
  cacheValid = false;
  try {
    window.localStorage.removeItem(PENDING_ORDER_KEY);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}

let cachedRaw: string | null = null;
let cachedOrder: PendingOrder | null = null;
let cacheValid = false;

function getPendingOrderSnapshot(): PendingOrder | null {
  try {
    const raw = window.localStorage.getItem(PENDING_ORDER_KEY);
    if (!cacheValid || raw !== cachedRaw) {
      cachedRaw = raw;
      cacheValid = true;
      if (!raw) {
        cachedOrder = null;
      } else {
        const parsed: unknown = JSON.parse(raw);
        cachedOrder = isPendingOrder(parsed) ? parsed : null;
      }
    }
  } catch {
    // Keep the last known order when storage is unavailable.
  }
  return cachedOrder;
}

function getServerPendingOrderSnapshot(): PendingOrder | null {
  return null;
}

const subscribeNever = () => () => {};
const getHydratedSnapshot = () => true;
const getServerHydratedSnapshot = () => false;

export function usePendingOrder() {
  const order = useSyncExternalStore(subscribeNever, getPendingOrderSnapshot, getServerPendingOrderSnapshot);
  const hydrated = useSyncExternalStore(subscribeNever, getHydratedSnapshot, getServerHydratedSnapshot);
  return { order, hydrated };
}
