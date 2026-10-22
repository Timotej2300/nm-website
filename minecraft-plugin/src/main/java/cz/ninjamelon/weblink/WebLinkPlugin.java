package cz.ninjamelon.weblink;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;
import org.bukkit.plugin.java.JavaPlugin;

/**
 * /weblink (or /web link): asks the website for a one-time sign-in code bound to the
 * player's UUID and shows it in chat. The HTTP call runs off the main thread.
 */
public final class WebLinkPlugin extends JavaPlugin {

    private static final Pattern CODE = Pattern.compile("\"code\"\\s*:\\s*\"([A-Za-z0-9]{4,32})\"");
    private static final Pattern EXPIRES = Pattern.compile("\"expiresInSec\"\\s*:\\s*(\\d+)");

    private final Map<UUID, Long> lastUse = new ConcurrentHashMap<>();
    private HttpClient http;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build();

        String key = getConfig().getString("api-key", "");
        if (key.isBlank() || key.equals("CHANGE_ME")) {
            getLogger().warning("api-key is not set in config.yml - /weblink will not work until you set it.");
        }
        if (!getConfig().getString("api-url", "").startsWith("https://")) {
            getLogger().warning("api-url is not https:// - use HTTPS in production.");
        }
        if (!hasAuthMe() && !Bukkit.getOnlineMode() && !getConfig().getBoolean("trust-proxy-authentication", false)) {
            getLogger().warning("Offline-mode server without AuthMe: identities cannot be proven, codes will be refused. "
                + "Install AuthMe or, behind an online-mode proxy, set trust-proxy-authentication: true.");
        }
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        // "/web link" and "/weblink" both work; "/web <anything else>" shows nothing special.
        if (command.getName().equalsIgnoreCase("web") || label.equalsIgnoreCase("web")) {
            if (args.length == 0 || !args[0].equalsIgnoreCase("link")) {
                return false;
            }
        }
        if (!(sender instanceof Player player)) {
            sender.sendMessage(msg("players-only", false));
            return true;
        }
        if (!identityIsProven(player)) {
            player.sendMessage(msg(hasAuthMe() ? "not-logged-in" : "unsafe", true));
            return true;
        }

        long now = System.currentTimeMillis();
        long cooldownMs = getConfig().getLong("cooldown-seconds", 20) * 1000L;
        Long last = lastUse.get(player.getUniqueId());
        if (last != null && now - last < cooldownMs) {
            long left = (cooldownMs - (now - last) + 999) / 1000;
            player.sendMessage(msg("cooldown", true).replace("%seconds%", Long.toString(left)));
            return true;
        }
        lastUse.put(player.getUniqueId(), now);

        final UUID uuid = player.getUniqueId();
        final String name = player.getName();
        Bukkit.getScheduler().runTaskAsynchronously(this, () -> {
            String[] result = requestCode(uuid, name); // [code, minutes] or null
            Bukkit.getScheduler().runTask(this, () -> {
                Player p = Bukkit.getPlayer(uuid);
                if (p == null || !p.isOnline()) {
                    return;
                }
                if (result == null) {
                    p.sendMessage(msg("error", true));
                    return;
                }
                p.sendMessage(msg("code", true).replace("%code%", result[0]).replace("%minutes%", result[1]));
                p.sendMessage(msg("open", true).replace("%site%", getConfig().getString("site-url", "")));
            });
        });
        return true;
    }

    /** Calls POST {api-url}/plugin/link-code. Returns {code, minutes} or null on any failure. */
    private String[] requestCode(UUID uuid, String name) {
        try {
            String base = getConfig().getString("api-url", "").replaceAll("/+$", "");
            String key = getConfig().getString("api-key", "");
            if (base.isEmpty() || key.isBlank() || key.equals("CHANGE_ME")) {
                getLogger().warning("WebLink is not configured (api-url / api-key).");
                return null;
            }
            // Minecraft names are [A-Za-z0-9_] so no JSON escaping is needed; reject anything else defensively.
            if (!name.matches("[A-Za-z0-9_]{1,16}")) {
                getLogger().warning("Player name has unsupported characters for the web: " + name);
                return null;
            }
            String body = "{\"uuid\":\"" + uuid + "\",\"name\":\"" + name + "\"}";
            HttpRequest req = HttpRequest.newBuilder(URI.create(base + "/plugin/link-code"))
                .timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + key)
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() != 200) {
                getLogger().warning("Website answered HTTP " + res.statusCode() + " to /plugin/link-code");
                return null;
            }
            Matcher c = CODE.matcher(res.body());
            if (!c.find()) {
                return null;
            }
            Matcher e = EXPIRES.matcher(res.body());
            long seconds = e.find() ? Long.parseLong(e.group(1)) : 300;
            return new String[] {c.group(1), Long.toString(Math.max(1, seconds / 60))};
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return null;
        } catch (Exception ex) {
            getLogger().warning("Could not reach the website: " + ex.getClass().getSimpleName());
            return null;
        }
    }

    private boolean hasAuthMe() {
        Plugin am = getServer().getPluginManager().getPlugin("AuthMe");
        return am != null && am.isEnabled();
    }

    /** A code is only issued when the server can vouch for who the player is. */
    private boolean identityIsProven(Player player) {
        if (hasAuthMe()) {
            try {
                Plugin am = getServer().getPluginManager().getPlugin("AuthMe");
                Class<?> api = am.getClass().getClassLoader().loadClass("fr.xephi.authme.api.v3.AuthMeApi");
                Object instance = api.getMethod("getInstance").invoke(null);
                return (boolean) api.getMethod("isAuthenticated", Player.class).invoke(instance, player);
            } catch (ReflectiveOperationException | ClassCastException ex) {
                getLogger().warning("Could not query AuthMe (" + ex.getClass().getSimpleName() + "); refusing to issue a code.");
                return false;
            }
        }
        return Bukkit.getOnlineMode() || getConfig().getBoolean("trust-proxy-authentication", false);
    }

    private String msg(String key, boolean withPrefix) {
        String prefix = withPrefix ? getConfig().getString("messages.prefix", "") : "";
        String text = getConfig().getString("messages." + key, key);
        return ChatColor.translateAlternateColorCodes('&', prefix + text);
    }
}
