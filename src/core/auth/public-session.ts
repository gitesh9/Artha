/** Public startup is allowed without auth; private guards must keep failing closed. */
export async function publicSession<T>(lookup: () => Promise<T>): Promise<T | null> {
  try { return await lookup(); }
  catch {
    // Do not log connection strings, cookies, or provider error payloads.
    console.warn("Public session lookup unavailable; sign-in will offer a retry.");
    return null;
  }
}