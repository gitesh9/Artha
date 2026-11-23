export function googleConfigured(id: string | undefined, secret: string | undefined) {
  return Boolean(id?.endsWith(".apps.googleusercontent.com") && secret && secret.length >= 12 && !/dummy|placeholder|replace|your-/i.test(secret));
}