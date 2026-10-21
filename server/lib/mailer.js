import nodemailer from "nodemailer";
import { siteUrl } from "./config.js";

// SMTP is optional. Without SMTP_URL every e-mail feature reports
// "mail_not_configured" instead of pretending something was sent.
//   SMTP_URL=smtps://user:pass@smtp.example.com:465   MAIL_FROM="NinjaMelon <no-reply@ninjamelon.cz>"

export const outbox = []; // only filled in capture mode (tests)

export function mailMode() {
  if (process.env.MAIL_TRANSPORT === "capture" && process.env.NODE_ENV !== "production") return "capture";
  return process.env.SMTP_URL ? "smtp" : "none";
}

export const isMailConfigured = () => mailMode() !== "none";

let transport = null;

export async function sendMail({ to, subject, text }) {
  const mode = mailMode();
  if (mode === "none") throw new Error("mail_not_configured");
  if (mode === "capture") {
    outbox.push({ to, subject, text });
    return;
  }
  if (!transport) transport = nodemailer.createTransport(process.env.SMTP_URL);
  await transport.sendMail({
    from: process.env.MAIL_FROM || "NinjaMelon <no-reply@ninjamelon.cz>",
    to,
    subject,
    text,
  });
}

export const link = (path) => `${siteUrl()}${path}`;
