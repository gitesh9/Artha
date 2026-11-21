export const passwordPolicy = { minLength: 8, maxLength: 128, resetTokenSeconds: 3600 };
export function validateNewPassword(password: string, confirmation: string): string | null {
  if (password.length < passwordPolicy.minLength || password.length > passwordPolicy.maxLength) return "Use a password between 8 and 128 characters.";
  if (password !== confirmation) return "Passwords do not match.";
  return null;
}