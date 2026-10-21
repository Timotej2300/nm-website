-- 004: recorded votes (filled by the Votifier listener through /api/plugin/vote)
-- and staff-roster suppressions (a role-created entry that was deleted by hand
-- must not be re-created by the next role sync).

CREATE TABLE IF NOT EXISTS nm_votes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(16) NOT NULL,
  site_key VARCHAR(64) NOT NULL,
  voted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_votes_time (voted_at),
  KEY idx_votes_user (username, voted_at),
  KEY idx_votes_dup (username, site_key, voted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS nm_staff_suppressions (
  user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_suppress_user FOREIGN KEY (user_id) REFERENCES nm_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
