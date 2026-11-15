export function isFrontendPreview() {
  return process.env.NEXT_PUBLIC_FRONTEND_PREVIEW === "true";
}
