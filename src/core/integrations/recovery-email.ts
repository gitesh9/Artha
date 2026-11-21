/** Server-only adapter: never log reset URLs or tokens. */
export async function sendRecoveryEmail(email: string, url: string, key: string, sender: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: sender, to: [email], subject: "Reset your Artha password", text: `Reset your Artha password using this link (valid for one hour):\n${url}\n\nIf you did not request this, ignore this email.` }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Password recovery email could not be delivered. Please try again later.");
}