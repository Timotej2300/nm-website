import crypto from "node:crypto";
import { hash as argonHash, verify as argonVerify, Algorithm } from "@node-rs/argon2";
import { appSecret } from "./config.js";

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function hmacHex(data, secret = appSecret()) {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

export function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) {
    // still burn a comparison so timing does not leak the length match
    crypto.timingSafeEqual(ba, ba);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

// IPs are never stored in clear text — only a short keyed hash.
export function hashIp(ip) {
  return hmacHex(`ip:${ip || "unknown"}`).slice(0, 16);
}

// ── Web passwords: Argon2id (separate from the Minecraft/AuthMe password) ──
const ARGON_OPTS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456, // 19 MiB — OWASP minimum profile, fits serverless memory
  timeCost: 2,
  parallelism: 1,
};

export function hashWebPassword(password) {
  return argonHash(password, ARGON_OPTS);
}

export async function verifyWebPassword(stored, password) {
  try {
    return await argonVerify(stored, password);
  } catch {
    return false;
  }
}

let dummyHash = null;
// Used to make "unknown account" take about as long as a real verification.
export async function burnPasswordCheck(password) {
  if (!dummyHash) dummyHash = await hashWebPassword("dummy-password-for-timing");
  await verifyWebPassword(dummyHash, password);
}
