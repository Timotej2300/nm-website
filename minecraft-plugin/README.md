# WebLink (Minecraft plugin)

`/weblink` (or `/web link`) gives the player a one-time code (valid 5 minutes) to sign in to the website. Works on any Spigot/Paper/Purpur 1.13+ server with Java 17+. It has no dependencies; AuthMe is detected automatically.

## Build
```
cd minecraft-plugin
mvn package            # -> target/WebLink-1.0.0.jar
```
No Java/Maven locally? Push to GitHub: the workflow `.github/workflows/build-plugin.yml` builds the jar; download it from the run's *Artifacts*.

## Install
1. Put the jar into `plugins/`, start the server once, stop it.
2. Edit `plugins/WebLink/config.yml`: `api-url` (e.g. `https://ninjamelon.cz/api`) and `api-key` (= `PLUGIN_API_SECRET` from Vercel).
3. Start the server. Install it on every server players use `/weblink` on (one is enough: the code is tied to the UUID, not to the server).

## Security notes
- A code is only issued to an authenticated player: AuthMe `isAuthenticated`, or online-mode, or `trust-proxy-authentication: true` behind an online-mode proxy. On a cracked server without AuthMe the plugin refuses.
- Never share `config.yml` (it holds the key). Use a long random key.
