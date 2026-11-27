/** Only same-app private paths may be used as a post-unlock destination (prevents open redirects). */
export function safeReturnPath(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^\/[a-z0-9-]+(?:[/?#][^\s\\]*)?$/i.test(value) || value.startsWith("//")) return undefined;
  if (/^\/(?:auth|local-vault|reset-password|api)(?:[/?#]|$)/.test(value)) return undefined;
  return value.slice(0, 500);
}
