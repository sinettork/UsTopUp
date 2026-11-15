import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const CHECKOUT_PATH = "/api/payment-gateway/v1/payments/purchase";

export function getPayWayConfig() {
  const rawBase = process.env.ABA_PAYWAY_API_BASE_URL || "https://checkout-sandbox.payway.com.kh";
  let base: URL;
  try { base = new URL(rawBase); } catch { throw new Error("PayWay API URL is invalid."); }
  if (base.protocol !== "https:" || !["checkout-sandbox.payway.com.kh", "checkout.payway.com.kh"].includes(base.hostname)) {
    throw new Error("PayWay API URL must use an official ABA PayWay endpoint.");
  }
  const merchantId = process.env.ABA_PAYWAY_MERCHANT_ID;
  const apiKey = process.env.ABA_PAYWAY_API_KEY;
  const rawSite = process.env.APP_BASE_URL;
  if (!merchantId || !apiKey || !rawSite) throw new Error("PayWay is not configured. Add merchant credentials and APP_BASE_URL.");
  let site: URL;
  try { site = new URL(rawSite); } catch { throw new Error("APP_BASE_URL is invalid."); }
  if (site.protocol !== "https:" && site.hostname !== "localhost") throw new Error("APP_BASE_URL must use HTTPS.");
  return { base: base.origin, checkoutUrl: `${base.origin}${CHECKOUT_PATH}`, merchantId, apiKey, site: site.origin };
}

export function signPayWay(value: string, apiKey: string) {
  return createHmac("sha512", apiKey).update(value, "utf8").digest("base64");
}

export function verifyPayWayCallback(body: Record<string, unknown>, signature: string, apiKey: string) {
  const value = Object.keys(body).sort().map((key) => {
    const item = body[key];
    return Array.isArray(item) ? JSON.stringify(item) : String(item ?? "");
  }).join("");
  const expected = Buffer.from(signPayWay(value, apiKey));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function utcPayWayTime() {
  return new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
}
