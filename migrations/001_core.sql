-- 001_core: web accounts, sessions, security tables, roles, audit, settings.
-- All tables are prefixed nm_ so they never collide with AuthMe's own table.
-- Idempotent (IF NOT EXISTS / INSERT IGNORE). Never drops or rewrites data.

CREATE TABLE IF NOT EXISTS nm_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  authme_username VARCHAR(32) NULL,            -- lowercase AuthMe account name (password-verified)
  minecraft_name VARCHAR(32) NOT NULL,         -- display name (AuthMe realname)
  minecraft_uuid CHAR(36) NULL,                -- stable identity, set only through the in-game link code
  email VARCHAR(254) NULL,                     -- VERIFIED e-mail only, lowercase
  email_verified_at DATETIME NULL,
  web_password_hash VARCHAR(255) NULL,         -- Argon2id, separate from the Minecraft password
  status ENUM('active','suspended') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login_at DATETIME NULL,
  UNIQUE KEY uq_users_authme (authme_username),
  UNIQUE KEY uq_users_uuid (minecraft_uuid),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS nm_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,                -- sha256 of the random cookie token
  remember TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  ip_hash CHAR(16) NULL,
  user_agent VARCHAR(255) NULL,
  UNIQUE KEY uq_sessions_token (token_hash),
  KEY idx_sessions_user (user_id),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES nm_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS nm_rate_limits (
  bucket VARCHAR(191) NOT NULL PRIMARY KEY,
  hits INT UNSIGNED NOT NULL DEFAULT 0,
  reset_at_ms BIGINT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS nm_captcha (
  id CHAR(32) NOT NULL PRIMARY KEY,
  answer_hash CHAR(64) NOT NULL,               -- HMAC(secret, id + answer); the answer itself is never stored
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  KEY idx_captcha_exp (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS nm_email_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('verify_email','reset_password') NOT NULL,
  token_hash CHAR(64) NOT NULL,
  email VARCHAR(254) NOT NULL,                 -- address the token was sent to (the NEW address for changes)
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_email_tokens_hash (token_hash),
  KEY idx_email_tokens_user (user_id, purpose),
  CONSTRAINT fk_email_tokens_user FOREIGN KEY (user_id) REFERENCES nm_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS nm_link_codes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code_hash CHAR(64) NOT NULL,                 -- sha256 of the one-time code issued by the Minecraft plugin
  minecraft_uuid CHAR(36) NOT NULL,
  minecraft_name VARCHAR(32) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_link_codes_hash (code_hash),
  KEY idx_link_codes_uuid (minecraft_uuid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS nm_roles (
  role_key VARCHAR(32) NOT NULL PRIMARY KEY,
  name VARCHAR(60) NOT NULL,
  description VARCHAR(255) NULL,
  priority INT NOT NULL DEFAULT 0,             -- higher = more powerful; used against privilege escalation
  is_system TINYINT(1) NOT NULL DEFAULT 0,     -- system roles cannot be deleted
  is_public_staff TINYINT(1) NOT NULL DEFAULT 0,
  staff_category_key VARCHAR(32) NULL,
  staff_title VARCHAR(80) NULL,
  on_remove ENUM('hide','review') NOT NULL DEFAULT 'hide',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS nm_role_permissions (
  role_key VARCHAR(32) NOT NULL,
  permission VARCHAR(64) NOT NULL,
  PRIMARY KEY (role_key, permission),
  CONSTRAINT fk_roleperm_role FOREIGN KEY (role_key) REFERENCES nm_roles(role_key) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS nm_user_roles (
  user_id BIGINT UNSIGNED NOT NULL,
  role_key VARCHAR(32) NOT NULL,
  assigned_by BIGINT UNSIGNED NULL,
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_key),
  KEY idx_user_roles_role (role_key),
  CONSTRAINT fk_userroles_user FOREIGN KEY (user_id) REFERENCES nm_users(id) ON DELETE CASCADE,
  CONSTRAINT fk_userroles_role FOREIGN KEY (role_key) REFERENCES nm_roles(role_key) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS nm_audit_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_user_id BIGINT UNSIGNED NULL,
  actor_name VARCHAR(64) NULL,
  action VARCHAR(64) NOT NULL,
  target_type VARCHAR(32) NULL,
  target_id VARCHAR(64) NULL,
  summary VARCHAR(500) NULL,                   -- safe description, never secrets
  ip_hash CHAR(16) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_created (created_at),
  KEY idx_audit_action (action, created_at),
  KEY idx_audit_actor (actor_user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS nm_site_settings (
  k VARCHAR(64) NOT NULL PRIMARY KEY,
  v MEDIUMTEXT NULL,                           -- JSON encoded
  updated_by BIGINT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS nm_page_settings (
  page_key VARCHAR(32) NOT NULL PRIMARY KEY,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  message VARCHAR(500) NULL,
  schedule_enable_at DATETIME NULL,
  schedule_disable_at DATETIME NULL,
  updated_by BIGINT UNSIGNED NULL,
  updated_by_name VARCHAR(32) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Seeds (idempotent) ───────────────────────────────────────
INSERT IGNORE INTO nm_roles (role_key, name, description, priority, is_system, is_public_staff, staff_category_key, staff_title) VALUES
 ('owner','Owner','Hlavný vlastník systému',1000,1,1,'owner','Owner'),
 ('developer','Developer','Vývojár systému',900,1,0,NULL,NULL),
 ('admin','Admin','Administrátor',800,1,1,'admin','Administrátor'),
 ('manager','Manager','Manažér tímu',700,1,0,NULL,NULL),
 ('moderator','Moderator','Moderátor',500,1,1,'moderator','Moderátor'),
 ('news_manager','News Manager','Správca noviniek',300,1,0,NULL,NULL),
 ('store_manager','Store Manager','Správca obchodu',300,1,0,NULL,NULL),
 ('staff_manager','Staff Manager','Správca tímu',300,1,0,NULL,NULL),
 ('support','Support','Podpora hráčov',200,1,1,'helper','Support'),
 ('user','User','Bežný používateľ',0,1,0,NULL,NULL);

INSERT IGNORE INTO nm_role_permissions (role_key, permission) VALUES
 ('developer','admin.access'),('developer','users.view'),('developer','users.manage'),('developer','staff.manage'),
 ('developer','tickets.view_all'),('developer','tickets.reply'),('developer','tickets.claim'),('developer','tickets.assign'),
 ('developer','tickets.change_status'),('developer','tickets.internal_notes'),('developer','tickets.manage_categories'),('developer','tickets.manage_settings'),
 ('developer','pages.manage'),('developer','maintenance.manage'),('developer','news.manage'),('developer','store.manage'),
 ('developer','votes.manage'),('developer','settings.manage'),('developer','audit.view'),('developer','security.view'),
 ('admin','admin.access'),('admin','users.view'),('admin','users.manage'),('admin','staff.manage'),
 ('admin','tickets.view_all'),('admin','tickets.reply'),('admin','tickets.claim'),('admin','tickets.assign'),
 ('admin','tickets.change_status'),('admin','tickets.internal_notes'),
 ('admin','pages.manage'),('admin','news.manage'),('admin','store.manage'),('admin','votes.manage'),('admin','audit.view'),
 ('manager','admin.access'),('manager','users.view'),('manager','staff.manage'),
 ('manager','tickets.view_all'),('manager','tickets.reply'),('manager','tickets.claim'),('manager','tickets.assign'),
 ('manager','tickets.change_status'),('manager','tickets.internal_notes'),('manager','news.manage'),
 ('moderator','admin.access'),('moderator','users.view'),
 ('moderator','tickets.view_category'),('moderator','tickets.view_assigned'),('moderator','tickets.reply'),('moderator','tickets.claim'),
 ('moderator','tickets.change_status'),('moderator','tickets.internal_notes'),
 ('news_manager','admin.access'),('news_manager','news.manage'),
 ('store_manager','admin.access'),('store_manager','store.manage'),
 ('staff_manager','admin.access'),('staff_manager','users.view'),('staff_manager','staff.manage'),
 ('support','admin.access'),
 ('support','tickets.view_category'),('support','tickets.view_assigned'),('support','tickets.reply'),('support','tickets.claim'),
 ('support','tickets.change_status'),('support','tickets.internal_notes');

INSERT IGNORE INTO nm_page_settings (page_key, enabled) VALUES
 ('home',1),('cart',1),('login',1),('news',1),('news_details',1),('staff',1),('store',1),('votes',1),('tickets',1);
