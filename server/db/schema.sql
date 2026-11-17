-- Gym Management Application — MySQL 8 schema
-- Every gym-owned table carries gym_id so data stays isolated per gym.
-- All DATETIME values are stored in UTC; DATE values are in the gym's local timezone.

CREATE DATABASE IF NOT EXISTS gym_app CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE gym_app;

CREATE TABLE IF NOT EXISTS gyms (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120)      NOT NULL,
  address       VARCHAR(255)      NULL,
  phone         VARCHAR(20)       NULL,
  email         VARCHAR(160)      NULL,
  latitude      DECIMAL(10,7)     NULL,
  longitude     DECIMAL(10,7)     NULL,
  radius_m      SMALLINT UNSIGNED NOT NULL DEFAULT 150,
  timezone      VARCHAR(64)       NOT NULL DEFAULT 'Asia/Kolkata',
  open_time     TIME              NULL,
  close_time    TIME              NULL,
  closed_days   SET('mon','tue','wed','thu','fri','sat','sun') NOT NULL DEFAULT '',
  qr_token      CHAR(32)          NOT NULL,
  created_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_gyms_qr_token (qr_token)
) ENGINE=InnoDB;

-- Training batches (time slots). gender 'female' = ladies-only batch, etc.
CREATE TABLE IF NOT EXISTS batches (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  gym_id        INT UNSIGNED      NOT NULL,
  name          VARCHAR(60)       NOT NULL,
  start_time    TIME              NOT NULL,
  end_time      TIME              NOT NULL,
  gender        ENUM('any','male','female') NOT NULL DEFAULT 'any',
  capacity      SMALLINT UNSIGNED NULL,
  is_active     TINYINT(1)        NOT NULL DEFAULT 1,
  created_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_batches_gym (gym_id, start_time),
  CONSTRAINT fk_batches_gym FOREIGN KEY (gym_id) REFERENCES gyms(id)
) ENGINE=InnoDB;

-- Profile photos (small JPEGs, resized in the browser). Served at /api/photos/<photo_key>;
-- the key is random and changes on every upload, so it doubles as a cache-buster.
CREATE TABLE IF NOT EXISTS photos (
  photo_key     CHAR(32)          NOT NULL PRIMARY KEY,
  gym_id        INT UNSIGNED      NOT NULL,
  mime          VARCHAR(20)       NOT NULL,
  data          MEDIUMBLOB        NOT NULL,
  created_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_photos_gym (gym_id),
  CONSTRAINT fk_photos_gym FOREIGN KEY (gym_id) REFERENCES gyms(id)
) ENGINE=InnoDB;

-- Login accounts. One account belongs to exactly one gym.
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  gym_id        INT UNSIGNED      NOT NULL,
  role          ENUM('owner','member') NOT NULL,
  name          VARCHAR(120)      NOT NULL,
  email         VARCHAR(160)      NOT NULL,
  phone         VARCHAR(20)       NULL,
  password_hash VARCHAR(100)      NOT NULL,
  photo_key     CHAR(32)          NULL,
  is_active     TINYINT(1)        NOT NULL DEFAULT 1,
  created_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  KEY ix_users_gym (gym_id),
  CONSTRAINT fk_users_gym FOREIGN KEY (gym_id) REFERENCES gyms(id)
) ENGINE=InnoDB;

-- Gym members. Created by the owner (invite); user_id is set when the member registers with the same email.
CREATE TABLE IF NOT EXISTS members (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  gym_id        INT UNSIGNED      NOT NULL,
  user_id       INT UNSIGNED      NULL,
  batch_id      INT UNSIGNED      NULL,
  full_name     VARCHAR(120)      NOT NULL,
  phone         VARCHAR(20)       NOT NULL,
  email         VARCHAR(160)      NOT NULL,
  gender        ENUM('male','female','other') NULL,
  date_of_birth DATE              NULL,
  joined_on     DATE              NOT NULL,
  notes         VARCHAR(500)      NULL,
  photo_key     CHAR(32)          NULL,
  is_active     TINYINT(1)        NOT NULL DEFAULT 1,
  created_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_members_email (email),
  UNIQUE KEY uq_members_user (user_id),
  KEY ix_members_gym_name (gym_id, full_name),
  KEY ix_members_batch (batch_id),
  CONSTRAINT fk_members_gym  FOREIGN KEY (gym_id)  REFERENCES gyms(id),
  CONSTRAINT fk_members_batch FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL,
  CONSTRAINT fk_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Plans: monthly = (month,1), quarterly = (month,3), half-yearly = (month,6), yearly = (month,12), custom = (day,N).
CREATE TABLE IF NOT EXISTS membership_plans (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  gym_id         INT UNSIGNED      NOT NULL,
  name           VARCHAR(80)       NOT NULL,
  duration_unit  ENUM('month','day') NOT NULL,
  duration_value SMALLINT UNSIGNED NOT NULL,
  price          DECIMAL(10,2)     NOT NULL,
  description    VARCHAR(255)      NULL,
  is_active      TINYINT(1)        NOT NULL DEFAULT 1,
  created_at     DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_plans_gym (gym_id),
  CONSTRAINT fk_plans_gym FOREIGN KEY (gym_id) REFERENCES gyms(id),
  CONSTRAINT ck_plans_duration CHECK (duration_value > 0),
  CONSTRAINT ck_plans_price CHECK (price >= 0)
) ENGINE=InnoDB;

-- A membership is one paid period for a member. Status is derived from dates:
--   cancelled (is_cancelled=1) | pending (starts in future) | expired (expiry < today) | active.
-- plan_name and amount are copied from the plan so later plan edits don't rewrite history.
CREATE TABLE IF NOT EXISTS memberships (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  gym_id        INT UNSIGNED      NOT NULL,
  member_id     INT UNSIGNED      NOT NULL,
  plan_id       INT UNSIGNED      NULL,
  plan_name     VARCHAR(80)       NOT NULL,
  start_date    DATE              NOT NULL,
  expiry_date   DATE              NOT NULL,
  amount        DECIMAL(10,2)     NOT NULL,
  is_cancelled  TINYINT(1)        NOT NULL DEFAULT 0,
  cancelled_at  DATETIME          NULL,
  created_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_ms_member (member_id, expiry_date),
  KEY ix_ms_gym_expiry (gym_id, expiry_date),
  CONSTRAINT fk_ms_gym    FOREIGN KEY (gym_id)    REFERENCES gyms(id),
  CONSTRAINT fk_ms_member FOREIGN KEY (member_id) REFERENCES members(id),
  CONSTRAINT fk_ms_plan   FOREIGN KEY (plan_id)   REFERENCES membership_plans(id) ON DELETE SET NULL,
  CONSTRAINT ck_ms_dates  CHECK (expiry_date >= start_date),
  CONSTRAINT ck_ms_amount CHECK (amount >= 0)
) ENGINE=InnoDB;

-- Manual fee collection (cash / UPI). Balance of a membership = amount - SUM(payments.amount).
CREATE TABLE IF NOT EXISTS payments (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  gym_id        INT UNSIGNED      NOT NULL,
  member_id     INT UNSIGNED      NOT NULL,
  membership_id INT UNSIGNED      NOT NULL,
  amount        DECIMAL(10,2)     NOT NULL,
  method        ENUM('cash','upi') NOT NULL,
  paid_on       DATE              NOT NULL,
  reference     VARCHAR(100)      NULL,
  note          VARCHAR(255)      NULL,
  recorded_by   INT UNSIGNED      NOT NULL,
  created_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_pay_gym_date (gym_id, paid_on),
  KEY ix_pay_membership (membership_id),
  KEY ix_pay_member (member_id),
  CONSTRAINT fk_pay_gym        FOREIGN KEY (gym_id)        REFERENCES gyms(id),
  CONSTRAINT fk_pay_member     FOREIGN KEY (member_id)     REFERENCES members(id),
  CONSTRAINT fk_pay_membership FOREIGN KEY (membership_id) REFERENCES memberships(id),
  CONSTRAINT fk_pay_user       FOREIGN KEY (recorded_by)   REFERENCES users(id),
  CONSTRAINT ck_pay_amount CHECK (amount > 0)
) ENGINE=InnoDB;

-- One check-in per member per (gym-local) day, enforced by the unique key.
CREATE TABLE IF NOT EXISTS attendance (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  gym_id        INT UNSIGNED      NOT NULL,
  member_id     INT UNSIGNED      NOT NULL,
  check_in_date DATE              NOT NULL,
  check_in_at   DATETIME          NOT NULL,
  latitude      DECIMAL(10,7)     NULL,
  longitude     DECIMAL(10,7)     NULL,
  distance_m    INT UNSIGNED      NULL,
  status        ENUM('present')   NOT NULL DEFAULT 'present',
  UNIQUE KEY uq_att_member_day (member_id, check_in_date),
  KEY ix_att_gym_day (gym_id, check_in_date),
  CONSTRAINT fk_att_gym    FOREIGN KEY (gym_id)    REFERENCES gyms(id),
  CONSTRAINT fk_att_member FOREIGN KEY (member_id) REFERENCES members(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS followups (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  gym_id        INT UNSIGNED      NOT NULL,
  member_id     INT UNSIGNED      NOT NULL,
  reason        ENUM('expiring','payment_pending','absent','renewal','general') NOT NULL,
  remarks       VARCHAR(500)      NULL,
  followup_date DATE              NOT NULL,
  status        ENUM('pending','completed') NOT NULL DEFAULT 'pending',
  created_by    INT UNSIGNED      NOT NULL,
  completed_at  DATETIME          NULL,
  created_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_fu_gym_status (gym_id, status, followup_date),
  KEY ix_fu_member (member_id),
  CONSTRAINT fk_fu_gym    FOREIGN KEY (gym_id)     REFERENCES gyms(id),
  CONSTRAINT fk_fu_member FOREIGN KEY (member_id)  REFERENCES members(id),
  CONSTRAINT fk_fu_user   FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB;
