import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { verify as argonVerify } from "@node-rs/argon2";

// Verifies a password against a hash as stored by AuthMe Reloaded.
// AuthMe supports many algorithms (config.yml -> security.passwordHash), so
// the format is detected from the stored value. Anything unrecognised FAILS
// CLOSED — we never guess. Passwords are never written to logs.
//
// Supported: SHA256 ("$SHA$salt$hash", the AuthMe default), BCRYPT/BCRYPT2Y
// ("$2a$"/"$2b$"/"$2y$"), ARGON2 (PHC "$argon2..."), PBKDF2
// ("pbkdf2_sha256$iterations$salt$hash").

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

function eq(a, b) {
  const x = Buffer.from(String(a).toLowerCase());
  const y = Buffer.from(String(b).toLowerCase());
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function detectAuthmeAlgorithm(stored) {
  if (typeof stored !== "string") return "unknown";
  if (stored.startsWith("$SHA$")) return "SHA256";
  if (/^\$2[aby]\$/.test(stored)) return "BCRYPT";
  if (stored.startsWith("$argon2")) return "ARGON2";
  if (stored.startsWith("pbkdf2_sha256$")) return "PBKDF2";
  return "unknown";
}

export async function verifyAuthmeHash(stored, password) {
  if (typeof password !== "string" || password.length === 0 || password.length > 256) return false;
  try {
    switch (detectAuthmeAlgorithm(stored)) {
      case "SHA256": {
        const parts = stored.split("$"); // ["", "SHA", salt, hash]
        if (parts.length !== 4) return false;
        return eq(sha256(sha256(password) + parts[2]), parts[3]);
      }
      case "BCRYPT":
        return await bcrypt.compare(password, stored.replace(/^\$2y\$/, "$2a$"));
      case "ARGON2":
        return await argonVerify(stored, password);
      case "PBKDF2": {
        const parts = stored.split("$"); // pbkdf2_sha256, iter, salt, hash
        if (parts.length !== 4) return false;
        const iterations = Number.parseInt(parts[1], 10);
        if (!Number.isInteger(iterations) || iterations < 1 || iterations > 1_000_000) return false;
        const derived = crypto
          .pbkdf2Sync(password, parts[2], iterations, parts[3].length / 2, "sha256")
          .toString("hex");
        return eq(derived, parts[3]);
      }
      default:
        return false;
    }
  } catch {
    return false;
  }
}
