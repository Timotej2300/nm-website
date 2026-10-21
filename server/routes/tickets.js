import { z } from "zod";
import { get, post, parseInput } from "../lib/http.js";
import { queryOne } from "../lib/db.js";
import {
  listCategories,
  ticketSettings,
  eligibleHandlers,
  createTicket,
  listPlayerTickets,
  getPlayerTicket,
  playerReply,
  playerClose,
  playerReopen,
  listNotifications,
  markNotificationsRead,
} from "../lib/tickets.js";
import { badRequest } from "../lib/errors.js";

// Player-facing ticket API. Every query is scoped to the signed-in user, so
// another player's ticket id behaves exactly like one that does not exist.

const idOf = (ctx) => {
  const id = Number.parseInt(ctx.params.id, 10);
  if (!Number.isInteger(id) || id < 1) throw badRequest("Neplatné ID ticketu");
  return id;
};

get("/tickets/categories", { page: "tickets" }, async () => {
  const [categories, settings] = await Promise.all([listCategories(), ticketSettings()]);
  return { categories, playerPriority: settings.playerPriority };
});

get("/tickets/staff-options", { page: "tickets" }, async (ctx) => {
  const cat = await queryOne("SELECT id FROM nm_ticket_categories WHERE cat_key = ? AND enabled = 1", [String(ctx.query.category || "")]);
  if (!cat) throw badRequest("Neplatná kategória");
  const handlers = await eligibleHandlers(cat.id, { excludeUserId: ctx.user.id });
  return { staff: handlers };
});

get("/tickets", { page: "tickets" }, async (ctx) => ({ tickets: await listPlayerTickets(ctx.user) }));

const createSchema = z.object({
  subject: z.string(),
  category: z.string().max(40),
  body: z.string(),
  priority: z.enum(["low", "normal", "high"]).optional(),
  requestedStaffUserId: z.number().int().positive().nullable().optional(),
});

post("/tickets", { page: "tickets" }, async (ctx) => {
  const input = parseInput(createSchema, ctx.body);
  const id = await createTicket(ctx.user, input);
  ctx.status = 201;
  return { id };
});

get("/tickets/:id", { page: "tickets" }, async (ctx) => ({ ticket: await getPlayerTicket(ctx.user, idOf(ctx)) }));

post("/tickets/:id/reply", { page: "tickets" }, async (ctx) => {
  const { body } = parseInput(z.object({ body: z.string() }), ctx.body);
  await playerReply(ctx.user, idOf(ctx), body);
  return { ok: true };
});

post("/tickets/:id/close", { page: "tickets" }, async (ctx) => {
  await playerClose(ctx.user, idOf(ctx));
  return { ok: true };
});

post("/tickets/:id/reopen", { page: "tickets" }, async (ctx) => {
  await playerReopen(ctx.user, idOf(ctx));
  return { ok: true };
});

get("/notifications", { page: "tickets" }, async (ctx) => listNotifications(ctx.user.id));

post("/notifications/read", { page: "tickets" }, async (ctx) => {
  const { ids } = parseInput(z.object({ ids: z.array(z.number().int()).max(100).optional() }), ctx.body);
  await markNotificationsRead(ctx.user.id, ids || null);
  return { ok: true };
});
