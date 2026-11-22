/** Exact development origins only; never trust arbitrary forwarded hosts. */
const developmentOrigins = [
  "http://localhost:5173", "http://localhost:8888", "http://localhost:8080",
  "https://61f8f5db-ea02-48d8-8dc0-4bc37337670c.lovableproject.com",
  "https://id-preview--61f8f5db-ea02-48d8-8dc0-4bc37337670c.lovable.app",
];

export function authRequestPolicy(request: Request, configuredURL: string | undefined, development: boolean) {
  let baseURL = configuredURL;
  if (development) {
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProtocol = request.headers.get("x-forwarded-proto");
    const candidates = [request.headers.get("origin"),
      forwardedHost && forwardedProtocol ? `${forwardedProtocol}://${forwardedHost}` : null,
      new URL(request.url).origin];
    baseURL = candidates.find((origin): origin is string => !!origin && developmentOrigins.includes(origin)) ?? configuredURL;
  }
  const secure = !development || Boolean(baseURL?.startsWith("https://"));
  const embeddedPreview = development && secure && !!baseURL && developmentOrigins.includes(baseURL);
  return {
    ...(baseURL ? { baseURL } : {}),
    ...(development ? { trustedOrigins: developmentOrigins } : {}),
    advanced: {
      useSecureCookies: secure,
      defaultCookieAttributes: {
        httpOnly: true, secure,
        sameSite: embeddedPreview ? "none" as const : "lax" as const,
        ...(embeddedPreview ? { partitioned: true } : {}),
      },
    },
  };
}