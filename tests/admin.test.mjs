import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setup, teardown, resetLimits, refreshCaches, Client, loginAs, makeOwner, query, exec, PLUGIN_KEY } from "./helpers.mjs";

let owner;
before(async () => {
  await setup();
  await resetLimits();
  owner = await makeOwner("X4yl0n");
});
after(teardown);
beforeEach(resetLimits);

const roleKeys = async (id) => (await query("SELECT role_key FROM nm_user_roles WHERE user_id = ?", [id])).map((r) => r.role_key);

test("roles: anti-escalation — admins cannot touch owner, grant owner or promote above themselves", async () => {
  const admin = await loginAs("Admin_Ann");
  const victim = await loginAs("Victim_Vic");
  const mod = await loginAs("Mod_Mo");
  assert.equal((await owner.client.put(`/admin/users/${admin.id}/roles`, { roles: ["admin"] })).status, 200);
  assert.deepEqual((await roleKeys(admin.id)).sort(), ["admin", "user"]);
  // admin manages lower roles
  assert.equal((await admin.client.put(`/admin/users/${mod.id}/roles`, { roles: ["moderator"] })).status, 200);
  // ... but cannot grant owner / admin / developer, nor edit the owner, nor itself
  for (const r of ["owner", "admin", "developer"]) {
    assert.equal((await admin.client.put(`/admin/users/${victim.id}/roles`, { roles: [r] })).status, 403, r);
  }
  assert.equal((await admin.client.put(`/admin/users/${owner.id}/roles`, { roles: ["user"] })).status, 403);
  assert.equal((await admin.client.post(`/admin/users/${owner.id}/status`, { status: "suspended" })).status, 403);
  assert.equal((await admin.client.put(`/admin/users/${admin.id}/roles`, { roles: ["admin", "manager"] })).status, 403, "no self-edit");
  // not even the owner can remove the owner role or demote the owner account
  assert.equal((await owner.client.put(`/admin/users/${victim.id}/roles`, { roles: ["owner"] })).status, 403);
  assert.ok((await roleKeys(owner.id)).includes("owner"));
  // role definitions are owner-only; permissions cannot be self-granted
  assert.equal((await admin.client.post("/admin/roles", { key: "hax", name: "Hax", permissions: ["users.manage"] })).status, 403);
  assert.equal((await owner.client.patch("/admin/roles/owner", { name: "x", permissions: [] })).status, 403);
  // an admin may not hand a moderator-level user to a higher moderator-edit than allowed
  assert.equal((await mod.client.put(`/admin/users/${victim.id}/roles`, { roles: ["support"] })).status, 403, "moderators have no users.manage");
});

test("roles: owner creates a custom role with limited permissions; unknown/forbidden perms rejected", async () => {
  const bad = await owner.client.post("/admin/roles", { key: "x_role", name: "X", permissions: ["roles.manage"] });
  assert.equal(bad.status, 400);
  const bad2 = await owner.client.post("/admin/roles", { key: "x_role", name: "X", permissions: ["nope.nope"] });
  assert.equal(bad2.status, 400);
  const ok = await owner.client.post("/admin/roles", { key: "event_host", name: "Event Host", priority: 150, permissions: ["admin.access", "news.manage"], isPublicStaff: true, staffCategoryKey: "helper", staffTitle: "Event Host" });
  assert.equal(ok.status, 201);
  const u = await loginAs("Host_Hal");
  await owner.client.put(`/admin/users/${u.id}/roles`, { roles: ["event_host"] });
  assert.equal((await u.client.get("/admin/news")).status, 200);
  assert.equal((await u.client.get("/admin/store/products")).status, 403, "only the granted permissions work");
  assert.equal((await u.client.get("/admin/users")).status, 403);
});

test("staff: public role auto-adds, updates and hides members; manual management works; removing from Staff keeps permissions", async () => {
  const u = await loginAs("Staff_Stu");
  const pub = async () => (await owner.client.get("/staff")).data.members.find((m) => m.username === "Staff_Stu");
  assert.equal(await pub(), undefined);
  await owner.client.put(`/admin/users/${u.id}/roles`, { roles: ["moderator"] });
  assert.equal((await pub()).tier, "moderator");
  await owner.client.put(`/admin/users/${u.id}/roles`, { roles: ["admin"] });
  const m = await pub();
  assert.equal(m.tier, "admin", "position follows the role");
  assert.ok(!("email" in m) && !("uuid" in m));
  // admin sees the roster entry in management and deletes it: permissions stay
  const list = (await owner.client.get("/admin/staff")).data.members;
  const entry = list.find((x) => x.minecraftName === "Staff_Stu");
  assert.equal(entry.source, "role");
  assert.equal((await owner.client.del(`/admin/staff/${entry.id}`)).status, 200);
  assert.equal(await pub(), undefined);
  assert.ok((await roleKeys(u.id)).includes("admin"), "permissions survive removal from Staff");
  assert.equal((await query("SELECT status FROM nm_users WHERE id = ?", [u.id]))[0].status, "active");
  // a later role sync does not resurrect the deleted entry
  await owner.client.put(`/admin/users/${u.id}/roles`, { roles: ["admin", "support"] });
  assert.equal(await pub(), undefined);
  // re-adding manually clears the suppression; removing the role afterwards keeps manual entries
  const add = await owner.client.post("/admin/staff", { minecraftName: "Staff_Stu", categoryKey: "helper", title: "Builder", bio: "hi", discord: "stu#1", visible: true });
  assert.equal(add.status, 201);
  assert.equal((await pub()).role, "Builder");
  await owner.client.put(`/admin/users/${u.id}/roles`, { roles: [] });
  assert.equal((await pub()).role, "Builder", "manual entries are not changed by role changes");
  // hide / validation
  const id = add.data.id;
  assert.equal((await owner.client.patch(`/admin/staff/${id}`, { minecraftName: "Staff_Stu", categoryKey: "helper", title: "Builder", visible: false, avatarUrl: "javascript:alert(1)" })).status, 400);
  assert.equal((await owner.client.patch(`/admin/staff/${id}`, { minecraftName: "Staff_Stu", categoryKey: "helper", title: "Builder", visible: false })).status, 200);
  assert.equal(await pub(), undefined);
  // role loss hides role-created members
  const w = await loginAs("Staff_Wes");
  await owner.client.put(`/admin/users/${w.id}/roles`, { roles: ["moderator"] });
  assert.ok((await owner.client.get("/staff")).data.members.some((x) => x.username === "Staff_Wes"));
  await owner.client.put(`/admin/users/${w.id}/roles`, { roles: [] });
  assert.ok(!(await owner.client.get("/staff")).data.members.some((x) => x.username === "Staff_Wes"));
  assert.equal((await w.client.get("/staff")).status, 200);
});

// ───────────────────────── tickets ─────────────────────────

test("tickets: players only see their own; ids cannot be probed; internal notes never reach players", async () => {
  const a = await loginAs("Player_A");
  const b = await loginAs("Player_B");
  const sup = await loginAs("Support_Sue");
  await owner.client.put(`/admin/users/${sup.id}/roles`, { roles: ["support"] });
  const created = await a.client.post("/tickets", { subject: "Cannot join", category: "technical", body: "I get an error when joining." });
  assert.equal(created.status, 201);
  const id = created.data.id;
  assert.equal((await b.client.get(`/tickets/${id}`)).status, 404);
  assert.equal((await b.client.post(`/tickets/${id}/reply`, { body: "hi" })).status, 404);
  assert.equal((await b.client.post(`/tickets/${id}/close`)).status, 404);
  assert.equal((await b.client.get("/tickets")).data.tickets.length, 0);
  // staff reply + internal note
  assert.equal((await sup.client.post(`/admin/tickets/${id}/note`, { body: "SECRET-INTERNAL: probably a ban evasion" })).status, 200);
  assert.equal((await sup.client.post(`/admin/tickets/${id}/reply`, { body: "Please send a screenshot." })).status, 200);
  const view = await a.client.get(`/tickets/${id}`);
  assert.equal(view.status, 200);
  assert.ok(!JSON.stringify(view.data).includes("SECRET-INTERNAL"), "internal notes are never returned to the player");
  assert.equal(view.data.ticket.messages.length, 2);
  assert.equal(view.data.ticket.status, "WAITING_FOR_PLAYER");
  assert.equal(view.data.ticket.assignedTo, "Support_Sue", "replying claimed the ticket");
  const staffView = await sup.client.get(`/admin/tickets/${id}`);
  assert.equal(staffView.data.ticket.notes.length, 1);
  // unread counter then read-marking
  const list = (await a.client.get("/tickets")).data.tickets[0];
  assert.equal(list.unread, 0, "opening the ticket marked staff replies as read");
  // player reply flips status
  await a.client.post(`/tickets/${id}/reply`, { body: "Here it is." });
  assert.equal((await a.client.get(`/tickets/${id}`)).data.ticket.status, "WAITING_FOR_STAFF");
  // status history recorded with authors
  const hist = (await sup.client.get(`/admin/tickets/${id}`)).data.ticket.history;
  assert.ok(hist.length >= 3 && hist[0].toStatus === "OPEN");
});

test("tickets: validation, XSS-safe storage, per-category visibility", async () => {
  const p = await loginAs("Player_C");
  const bad = await p.client.post("/tickets", { subject: "x", category: "technical", body: "short" });
  assert.equal(bad.status, 400);
  assert.equal((await p.client.post("/tickets", { subject: "Valid subject", category: "nope", body: "long enough body" })).status, 400);
  const xss = await p.client.post("/tickets", { subject: "<img src=x onerror=alert(1)>", category: "purchase", body: "'; DROP TABLE nm_users; -- <script>alert(1)</script>" });
  assert.equal(xss.status, 201);
  assert.equal((await query("SELECT COUNT(*) AS n FROM nm_users"))[0].n > 0, true);
  const stored = (await p.client.get(`/tickets/${xss.data.id}`)).data.ticket;
  assert.equal(stored.subject, "<img src=x onerror=alert(1)>", "stored verbatim as text; the UI only ever renders text nodes");
  // moderators are not on the 'purchase' category and have no view_all
  const mod = await loginAs("Mod_Zed");
  await owner.client.put(`/admin/users/${mod.id}/roles`, { roles: ["moderator"] });
  assert.equal((await mod.client.get(`/admin/tickets/${xss.data.id}`)).status, 404);
  const q = await mod.client.get("/admin/tickets");
  assert.ok(!q.data.items.some((t) => t.id === xss.data.id));
  // store managers + support see purchases
  const sup = await loginAs("Support_Sid");
  await owner.client.put(`/admin/users/${sup.id}/roles`, { roles: ["support"] });
  assert.equal((await sup.client.get(`/admin/tickets/${xss.data.id}`)).status, 200);
  // search by id / subject / nick
  assert.equal((await owner.client.get(`/admin/tickets?q=${xss.data.id}`)).data.items.length, 1);
  assert.ok((await owner.client.get("/admin/tickets?q=Player_C")).data.items.length === 1);
  assert.equal((await owner.client.get("/admin/tickets?q=%25")).status, 200, "LIKE wildcards are escaped");
});

test("tickets: picking a specific team member, anyone-from-team replies, reassignment and orphan release", async () => {
  const p = await loginAs("Player_D");
  const s1 = await loginAs("Support_One");
  const s2 = await loginAs("Support_Two");
  const nobody = await loginAs("Plain_Nobody");
  await owner.client.put(`/admin/users/${s1.id}/roles`, { roles: ["support"] });
  await owner.client.put(`/admin/users/${s2.id}/roles`, { roles: ["support"] });
  const opts = (await p.client.get("/tickets/staff-options?category=technical")).data.staff;
  assert.ok(opts.some((o) => o.id === s1.id) && opts.some((o) => o.id === s2.id));
  assert.ok(!opts.some((o) => o.id === nobody.id), "only authorised, active members are offered");
  assert.ok(!opts.some((o) => o.id === p.id));
  // cannot request someone who cannot handle the category
  assert.equal((await p.client.post("/tickets", { subject: "Hello team", category: "technical", body: "pick someone invalid", requestedStaffUserId: nobody.id })).status, 400);
  // option B: requested member
  const t = await p.client.post("/tickets", { subject: "Need Support One", category: "technical", body: "Please help me with this.", requestedStaffUserId: s1.id });
  const id = t.data.id;
  let pv = (await p.client.get(`/tickets/${id}`)).data.ticket;
  assert.equal(pv.assignedTo, "Support_One");
  assert.equal(pv.requestedStaff, true);
  // the other team member can see it but not hijack it
  assert.equal((await s2.client.get(`/admin/tickets/${id}`)).status, 200);
  assert.equal((await s2.client.post(`/admin/tickets/${id}/reply`, { body: "I jump in" })).status, 403);
  assert.equal((await s2.client.post(`/admin/tickets/${id}/claim`)).status, 409);
  // a manager can reassign
  const mgr = await loginAs("Manager_Mel");
  await owner.client.put(`/admin/users/${mgr.id}/roles`, { roles: ["manager"] });
  assert.equal((await mgr.client.post(`/admin/tickets/${id}/assign`, { userId: s2.id })).status, 200);
  assert.equal((await s2.client.post(`/admin/tickets/${id}/reply`, { body: "Now I can answer." })).status, 200);
  assert.equal((await mgr.client.post(`/admin/tickets/${id}/assign`, { userId: nobody.id })).status, 400);
  // orphan: s2 loses the support role -> the ticket goes back to the pool
  await owner.client.put(`/admin/users/${s2.id}/roles`, { roles: [] });
  pv = (await mgr.client.get(`/admin/tickets/${id}`)).data.ticket;
  assert.equal(pv.assignedTo, null);
  assert.equal(pv.abilities.reply, true, "a manager can still answer it");
  assert.equal((await s1.client.post(`/admin/tickets/${id}/claim`)).status, 200, "and any authorised member can claim it");
  // option A: anyone — whole category team sees it unassigned
  const any = await p.client.post("/tickets", { subject: "Anyone please", category: "other", body: "Open to the whole team." });
  const fresh = await s1.client.get(`/admin/tickets/${any.data.id}`);
  assert.equal(fresh.data.ticket.assignedTo, null);
  assert.equal(fresh.data.ticket.abilities.reply, true);
  // notifications
  const n = (await s1.client.get("/notifications")).data;
  assert.ok(n.unread >= 1);
  assert.equal((await s1.client.post("/notifications/read", {})).status, 200);
  assert.equal((await s1.client.get("/notifications")).data.unread, 0);
});

test("tickets: closing, reopening, status changes permission-gated", async () => {
  const p = await loginAs("Player_E");
  const sup = await loginAs("Support_Eli");
  await owner.client.put(`/admin/users/${sup.id}/roles`, { roles: ["support"] });
  const id = (await p.client.post("/tickets", { subject: "Close me", category: "question", body: "A question for you." })).data.id;
  assert.equal((await sup.client.post(`/admin/tickets/${id}/status`, { status: "BOGUS" })).status, 400);
  assert.equal((await sup.client.post(`/admin/tickets/${id}/status`, { status: "RESOLVED" })).status, 200);
  assert.equal((await p.client.post(`/tickets/${id}/close`)).status, 200);
  assert.equal((await p.client.post(`/tickets/${id}/reply`, { body: "after close" })).status, 409);
  assert.equal((await p.client.get(`/tickets/${id}`)).data.ticket.canReopen, true);
  assert.equal((await p.client.post(`/tickets/${id}/reopen`)).status, 200);
  assert.equal((await p.client.get(`/tickets/${id}`)).data.ticket.status, "WAITING_FOR_STAFF");
  await exec("UPDATE nm_tickets SET status = 'CLOSED', closed_at = UTC_TIMESTAMP() - INTERVAL 30 DAY WHERE id = ?", [id]);
  assert.equal((await p.client.post(`/tickets/${id}/reopen`)).status, 409, "reopen window expired");
  // a plain support member cannot change status of a ticket claimed by someone else
  const other = await loginAs("Support_Ela");
  await owner.client.put(`/admin/users/${other.id}/roles`, { roles: ["support"] });
  const id2 = (await p.client.post("/tickets", { subject: "Claimed one", category: "question", body: "Another question." })).data.id;
  await sup.client.post(`/admin/tickets/${id2}/claim`);
  assert.equal((await other.client.post(`/admin/tickets/${id2}/status`, { status: "CLOSED" })).status, 403);
  // categories management is owner/permission gated
  assert.equal((await sup.client.post("/admin/ticket-categories", { key: "zzz", label: "ZZZ", roles: [] })).status, 403);
  const cat = await owner.client.post("/admin/ticket-categories", { key: "bugs", label: "Bugy", roles: ["support"] });
  assert.equal(cat.status, 201);
  assert.ok((await p.client.get("/tickets/categories")).data.categories.some((c) => c.key === "bugs"));
});

// ───────────────────────── pages, maintenance, content ─────────────────────────

test("page availability is enforced on the server, per page, with NewsDetails following News", async () => {
  const u = await loginAs("Page_Pete");
  assert.equal((await u.client.get("/store/ranks")).status, 200);
  assert.equal((await owner.client.put("/admin/pages/store", { enabled: false, message: "Obchod sa upravuje." })).status, 200);
  const off = await u.client.get("/store/ranks");
  assert.equal(off.status, 503);
  assert.equal(off.data.error.code, "page_disabled");
  assert.equal(off.data.error.message, "Obchod sa upravuje.");
  assert.equal((await u.client.get("/votes/sites")).status, 200, "other pages unaffected");
  assert.equal((await u.client.get("/auth/me")).status, 200, "auth endpoints stay reachable");
  assert.equal((await owner.client.get("/admin/pages")).status, 200, "admin stays reachable");
  assert.equal((await owner.client.get("/store/ranks")).status, 200, "team members can still preview");
  const st = (await u.client.get("/site/status")).data;
  assert.equal(st.pages.store.enabled, false);
  assert.equal((await owner.client.put("/admin/pages/store", { enabled: true })).status, 200);
  assert.equal((await u.client.get("/store/ranks")).status, 200);
  // news off => details off too
  await owner.client.put("/admin/pages/news", { enabled: false });
  assert.equal((await u.client.get("/news")).status, 503);
  assert.equal((await u.client.get("/news/survival-season-18-recap")).status, 503);
  assert.equal((await u.client.get("/site/status")).data.pages.news_details.enabled, false);
  await owner.client.put("/admin/pages/news", { enabled: true });
  // scheduling: a disable moment in the past takes over; a manual save clears it
  await exec("UPDATE nm_page_settings SET schedule_disable_at = UTC_TIMESTAMP() - INTERVAL 1 MINUTE WHERE page_key = 'votes'");
  refreshCaches();
  assert.equal((await u.client.get("/votes/sites")).status, 503);
  await owner.client.put("/admin/pages/votes", { enabled: true });
  assert.equal((await u.client.get("/votes/sites")).status, 200);
  assert.equal((await owner.client.put("/admin/pages/nonsense", { enabled: false })).status, 404);
  const row = (await owner.client.get("/admin/pages")).data.pages.find((p) => p.key === "store");
  assert.equal(row.updatedBy, "X4yl0n");
});

test("global Maintenance Mode: needs confirmation, blocks players, lets admins and login through, is audited", async () => {
  const u = await loginAs("Maint_Max");
  const body = { enabled: true, title: "Údržba", message: "Späť o hodinu.", returnAt: new Date(Date.now() + 3600_000).toISOString(), showCountdown: true };
  assert.equal((await owner.client.put("/admin/maintenance", body)).status, 400, "needs confirm");
  assert.equal((await u.client.put("/admin/maintenance", { ...body, confirm: true })).status, 403);
  assert.equal((await owner.client.put("/admin/maintenance", { ...body, confirm: true })).status, 200);
  const blocked = await u.client.get("/news");
  assert.equal(blocked.status, 503);
  assert.equal(blocked.data.error.code, "maintenance");
  assert.equal((await u.client.get("/auth/me")).status, 200);
  const st = (await new Client().get("/site/status")).data.maintenance;
  assert.equal(st.enabled, true);
  assert.equal(st.showCountdown, true);
  assert.ok(st.activatedAt);
  assert.equal((await new Client().login("Maint_Max", u.password)).status, 200, "login still works during maintenance");
  assert.equal((await owner.client.get("/admin/dashboard")).status, 200);
  assert.equal((await owner.client.get("/news")).status, 200);
  assert.equal((await owner.client.put("/admin/maintenance", { ...body, enabled: false })).status, 200, "can always be switched off");
  assert.equal((await u.client.get("/news")).status, 200);
  const acts = (await query("SELECT action FROM nm_audit_log WHERE action LIKE 'maintenance.%'")).map((r) => r.action);
  assert.ok(acts.includes("maintenance.on") && acts.includes("maintenance.off"));
});

test("news: existing posts are served; admin CRUD with drafts, scheduling and validation", async () => {
  const u = await loginAs("News_Nick");
  const list = (await u.client.get("/news")).data.posts;
  assert.equal(list.length, 4);
  assert.deepEqual(Object.keys(list[0]).sort(), ["author", "category", "date", "excerpt", "image", "slug", "title", "tone"]);
  assert.match(list[0].date, /^[A-Z][a-z]{2} \d{1,2}, \d{4}$/);
  const detail = (await u.client.get("/news/survival-season-18-recap")).data.post;
  assert.ok(Array.isArray(detail.content) && detail.content.some((b) => b.type === "list"));
  assert.equal((await u.client.get("/news/nope")).status, 404);
  assert.equal((await u.client.post("/admin/news", {})).status, 403);
  const draft = await owner.client.post("/admin/news", { title: "Koncept novinky", content: [{ type: "p", text: "Text" }], status: "draft" });
  assert.equal(draft.status, 201);
  assert.equal((await u.client.get(`/news/${draft.data.slug}`)).status, 404, "drafts are not public");
  assert.equal((await owner.client.post("/admin/news", { title: "Zlý obrázok", image: "javascript:alert(1)", content: [{ type: "p", text: "x" }], status: "draft" })).status, 400);
  assert.equal((await owner.client.post("/admin/news", { title: "Zlý blok", content: [{ type: "script", text: "x" }], status: "draft" })).status, 400);
  const pub = await owner.client.put(`/admin/news/${draft.data.id}`, { title: "Koncept novinky", content: [{ type: "h2", text: "Nadpis" }, { type: "p", text: "Text" }], status: "published" });
  assert.equal(pub.status, 200);
  assert.equal((await u.client.get(`/news/${draft.data.slug}`)).status, 200);
  const future = await owner.client.post("/admin/news", { title: "Budúca", content: [{ type: "p", text: "x" }], status: "published", publishedAt: new Date(Date.now() + 86400_000).toISOString() });
  assert.equal((await u.client.get(`/news/${future.data.slug}`)).status, 404, "scheduled posts wait for their date");
  assert.equal((await owner.client.del(`/admin/news/${draft.data.id}`)).status, 400, "delete needs confirmation");
  assert.equal((await owner.client.del(`/admin/news/${draft.data.id}?confirm=yes`)).status, 200);
});

test("store: seeded products keep the existing shapes; admin edits propagate; checkout never fakes a payment", async () => {
  const u = await loginAs("Shop_Sam");
  const ranks = (await u.client.get("/store/ranks")).data.items;
  assert.equal(ranks.length, 3);
  const vip = ranks.find((r) => r.key === "vip");
  assert.equal(vip.price, "$4.99");
  assert.ok(Array.isArray(vip.perks) && vip.values && "chatIcon" in vip.values);
  assert.equal((await u.client.get("/store/crate-keys")).data.items.length, 4);
  assert.equal((await u.client.get("/store/currency-packs")).data.items.length, 4);
  const stats = (await u.client.get("/store/stats")).data;
  assert.deepEqual(stats, { totalRaised: 0, totalDonators: 0, currency: "$" }, "no invented numbers");
  assert.equal((await u.client.get("/store/monthly-goal")).data.goal, null);
  assert.deepEqual((await u.client.get("/store/top-donators?period=allTime")).data.items, []);
  const products = (await owner.client.get("/admin/store/products")).data.items;
  const p = products.find((x) => x.key === "vip");
  assert.equal((await owner.client.patch(`/admin/store/products/${p.id}`, { category: "rank", name: "VIP+", price: 5.5, available: true, sortOrder: 10, data: p.data })).status, 200);
  assert.equal((await u.client.get("/store/ranks")).data.items.find((r) => r.key === "vip").price, "$5.50");
  assert.equal((await owner.client.patch(`/admin/store/products/${p.id}`, { category: "rank", name: "VIP+", price: 5.5, available: false, data: p.data })).status, 200);
  assert.ok(!(await u.client.get("/store/ranks")).data.items.some((r) => r.key === "vip"));
  assert.equal((await u.client.patch(`/admin/store/products/${p.id}`, { category: "rank", name: "x", price: 0, available: true })).status, 403);
  const co = await u.client.post("/store/checkout", { items: [{ key: "mvp", qty: 1 }] });
  assert.equal(co.status, 501);
  assert.equal(co.data.error.code, "payments_not_configured");
  assert.equal((await query("SELECT COUNT(*) AS n FROM nm_store_orders"))[0].n, 0, "no pretend order was created");
  assert.equal((await u.client.post("/store/checkout", { items: [{ key: "ghost", qty: 1 }] })).status, 400);
  // monthly goal from real (paid) orders only
  await owner.client.put("/admin/store/settings", { currencySymbol: "$", monthlyGoalTarget: 100 });
  assert.equal((await u.client.get("/store/monthly-goal")).data.goal.current, 0);
});

test("votes: only listener-recorded votes feed stats, leaderboards and search; admin manages sites and rewards", async () => {
  const u = await loginAs("Vote_Val");
  const key = { authorization: `Bearer ${PLUGIN_KEY}` };
  const plugin = new Client();
  assert.equal((await u.client.get("/votes/stats")).data.totalVotes, 0);
  assert.deepEqual((await u.client.get("/votes/leaderboard?period=allTime")).data.items, []);
  for (const [name, site] of [["Alpha_1", "topg"], ["Alpha_1", "mclist"], ["Beta_2", "topg"]]) {
    assert.equal((await plugin.post("/plugin/vote", { username: name, site }, { csrf: false, headers: key })).status, 200);
  }
  const dup = await plugin.post("/plugin/vote", { username: "Beta_2", site: "topg" }, { csrf: false, headers: key });
  assert.equal(dup.data.recorded, false, "replayed packets are ignored");
  assert.equal((await plugin.post("/plugin/vote", { username: "Beta_2", site: "topg" }, { csrf: false })).status, 401);
  const lb = (await u.client.get("/votes/leaderboard?period=daily")).data.items;
  assert.deepEqual(lb.map((r) => [r.username, r.votes]), [["Alpha_1", 2], ["Beta_2", 1]]);
  const wall = (await u.client.get("/votes/wall-of-fame?period=daily")).data.items;
  assert.equal(wall[0].title, "#1 Top Daily Voter");
  const stats = (await u.client.get("/votes/stats")).data;
  assert.equal(stats.totalVotes, 3);
  assert.equal(stats.totalVoters, 2);
  assert.equal(stats.weeklyGoal, null);
  assert.deepEqual((await u.client.get("/votes/search?q=Beta_2")).data.player, { rank: 2, username: "Beta_2", votes: 1 });
  assert.equal((await u.client.get("/votes/sites")).data.items.length, 11);
  assert.equal((await owner.client.patch("/admin/votes/sites/topg", { name: "TopG.org", href: "javascript:alert(1)", enabled: false })).status, 400);
  assert.equal((await owner.client.patch("/admin/votes/sites/topg", { name: "TopG.org", href: "https://topg.org/x", enabled: false })).status, 200);
  assert.equal((await u.client.get("/votes/sites")).data.items.length, 10);
  assert.equal((await owner.client.put("/admin/votes/rewards", { rewards: [{ votes: 3, label: "3 Votes", reward: "A key" }], weeklyGoal: 50 })).status, 200);
  assert.equal((await u.client.get("/votes/stats")).data.weeklyGoal.target, 50);
  assert.equal((await u.client.get("/votes/rewards")).data.items.length, 1);
});

test("dashboard, audit, system status and user list expose only real, non-secret data", async () => {
  const dash = (await owner.client.get("/admin/dashboard")).data;
  assert.ok(dash.users.total >= 10);
  assert.equal(typeof dash.tickets.open, "number");
  assert.equal(dash.maintenance.enabled, false);
  const audit = (await owner.client.get("/admin/audit?action=roles")).data;
  assert.ok(audit.items.length > 0 && audit.items.every((i) => i.action.startsWith("roles")));
  const sys = (await owner.client.get("/admin/system")).data;
  assert.equal(sys.checks.ownerAccountLinked, true);
  assert.equal(sys.checks.authme.reachable, true);
  assert.ok(sys.migrations.length >= 4);
  const blob = JSON.stringify(sys) + JSON.stringify((await owner.client.get("/admin/users")).data);
  for (const s of ["APP_SECRET", "test-app-secret", PLUGIN_KEY, "$argon2", "web_password_hash", "token_hash"]) assert.ok(!blob.includes(s), s);
  const users = (await owner.client.get("/admin/users?q=Player_A")).data.items;
  assert.equal(users.length, 1);
  assert.deepEqual(Object.keys(users[0]).sort(), ["createdAt", "emailVerified", "id", "lastLoginAt", "linked", "name", "roles", "status", "uuid"]);
  // a suspended user loses access immediately
  const victim = users[0];
  assert.equal((await owner.client.post(`/admin/users/${victim.id}/status`, { status: "suspended" })).status, 200);
  const p = new Client();
  const r = await p.login("Player_A", "Secret-pass-123");
  assert.equal(r.status, 403);
});
