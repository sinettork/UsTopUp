"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type CartLine = {
  key: string;
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

type CartContextValue = {
  items: CartLine[];
  hydrated: boolean;
  addItem: (item: Omit<CartLine, "key">) => boolean;
  removeItem: (key: string) => void;
  clearCart: () => void;
};

const CART_STORAGE_KEY = "nexuspay-cart-v1";
const CART_CHANGE_EVENT = "nexuspay-cart-change";
const CartContext = createContext<CartContextValue | null>(null);
const EMPTY_CART: CartLine[] = [];
let cachedCart: CartLine[] = EMPTY_CART;
let cachedRaw: string | null = null;
const subscribeNever = () => () => {};
const getHydratedSnapshot = () => true;
const getServerHydratedSnapshot = () => false;

function isStringRecord(value: unknown): value is Record<string, string> {
  return !!value && typeof value === "object" &&
    Object.values(value).every((item) => typeof item === "string");
}

function readCart(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is CartLine =>
      item && typeof item === "object" &&
      typeof item.key === "string" &&
      typeof item.productTitle === "string" &&
      typeof item.packageId === "string" &&
      typeof item.packageLabel === "string" &&
      typeof item.gameSlug === "string" &&
      typeof item.priceMinor === "number" &&
      typeof item.currency === "string" &&
      isStringRecord(item.customerInputs) &&
      isStringRecord(item.inputLabels),
    ).slice(0, 20);
  } catch {
    return [];
  }
}

function getCartSnapshot() {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedCart = raw ? readCart() : EMPTY_CART;
    }
  } catch {
    // Continue with the in-memory cart when browser storage is unavailable.
  }
  return cachedCart;
}

function getServerCartSnapshot() {
  return EMPTY_CART;
}

function subscribeToCart(onChange: () => void) {
  function syncFromStorage() {
    cachedRaw = null;
    onChange();
  }
  window.addEventListener("storage", syncFromStorage);
  window.addEventListener(CART_CHANGE_EVENT, syncFromStorage);
  return () => {
    window.removeEventListener("storage", syncFromStorage);
    window.removeEventListener(CART_CHANGE_EVENT, syncFromStorage);
  };
}

function writeCart(items: CartLine[]) {
  cachedCart = items;
  try {
    cachedRaw = JSON.stringify(items);
    window.localStorage.setItem(CART_STORAGE_KEY, cachedRaw);
  } catch {
    // The current tab still receives the cart even if browser storage is disabled.
    cachedRaw = null;
  }
  window.dispatchEvent(new Event(CART_CHANGE_EVENT));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const items = useSyncExternalStore(subscribeToCart, getCartSnapshot, getServerCartSnapshot);
  const hydrated = useSyncExternalStore(subscribeNever, getHydratedSnapshot, getServerHydratedSnapshot);

  const addItem = useCallback((item: Omit<CartLine, "key">) => {
    const current = getCartSnapshot();
    if (current.length >= 20) return false;
    writeCart([...current, { ...item, key: crypto.randomUUID() }]);
    return true;
  }, []);

  const removeItem = useCallback((key: string) => {
    writeCart(getCartSnapshot().filter((item) => item.key !== key));
  }, []);

  const clearCart = useCallback(() => {
    writeCart(EMPTY_CART);
  }, []);

  const value = useMemo(
    () => ({ items, hydrated, addItem, removeItem, clearCart }),
    [items, hydrated, addItem, removeItem, clearCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider.");
  return context;
}
