# Minecraft plugin / Votifier listener API

Both endpoints are machine-to-machine: `Authorization: Bearer <PLUGIN_API_SECRET>` (no cookies).
Rate limited per IP. Always call over HTTPS. Base URL: `https://<site>/api`.

## POST `/plugin/link-code` — `/web link`
Body: `{ "uuid": "<player UUID, dashed or not>", "name": "<current player name>" }`
Response `200`: `{ "code": "ABCD2345", "expiresInSec": 300 }`
Show `code` to the player in chat. They enter it on the site (Účet → Prepojenie).
The code is one-time, valid 5 minutes, stored only as a hash, and bound to the UUID.
The name in the code must equal the name of the web account entering it (the AuthMe account they signed in with).

## POST `/plugin/vote`
Body: `{ "username": "<MC name>", "site": "<vote site key from admin>" }`
Call it only after your Votifier listener verified the vote site's signed packet.
The web never validates votes itself; it just records what the listener confirms.
Response `200`: `{ "ok": true }` (duplicates inside the cooldown are ignored).

Both return `401 invalid_plugin_key` on a bad key and `503 plugin_not_configured` if the secret is unset on the server.
