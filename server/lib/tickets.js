import { exec, query, queryOne, tx } from "./db.js";
import { loadActor, can } from "./perms.js";
import { getSetting } from "./settings.js";
import { badRequest, conflict, forbidden, notFound } from "./errors.js";
import { enforce } from "./ratelimit.js";
import { isMailConfigured, sendMail, link } from "./mailer.js";
import { TICKET_STATUSES, TICKET_STATUS_LABELS } from "../../shared/permissions.js";

// ───────────────────────────── helpers ─────────────────────────────

/** Plain text only. Control characters stripped; rendering is escaped by React. */
export function cleanText(input, { min = 1, max = 5000, field = "text" } = {}) {
  if (typeof input !== "string") throw badRequest(`Chýba pole ${field}`);
  // eslint-disable-next-line no-control-regex
  const s = input.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (s.length < min) throw badRequest(`Pole ${field} je príliš krátke`);
  if (s.length > max) throw badRequest(`Pole ${field} je príliš dlhé (max ${max} znakov)`);
  return s;
}

const isClosed = (s) => s === "CLOSED";

async function categoryRoleKeys(categoryId, conn) {
  const rows = await query("SELECT role_key FROM nm_ticket_category_roles WHERE category_id = ?", [categoryId], conn);
  return rows.map((r) => r.role_key);
}

function viewScope(actor, catRoles, ticket) {
  if (can(actor, "tickets.view_all")) return true;
  if (can(actor, "tickets.view_category") && actor.roleKeys.some((k) => catRoles.includes(k))) return true;
  if (can(actor, "tickets.view_assigned") && ticket.assigned_to === actor.id) return true;
  return false;
}

/** Everything a staff member may do with one ticket, computed server-side. */
export function staffAbilities(actor, ticket, catRoles) {
  const view = viewScope(actor, catRoles, ticket);
  const mine = ticket.assigned_to === actor.id;
  const free = ticket.assigned_to == null;
  const manager = can(actor, "tickets.view_all") || can(actor, "tickets.assign");
  return {
    view,
    reply: view && can(actor, "tickets.reply") && !isClosed(ticket.status) && (free || mine || manager),
    claim: view && can(actor, "tickets.claim") && free && !isClosed(ticket.status),
    assign: view && can(actor, "tickets.assign"),
    changeStatus: view && can(actor, "tickets.change_status") && (free || mine || manager),
    notes: view && can(actor, "tickets.internal_notes"),
  };
}

async function loadTicketRow(id, conn = null) {
  const t = await queryOne(
    `SELECT t.*, c.cat_key, c.label AS category_label FROM nm_tickets t
       JOIN nm_ticket_categories c ON c.id = t.category_id WHERE t.id = ?`,
    [id],
    conn,
  );
  return t;
}

async function notify(userIds, ticketId, type, message, conn) {
  const ids = [...new Set(userIds.filter(Boolean))];
  for (const uid of ids) {
    await exec(
      "INSERT INTO nm_ticket_notifications (user_id, ticket_id, type, message) VALUES (?, ?, ?, ?)",
      [uid, ticketId, type, message.slice(0, 255)],
      conn,
    );
  }
}

async function logStatus(ticketId, from, to, by, conn) {
  await exec(
    "INSERT INTO nm_ticket_status_history (ticket_id, from_status, to_status, changed_by) VALUES (?, ?, ?, ?)",
    [ticketId, from, to, by],
    conn,
  );
}

async function logAssignment(ticketId, from, to, by, reason, conn) {
  await exec(
    "INSERT INTO nm_ticket_assignments (ticket_id, from_user_id, to_user_id, changed_by, reason) VALUES (?, ?, ?, ?, ?)",
    [ticketId, from, to, by, reason],
    conn,
  );
}

/** Active staff who may answer tickets of a category (used for the player's picker, assignment and notifications). */
export async function eligibleHandlers(categoryId, { excludeUserId = null } = {}) {
  return query(
    `SELECT u.id, u.minecraft_name AS name,
            COALESCE(sm.title, (SELECT r.name FROM nm_user_roles x JOIN nm_roles r ON r.role_key = x.role_key
                                 WHERE x.user_id = u.id ORDER BY r.priority DESC LIMIT 1)) AS title
       FROM nm_users u
       LEFT JOIN nm_staff_members sm ON sm.user_id = u.id
      WHERE u.status = 'active' AND u.id <> ?
        AND EXISTS (
          SELECT 1 FROM nm_user_roles ur
           WHERE ur.user_id = u.id AND (
             ur.role_key = 'owner'
             OR (
               EXISTS (SELECT 1 FROM nm_role_permissions rp WHERE rp.role_key = ur.role_key AND rp.permission = 'tickets.reply')
               AND (
                 EXISTS (SELECT 1 FROM nm_role_permissions rp2 WHERE rp2.role_key = ur.role_key AND rp2.permission = 'tickets.view_all')
                 OR ur.role_key IN (SELECT role_key FROM nm_ticket_category_roles WHERE category_id = ?)
               )
             )
           )
        )
      ORDER BY u.minecraft_name`,
    [excludeUserId || 0, categoryId],
  );
}

async function handlerIds(categoryId, excludeUserId = null) {
  return (await eligibleHandlers(categoryId, { excludeUserId })).map((h) => h.id);
}

async function mailPlayer(userId, subject, text) {
  try {
    if (!isMailConfigured()) return;
    const u = await queryOne("SELECT email, email_verified_at FROM nm_users WHERE id = ?", [userId]);
    if (!u?.email || !u.email_verified_at) return;
    await sendMail({ to: u.email, subject, text });
  } catch (e) {
    console.error("ticket mail failed:", e?.message?.slice(0, 120));
  }
}

async function discordNewTicket(ticketId, categoryLabel) {
  try {
    const url = process.env.DISCORD_WEBHOOK_URL;
    if (!url || !(await getSetting("tickets.discord_webhook_enabled", false))) return;
    // Deliberately NO subject / message / player data — only an id and category.
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: `Nový ticket #${ticketId} (${categoryLabel})`, allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    /* optional integration — ignore */
  }
}

// ───────────────────────────── settings ─────────────────────────────

export async function ticketSettings() {
  return {
    playerPriority: Boolean(await getSetting("tickets.player_priority", false)),
    reopenDays: Number(await getSetting("tickets.reopen_days", 7)),
    maxOpenPerUser: Number(await getSetting("tickets.max_open_per_user", 5)),
    discordWebhookEnabled: Boolean(await getSetting("tickets.discord_webhook_enabled", false)),
  };
}

// ───────────────────────────── player side ─────────────────────────────

export async function listCategories({ includeDisabled = false } = {}) {
  return query(
    `SELECT id, cat_key AS \`key\`, label, description, sort_order AS sortOrder, enabled
       FROM nm_ticket_categories ${includeDisabled ? "" : "WHERE enabled = 1"} ORDER BY sort_order, id`,
  );
}

export async function createTicket(user, input) {
  const settings = await ticketSettings();
  const cat = await queryOne("SELECT * FROM nm_ticket_categories WHERE cat_key = ? AND enabled = 1", [input.category]);
  if (!cat) throw badRequest("Neplatná kategória");
  const subject = cleanText(input.subject, { min: 3, max: 150, field: "predmet" });
  const body = cleanText(input.body, { min: 5, max: 5000, field: "opis" });
  const priority = settings.playerPriority && ["low", "normal", "high"].includes(input.priority) ? input.priority : "normal";

  await enforce(`ticket:create:${user.id}`, 5, 3600_000, "Vytvorili ste príliš veľa ticketov. Skúste to neskôr.");
  const [{ n }] = await query(
    "SELECT COUNT(*) AS n FROM nm_tickets WHERE user_id = ? AND status <> 'CLOSED'",
    [user.id],
  );
  if (n >= settings.maxOpenPerUser) {
    throw conflict(`Máte príliš veľa otvorených ticketov (max ${settings.maxOpenPerUser}). Uzavrite niektorý z nich.`, "too_many_open");
  }

  let requested = null;
  if (input.requestedStaffUserId != null) {
    const handlers = await eligibleHandlers(cat.id, { excludeUserId: user.id });
    requested = handlers.find((h) => h.id === Number(input.requestedStaffUserId));
    if (!requested) throw badRequest("Vybraný člen tímu nie je pre túto kategóriu dostupný");
  }

  const ticketId = await tx(async (conn) => {
    const res = await exec(
      `INSERT INTO nm_tickets (user_id, category_id, subject, priority, status, requested_staff_user_id, assigned_to, last_reply_at, last_reply_by)
       VALUES (?, ?, ?, ?, 'OPEN', ?, ?, UTC_TIMESTAMP(), 'player')`,
      [user.id, cat.id, subject, priority, requested?.id ?? null, requested?.id ?? null],
      conn,
    );
    const id = res.insertId;
    await exec(
      "INSERT INTO nm_ticket_messages (ticket_id, author_user_id, author_type, body) VALUES (?, ?, 'player', ?)",
      [id, user.id, body],
      conn,
    );
    await logStatus(id, null, "OPEN", user.id, conn);
    if (requested) await logAssignment(id, null, requested.id, user.id, "requested", conn);
    const targets = requested ? [requested.id] : await handlerIds(cat.id, user.id);
    await notify(targets, id, "new_ticket", `Nový ticket #${id}: ${cat.label}`, conn);
    return id;
  });
  discordNewTicket(ticketId, cat.label);
  return ticketId;
}

export async function listPlayerTickets(user) {
  const rows = await query(
    `SELECT t.id, t.subject, t.status, t.priority, t.created_at AS createdAt, t.last_reply_at AS lastReplyAt,
            t.last_reply_by AS lastReplyBy, c.cat_key AS categoryKey, c.label AS category,
            a.minecraft_name AS assignedTo,
            (SELECT COUNT(*) FROM nm_ticket_messages m
               WHERE m.ticket_id = t.id AND m.author_type = 'staff' AND m.id > t.player_last_read_message_id) AS unread
       FROM nm_tickets t
       JOIN nm_ticket_categories c ON c.id = t.category_id
       LEFT JOIN nm_users a ON a.id = t.assigned_to
      WHERE t.user_id = ? ORDER BY t.updated_at DESC, t.id DESC LIMIT 200`,
    [user.id],
  );
  return rows;
}

export async function getPlayerTicket(user, id) {
  // Ownership is part of the query itself: someone else's id simply does not exist for you.
  const t = await queryOne(
    `SELECT t.*, c.label AS category_label, c.cat_key, a.minecraft_name AS assigned_name
       FROM nm_tickets t JOIN nm_ticket_categories c ON c.id = t.category_id
       LEFT JOIN nm_users a ON a.id = t.assigned_to
      WHERE t.id = ? AND t.user_id = ?`,
    [id, user.id],
  );
  if (!t) throw notFound("Ticket nenájdený");
  const messages = await query(
    `SELECT m.id, m.author_type AS authorType, m.body, m.created_at AS createdAt,
            CASE WHEN m.author_type = 'staff' THEN u.minecraft_name ELSE NULL END AS authorName
       FROM nm_ticket_messages m LEFT JOIN nm_users u ON u.id = m.author_user_id
      WHERE m.ticket_id = ? ORDER BY m.id`,
    [id],
  );
  const history = await query(
    "SELECT from_status AS fromStatus, to_status AS toStatus, created_at AS createdAt FROM nm_ticket_status_history WHERE ticket_id = ? ORDER BY id",
    [id],
  );
  const lastStaff = [...messages].reverse().find((m) => m.authorType === "staff");
  if (lastStaff && lastStaff.id > t.player_last_read_message_id) {
    await exec("UPDATE nm_tickets SET player_last_read_message_id = ? WHERE id = ?", [lastStaff.id, id]);
    await exec(
      "UPDATE nm_ticket_notifications SET read_at = UTC_TIMESTAMP() WHERE user_id = ? AND ticket_id = ? AND read_at IS NULL",
      [user.id, id],
    );
  }
  const settings = await ticketSettings();
  const closedAgo = t.closed_at ? Date.now() - new Date(t.closed_at).getTime() : 0;
  return {
    id: t.id,
    subject: t.subject,
    status: t.status,
    priority: t.priority,
    category: t.category_label,
    categoryKey: t.cat_key,
    createdAt: t.created_at,
    assignedTo: t.assigned_name || null,
    requestedStaff: t.requested_staff_user_id != null,
    messages,
    history,
    canReply: !isClosed(t.status),
    canClose: !isClosed(t.status),
    canReopen: isClosed(t.status) && closedAgo <= settings.reopenDays * 86400_000,
  };
}

export async function playerReply(user, id, bodyIn) {
  const body = cleanText(bodyIn, { min: 1, max: 5000, field: "správa" });
  await enforce(`ticket:reply:${user.id}`, 30, 600_000, "Odpovedáte príliš rýchlo.");
  const t = await queryOne("SELECT * FROM nm_tickets WHERE id = ? AND user_id = ?", [id, user.id]);
  if (!t) throw notFound("Ticket nenájdený");
  if (isClosed(t.status)) throw conflict("Ticket je uzavretý. Najprv ho znovu otvorte.", "ticket_closed");
  const cat = await queryOne("SELECT id, label FROM nm_ticket_categories WHERE id = ?", [t.category_id]);
  await tx(async (conn) => {
    await exec(
      "INSERT INTO nm_ticket_messages (ticket_id, author_user_id, author_type, body) VALUES (?, ?, 'player', ?)",
      [id, user.id, body],
      conn,
    );
    const next = t.status === "OPEN" ? "OPEN" : "WAITING_FOR_STAFF";
    await exec(
      "UPDATE nm_tickets SET status = ?, last_reply_at = UTC_TIMESTAMP(), last_reply_by = 'player', closed_at = NULL WHERE id = ?",
      [next, id],
      conn,
    );
    if (next !== t.status) await logStatus(id, t.status, next, user.id, conn);
    const targets = t.assigned_to ? [t.assigned_to] : await handlerIds(cat.id, user.id);
    await notify(targets, id, "new_reply", `Nová odpoveď hráča v tickete #${id}`, conn);
  });
}

export async function playerClose(user, id) {
  const t = await queryOne("SELECT * FROM nm_tickets WHERE id = ? AND user_id = ?", [id, user.id]);
  if (!t) throw notFound("Ticket nenájdený");
  if (isClosed(t.status)) return;
  await tx(async (conn) => {
    await exec("UPDATE nm_tickets SET status = 'CLOSED', closed_at = UTC_TIMESTAMP() WHERE id = ?", [id], conn);
    await logStatus(id, t.status, "CLOSED", user.id, conn);
    if (t.assigned_to) await notify([t.assigned_to], id, "closed", `Hráč uzavrel ticket #${id}`, conn);
  });
}

export async function playerReopen(user, id) {
  const t = await queryOne("SELECT * FROM nm_tickets WHERE id = ? AND user_id = ?", [id, user.id]);
  if (!t) throw notFound("Ticket nenájdený");
  if (!isClosed(t.status)) throw conflict("Ticket nie je uzavretý", "not_closed");
  const settings = await ticketSettings();
  const closedAgo = t.closed_at ? Date.now() - new Date(t.closed_at).getTime() : 0;
  if (closedAgo > settings.reopenDays * 86400_000) {
    throw conflict(`Ticket je uzavretý viac než ${settings.reopenDays} dní. Vytvorte nový.`, "reopen_expired");
  }
  await tx(async (conn) => {
    await exec(
      "UPDATE nm_tickets SET status = 'WAITING_FOR_STAFF', closed_at = NULL, last_reply_at = UTC_TIMESTAMP(), last_reply_by = 'player' WHERE id = ?",
      [id],
      conn,
    );
    await logStatus(id, "CLOSED", "WAITING_FOR_STAFF", user.id, conn);
    const targets = t.assigned_to ? [t.assigned_to] : await handlerIds(t.category_id, user.id);
    await notify(targets, id, "status_changed", `Hráč znovu otvoril ticket #${id}`, conn);
  });
}

// ───────────────────────────── notifications ─────────────────────────────

export async function listNotifications(userId) {
  const items = await query(
    `SELECT id, ticket_id AS ticketId, type, message, created_at AS createdAt, read_at AS readAt
       FROM nm_ticket_notifications WHERE user_id = ? ORDER BY id DESC LIMIT 30`,
    [userId],
  );
  const [{ n }] = await query(
    "SELECT COUNT(*) AS n FROM nm_ticket_notifications WHERE user_id = ? AND read_at IS NULL",
    [userId],
  );
  return { unread: n, items };
}

export async function markNotificationsRead(userId, ids = null) {
  if (Array.isArray(ids) && ids.length) {
    await exec(
      "UPDATE nm_ticket_notifications SET read_at = UTC_TIMESTAMP() WHERE user_id = ? AND read_at IS NULL AND id IN (?)",
      [userId, ids.map(Number).filter(Number.isInteger)],
    );
  } else {
    await exec("UPDATE nm_ticket_notifications SET read_at = UTC_TIMESTAMP() WHERE user_id = ? AND read_at IS NULL", [userId]);
  }
}

// ───────────────────────────── staff side ─────────────────────────────

const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function listStaffTickets(actor, f, { offset, size }) {
  const where = [];
  const params = [];
  if (!can(actor, "tickets.view_all")) {
    const ors = [];
    if (can(actor, "tickets.view_category") && actor.roleKeys.length) {
      ors.push("t.category_id IN (SELECT category_id FROM nm_ticket_category_roles WHERE role_key IN (?))");
      params.push(actor.roleKeys);
    }
    if (can(actor, "tickets.view_assigned")) {
      ors.push("t.assigned_to = ?");
      params.push(actor.id);
    }
    if (!ors.length) return { total: 0, items: [] };
    where.push(`(${ors.join(" OR ")})`);
  }
  if (f.status && TICKET_STATUSES.includes(f.status)) {
    where.push("t.status = ?");
    params.push(f.status);
  } else if (f.status === "active") {
    where.push("t.status NOT IN ('RESOLVED','CLOSED')");
  }
  if (f.category) {
    where.push("c.cat_key = ?");
    params.push(f.category);
  }
  if (f.priority && ["low", "normal", "high"].includes(f.priority)) {
    where.push("t.priority = ?");
    params.push(f.priority);
  }
  if (f.assignee === "me") {
    where.push("t.assigned_to = ?");
    params.push(actor.id);
  } else if (f.assignee === "none") {
    where.push("t.assigned_to IS NULL");
  } else if (f.assignee && /^\d+$/.test(f.assignee)) {
    where.push("t.assigned_to = ?");
    params.push(Number(f.assignee));
  }
  if (f.q) {
    const q = String(f.q).trim().slice(0, 64);
    if (/^#?\d+$/.test(q)) {
      where.push("t.id = ?");
      params.push(Number(q.replace("#", "")));
    } else if (q) {
      where.push("(t.subject LIKE ? OR p.minecraft_name LIKE ?)");
      params.push(`%${escapeLike(q)}%`, `%${escapeLike(q)}%`);
    }
  }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const from = `FROM nm_tickets t JOIN nm_ticket_categories c ON c.id = t.category_id
                JOIN nm_users p ON p.id = t.user_id LEFT JOIN nm_users a ON a.id = t.assigned_to`;
  const [{ n }] = await query(`SELECT COUNT(*) AS n ${from} ${w}`, params);
  const items = await query(
    `SELECT t.id, t.subject, t.status, t.priority, t.created_at AS createdAt, t.updated_at AS updatedAt,
            t.last_reply_at AS lastReplyAt, t.last_reply_by AS lastReplyBy,
            c.cat_key AS categoryKey, c.label AS category,
            p.minecraft_name AS player, t.assigned_to AS assignedToId, a.minecraft_name AS assignedTo,
            t.requested_staff_user_id AS requestedStaffId
       ${from} ${w} ORDER BY FIELD(t.status,'OPEN','WAITING_FOR_STAFF','IN_PROGRESS','WAITING_FOR_PLAYER','RESOLVED','CLOSED'),
            t.updated_at DESC LIMIT ? OFFSET ?`,
    [...params, size, offset],
  );
  return { total: n, items };
}

async function staffTicketOrThrow(actor, id, conn = null) {
  const t = await loadTicketRow(id, conn);
  if (!t) throw notFound("Ticket nenájdený");
  const catRoles = await categoryRoleKeys(t.category_id, conn);
  const ab = staffAbilities(actor, t, catRoles);
  // 404 (not 403) when out of scope so ticket ids cannot be probed.
  if (!ab.view) throw notFound("Ticket nenájdený");
  return { t, ab, catRoles };
}

export async function getStaffTicket(actor, id) {
  const { t, ab } = await staffTicketOrThrow(actor, id);
  const player = await queryOne("SELECT id, minecraft_name AS name, minecraft_uuid AS uuid FROM nm_users WHERE id = ?", [t.user_id]);
  const messages = await query(
    `SELECT m.id, m.author_type AS authorType, m.body, m.created_at AS createdAt, u.minecraft_name AS authorName
       FROM nm_ticket_messages m LEFT JOIN nm_users u ON u.id = m.author_user_id WHERE m.ticket_id = ? ORDER BY m.id`,
    [id],
  );
  const notes = ab.notes
    ? await query(
        `SELECT n.id, n.body, n.created_at AS createdAt, u.minecraft_name AS authorName
           FROM nm_ticket_internal_notes n LEFT JOIN nm_users u ON u.id = n.author_user_id WHERE n.ticket_id = ? ORDER BY n.id`,
        [id],
      )
    : [];
  const history = await query(
    `SELECT h.from_status AS fromStatus, h.to_status AS toStatus, h.created_at AS createdAt, u.minecraft_name AS changedBy
       FROM nm_ticket_status_history h LEFT JOIN nm_users u ON u.id = h.changed_by WHERE h.ticket_id = ? ORDER BY h.id`,
    [id],
  );
  const assignments = await query(
    `SELECT a.reason, a.created_at AS createdAt, f.minecraft_name AS fromName, tt.minecraft_name AS toName, b.minecraft_name AS changedBy
       FROM nm_ticket_assignments a LEFT JOIN nm_users f ON f.id = a.from_user_id
       LEFT JOIN nm_users tt ON tt.id = a.to_user_id LEFT JOIN nm_users b ON b.id = a.changed_by
      WHERE a.ticket_id = ? ORDER BY a.id`,
    [id],
  );
  const assignee = t.assigned_to ? await queryOne("SELECT id, minecraft_name AS name FROM nm_users WHERE id = ?", [t.assigned_to]) : null;
  return {
    id: t.id,
    subject: t.subject,
    status: t.status,
    priority: t.priority,
    category: t.category_label,
    categoryKey: t.cat_key,
    createdAt: t.created_at,
    player,
    assignedTo: assignee,
    requestedStaffId: t.requested_staff_user_id,
    messages,
    notes,
    history,
    assignments,
    abilities: ab,
    handlers: ab.assign ? await eligibleHandlers(t.category_id) : [],
  };
}

export async function staffReply(actor, id, bodyIn) {
  const body = cleanText(bodyIn, { min: 1, max: 5000, field: "odpoveď" });
  const out = await tx(async (conn) => {
    const { t, ab } = await staffTicketOrThrow(actor, id, conn);
    if (!ab.reply) {
      if (isClosed(t.status)) throw conflict("Ticket je uzavretý", "ticket_closed");
      throw forbidden("Na tento ticket nemôžete odpovedať (je priradený inému členovi tímu)");
    }
    if (t.assigned_to == null && can(actor, "tickets.claim")) {
      await exec("UPDATE nm_tickets SET assigned_to = ? WHERE id = ?", [actor.id, id], conn);
      await logAssignment(id, null, actor.id, actor.id, "claim", conn);
      t.assigned_to = actor.id;
    }
    await exec(
      "INSERT INTO nm_ticket_messages (ticket_id, author_user_id, author_type, body) VALUES (?, ?, 'staff', ?)",
      [id, actor.id, body],
      conn,
    );
    const next = ["OPEN", "IN_PROGRESS", "WAITING_FOR_STAFF", "RESOLVED"].includes(t.status) ? "WAITING_FOR_PLAYER" : t.status;
    await exec(
      "UPDATE nm_tickets SET status = ?, last_reply_at = UTC_TIMESTAMP(), last_reply_by = 'staff', closed_at = NULL WHERE id = ?",
      [next, id],
      conn,
    );
    if (next !== t.status) await logStatus(id, t.status, next, actor.id, conn);
    await notify([t.user_id], id, "new_reply", `Nová odpoveď tímu v tickete #${id}`, conn);
    return { userId: t.user_id, subject: t.subject };
  });
  mailPlayer(out.userId, `Nová odpoveď k ticketu #${id}`, `Tím odpovedal na váš ticket #${id}. Zobrazte ho tu: ${link("/tickets")}`);
}

export async function staffNote(actor, id, bodyIn) {
  const body = cleanText(bodyIn, { min: 1, max: 5000, field: "poznámka" });
  const { ab } = await staffTicketOrThrow(actor, id);
  if (!ab.notes) throw forbidden();
  await exec("INSERT INTO nm_ticket_internal_notes (ticket_id, author_user_id, body) VALUES (?, ?, ?)", [id, actor.id, body]);
}

export async function staffClaim(actor, id) {
  await tx(async (conn) => {
    const { t, ab } = await staffTicketOrThrow(actor, id, conn);
    if (t.assigned_to != null) throw conflict("Ticket už rieši iný člen tímu", "already_assigned");
    if (!ab.claim) throw forbidden();
    await exec("UPDATE nm_tickets SET assigned_to = ?, status = IF(status = 'OPEN', 'IN_PROGRESS', status) WHERE id = ?", [actor.id, id], conn);
    await logAssignment(id, null, actor.id, actor.id, "claim", conn);
    if (t.status === "OPEN") await logStatus(id, "OPEN", "IN_PROGRESS", actor.id, conn);
    await notify([t.user_id], id, "assigned", `Váš ticket #${id} preberá ${actor.name}`, conn);
  });
}

export async function staffAssign(actor, id, toUserId) {
  await tx(async (conn) => {
    const { t, ab } = await staffTicketOrThrow(actor, id, conn);
    if (!ab.assign) throw forbidden();
    let target = null;
    if (toUserId != null) {
      const handlers = await eligibleHandlers(t.category_id);
      target = handlers.find((h) => h.id === Number(toUserId));
      if (!target) throw badRequest("Tento používateľ nemôže riešiť ticket v tejto kategórii");
    }
    if ((t.assigned_to ?? null) === (target?.id ?? null)) return;
    const nextStatus = target ? (t.status === "OPEN" ? "IN_PROGRESS" : t.status) : t.status === "IN_PROGRESS" ? "OPEN" : t.status;
    await exec("UPDATE nm_tickets SET assigned_to = ?, status = ? WHERE id = ?", [target?.id ?? null, nextStatus, id], conn);
    await logAssignment(id, t.assigned_to, target?.id ?? null, actor.id, target ? "assign" : "release", conn);
    if (nextStatus !== t.status) await logStatus(id, t.status, nextStatus, actor.id, conn);
    if (target) await notify([target.id], id, "assigned", `Ticket #${id} vám bol priradený`, conn);
    await notify([t.user_id], id, "assigned", target ? `Váš ticket #${id} rieši ${target.name}` : `Ticket #${id} čaká na pridelenie`, conn);
  });
}

export async function staffSetStatus(actor, id, status) {
  if (!TICKET_STATUSES.includes(status)) throw badRequest("Neplatný stav");
  const out = await tx(async (conn) => {
    const { t, ab } = await staffTicketOrThrow(actor, id, conn);
    if (!ab.changeStatus) throw forbidden();
    if (t.status === status) return null;
    await exec(
      "UPDATE nm_tickets SET status = ?, closed_at = IF(? IN ('CLOSED'), UTC_TIMESTAMP(), NULL) WHERE id = ?",
      [status, status, id],
      conn,
    );
    await logStatus(id, t.status, status, actor.id, conn);
    await notify(
      [t.user_id],
      id,
      status === "CLOSED" ? "closed" : "status_changed",
      status === "CLOSED" ? `Ticket #${id} bol uzavretý` : `Stav ticketu #${id}: ${TICKET_STATUS_LABELS[status]}`,
      conn,
    );
    return { userId: t.user_id };
  });
  if (out) mailPlayer(out.userId, `Ticket #${id}: ${TICKET_STATUS_LABELS[status]}`, `Stav vášho ticketu #${id} sa zmenil na "${TICKET_STATUS_LABELS[status]}". ${link("/tickets")}`);
}

/**
 * After roles/permissions/account status change: any open ticket assigned to
 * someone who can no longer handle it goes back to the pool, so a ticket can
 * never be stuck with a person who cannot answer it.
 */
export async function releaseOrphanedTickets(userId, { force = false } = {}) {
  const user = await queryOne("SELECT id, minecraft_name, minecraft_uuid, status FROM nm_users WHERE id = ?", [userId]);
  if (!user) return 0;
  const tickets = await query("SELECT * FROM nm_tickets WHERE assigned_to = ? AND status <> 'CLOSED'", [userId]);
  if (!tickets.length) return 0;
  const actor = await loadActor(user);
  let released = 0;
  for (const t of tickets) {
    const catRoles = await categoryRoleKeys(t.category_id);
    const ab = staffAbilities(actor, t, catRoles);
    const stillOk = user.status === "active" && !force && ab.view && can(actor, "tickets.reply");
    if (stillOk) continue;
    await tx(async (conn) => {
      const next = t.status === "IN_PROGRESS" ? "OPEN" : t.status;
      await exec("UPDATE nm_tickets SET assigned_to = NULL, status = ? WHERE id = ?", [next, t.id], conn);
      await logAssignment(t.id, userId, null, null, "auto", conn);
      if (next !== t.status) await logStatus(t.id, t.status, next, null, conn);
      await notify(await handlerIds(t.category_id, userId), t.id, "new_ticket", `Ticket #${t.id} čaká na nového riešiteľa`, conn);
    });
    released++;
  }
  return released;
}
