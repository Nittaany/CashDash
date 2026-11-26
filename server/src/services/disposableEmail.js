import { isDisposableEmail } from "disposable-email-domains-js";

export function isDisposableEmailAddress(email) {
  if (typeof email !== "string") return false;

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail.includes("@")) return false;

  return isDisposableEmail(normalizedEmail);
}
