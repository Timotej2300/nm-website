-- 003_tickets: player support.

CREATE TABLE IF NOT EXISTS nm_ticket_categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  cat_key VARCHAR(40) NOT NULL,
  label VARCHAR(80) NOT NULL,
  description VARCHAR(255) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_ticket_cat_key (cat_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- which roles handle which category (tickets.view_category is scoped by this)
CREATE TABLE IF NOT EXISTS nm_ticket_category_roles (
  category_id INT UNSIGNED NOT NULL,
  role_key VARCHAR(32) NOT NULL,
  PRIMARY KEY (category_id, role_key),
  CONSTRAINT fk_tcr_cat FOREIGN KEY (category_id) REFERENCES nm_ticket_categories(id) ON DELETE CASCADE,
  CONSTRAINT fk_tcr_role FOREIGN KEY (role_key) REFERENCES nm_roles(role_key) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS nm_tickets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  category_id INT UNSIGNED NOT NULL,
  subject VARCHAR(150) NOT NULL,
  priority ENUM('low','normal','high') NOT NULL DEFAULT 'normal',
  status ENUM('OPEN','IN_PROGRESS','WAITING_FOR_PLAYER','WAITING_FOR_STAFF','RESOLVED','CLOSED') NOT NULL DEFAULT 'OPEN',
  requested_staff_user_id BIGINT UNSIGNED NULL,   -- member the player asked for (NULL = anyone)
  assigned_to BIGINT UNSIGNED NULL,
  player_last_read_message_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  last_reply_at DATETIME NULL,
  last_reply_by ENUM('player','staff') NULL,
  closed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_tickets_user (user_id, updated_at),
  KEY idx_tickets_status (status, updated_at),
  KEY idx_tickets_cat (category_id, status),
  KEY idx_tickets_assigned (assigned_to, status),
  CONSTRAINT fk_tickets_user FOREIGN KEY (user_id) REFERENCES nm_users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_tickets_cat FOREIGN KEY (category_id) REFERENCES nm_ticket_categories(id) ON DELETE RESTRICT,
  CONSTRAINT fk_tickets_assigned FOREIGN KEY (assigned_to) REFERENCES nm_users(id) ON DELETE SET NULL,
  CONSTRAINT fk_tickets_requested FOREIGN KEY (requested_staff_user_id) REFERENCES nm_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- public conversation (visible to the player)
CREATE TABLE IF NOT EXISTS nm_ticket_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ticket_id BIGINT UNSIGNED NOT NULL,
  author_user_id BIGINT UNSIGNED NULL,
  author_type ENUM('player','staff') NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_tmsg_ticket (ticket_id, id),
  CONSTRAINT fk_tmsg_ticket FOREIGN KEY (ticket_id) REFERENCES nm_tickets(id) ON DELETE CASCADE,
  CONSTRAINT fk_tmsg_author FOREIGN KEY (author_user_id) REFERENCES nm_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- internal notes live in a SEPARATE table so no player-facing query can ever return them
CREATE TABLE IF NOT EXISTS nm_ticket_internal_notes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ticket_id BIGINT UNSIGNED NOT NULL,
  author_user_id BIGINT UNSIGNED NULL,
  body TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_tnote_ticket (ticket_id, id),
  CONSTRAINT fk_tnote_ticket FOREIGN KEY (ticket_id) REFERENCES nm_tickets(id) ON DELETE CASCADE,
  CONSTRAINT fk_tnote_author FOREIGN KEY (author_user_id) REFERENCES nm_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS nm_ticket_assignments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ticket_id BIGINT UNSIGNED NOT NULL,
  from_user_id BIGINT UNSIGNED NULL,
  to_user_id BIGINT UNSIGNED NULL,
  changed_by BIGINT UNSIGNED NULL,
  reason ENUM('requested','claim','assign','release','auto') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_tassign_ticket (ticket_id, id),
  CONSTRAINT fk_tassign_ticket FOREIGN KEY (ticket_id) REFERENCES nm_tickets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS nm_ticket_status_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ticket_id BIGINT UNSIGNED NOT NULL,
  from_status VARCHAR(24) NULL,
  to_status VARCHAR(24) NOT NULL,
  changed_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_tstat_ticket (ticket_id, id),
  CONSTRAINT fk_tstat_ticket FOREIGN KEY (ticket_id) REFERENCES nm_tickets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS nm_ticket_notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  ticket_id BIGINT UNSIGNED NOT NULL,
  type ENUM('new_ticket','new_reply','assigned','status_changed','closed') NOT NULL,
  message VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME NULL,
  KEY idx_tnotif_user (user_id, read_at, id),
  CONSTRAINT fk_tnotif_user FOREIGN KEY (user_id) REFERENCES nm_users(id) ON DELETE CASCADE,
  CONSTRAINT fk_tnotif_ticket FOREIGN KEY (ticket_id) REFERENCES nm_tickets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO nm_ticket_categories (cat_key, label, sort_order) VALUES
 ('technical','Technický problém',10),('account','Problém s účtom',20),('purchase','Nákup a platba',30),
 ('report','Nahlásenie hráča',40),('appeal','Odvolanie na trest',50),('question','Otázka k serveru',60),('other','Iné',70);

INSERT IGNORE INTO nm_ticket_category_roles (category_id, role_key)
SELECT c.id, r.role_key FROM nm_ticket_categories c
JOIN (SELECT 'admin' AS role_key UNION SELECT 'manager' UNION SELECT 'moderator' UNION SELECT 'support') r
WHERE c.cat_key IN ('technical','account','report','appeal','question','other');

INSERT IGNORE INTO nm_ticket_category_roles (category_id, role_key)
SELECT c.id, r.role_key FROM nm_ticket_categories c
JOIN (SELECT 'admin' AS role_key UNION SELECT 'manager' UNION SELECT 'store_manager' UNION SELECT 'support') r
WHERE c.cat_key = 'purchase';
