import crypto from "node:crypto";
import { exec, queryOne } from "./db.js";
import { hmacHex, safeEqual } from "./crypto.js";
import { HttpError } from "./errors.js";
import { isProd } from "./config.js";

// Custom visual CAPTCHA. The challenge is a rendered SVG of pixel glyphs in
// the site's colours; the expected answer only ever lives server-side as an
// HMAC. Every challenge is single-use (consumed on the FIRST answer attempt,
// right or wrong) and expires after 3 minutes.

const TTL_MS = 3 * 60 * 1000;

// 5x7 glyphs, 1 = filled. Confusable characters (0/O, 1/I/L, S/5, B/8 ...)
// are intentionally left out.
const GLYPHS = {
  2: ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  3: ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  6: ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  9: ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
};
const ALPHABET = Object.keys(GLYPHS);

const COLORS = ["#ffc02e", "#dd7f06", "#6fcb6b", "#35c2fc", "#ff5cc8", "#e9e9e9"];
const r = (min, max) => crypto.randomInt(min, max + 1);

function renderSvg(text) {
  const cell = 5;
  const W = 220;
  const H = 76;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">`,
    `<rect width="${W}" height="${H}" fill="#171009"/>`,
  ];
  // background pixel noise
  for (let i = 0; i < 150; i++) {
    parts.push(
      `<rect x="${r(0, W - 3)}" y="${r(0, H - 3)}" width="3" height="3" fill="${COLORS[r(0, 5)]}" opacity="0.${r(1, 3)}"/>`,
    );
  }
  [...text].forEach((ch, i) => {
    const glyph = GLYPHS[ch];
    const color = COLORS[r(0, 5)];
    const gx = 14 + i * 40 + r(-3, 3);
    const gy = 20 + r(-6, 6);
    const rot = r(-14, 14);
    const cx = gx + (5 * cell) / 2;
    const cy = gy + (7 * cell) / 2;
    parts.push(`<g transform="rotate(${rot} ${cx} ${cy})" fill="${color}">`);
    glyph.forEach((row, y) => {
      [...row].forEach((v, x) => {
        if (v === "1") {
          parts.push(`<rect x="${gx + x * cell}" y="${gy + y * cell}" width="${cell}" height="${cell}"/>`);
        }
      });
    });
    parts.push("</g>");
  });
  // strike-through noise lines
  for (let i = 0; i < 4; i++) {
    parts.push(
      `<line x1="${r(0, 40)}" y1="${r(5, H - 5)}" x2="${r(W - 40, W)}" y2="${r(5, H - 5)}" stroke="${COLORS[r(0, 5)]}" stroke-width="2" opacity="0.55"/>`,
    );
  }
  parts.push("</svg>");
  return parts.join("");
}

const norm = (s) => String(s || "").trim().toUpperCase().replace(/\s+/g, "");

export async function createCaptcha() {
  const id = crypto.randomBytes(16).toString("hex");
  let text = "";
  for (let i = 0; i < 5; i++) text += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  await exec(
    "INSERT INTO nm_captcha (id, answer_hash, expires_at) VALUES (?, ?, ?)",
    [id, hmacHex(`captcha:${id}:${text}`), new Date(Date.now() + TTL_MS)],
  );
  if (Math.random() < 0.05) {
    exec("DELETE FROM nm_captcha WHERE expires_at < ?", [new Date(Date.now() - 3600_000)]).catch(() => {});
  }
  const out = { id, svg: renderSvg(text), expiresInSec: TTL_MS / 1000 };
  // Test-suite hook only; hard-disabled in production.
  if (process.env.NM_TEST_EXPOSE_CAPTCHA === "1" && !isProd()) out.answer = text;
  return out;
}

/** Consumes the challenge. Throws a 400 on any failure. */
export async function verifyCaptcha(id, answer) {
  const fail = () =>
    new HttpError(400, "captcha_failed", "CAPTCHA nebola správna alebo vypršala. Skúste novú.");
  if (typeof id !== "string" || !/^[0-9a-f]{32}$/.test(id) || !answer) throw fail();
  const res = await exec(
    "UPDATE nm_captcha SET used_at = UTC_TIMESTAMP() WHERE id = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()",
    [id],
  );
  if (res.affectedRows !== 1) throw fail();
  const row = await queryOne("SELECT answer_hash FROM nm_captcha WHERE id = ?", [id]);
  if (!row || !safeEqual(row.answer_hash, hmacHex(`captcha:${id}:${norm(answer)}`))) throw fail();
}
