import { z } from "zod";

const COMMON = new Set([
  "password123", "1234567890", "qwertyuiop", "minecraft123", "ninjamelon", "iloveyou123",
  "passw0rd123", "letmein1234", "administrator", "0123456789", "password1234",
]);

/** Web password policy (this password is separate from the Minecraft one). */
export function checkWebPassword(password, { name = "", email = "" } = {}) {
  if (typeof password !== "string") return "Heslo chýba";
  if (password.length < 10) return "Heslo musí mať aspoň 10 znakov";
  if (password.length > 128) return "Heslo môže mať najviac 128 znakov";
  if (/^(.)\1+$/.test(password)) return "Heslo je príliš jednoduché";
  if (COMMON.has(password.toLowerCase())) return "Heslo je príliš časté";
  if (name && password.toLowerCase().includes(name.toLowerCase()) && name.length >= 3) {
    return "Heslo nesmie obsahovať váš Minecraft nick";
  }
  if (email && password.toLowerCase() === email.toLowerCase()) return "Heslo nesmie byť rovnaké ako e-mail";
  return null;
}

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Neplatná e-mailová adresa");
