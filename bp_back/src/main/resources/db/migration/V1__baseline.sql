-- Epic 11 baseline: the WHOLE schema (AD-5, AD-6, AD-7). DDL only, never data rows.
-- Primary keys are application-generated uuids; instants are timestamptz; enums are text + CHECK.

CREATE TABLE users
(
    id            uuid PRIMARY KEY,
    -- Binary collation: Epic 9 AD-6 sorts users by username with a binary order.
    username      text COLLATE "C" NOT NULL UNIQUE,
    password_hash text NOT NULL,
    role          text NOT NULL CHECK (role IN ('user', 'admin'))
);

CREATE TABLE lists
(
    id         uuid PRIMARY KEY,
    name       text        NOT NULL,
    emoji      text,
    -- FKs to users restrict (AD-7): user deletion purges owned lists first.
    owner_id   uuid        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    origin     text        NOT NULL,
    created_at timestamptz NOT NULL
);

-- Sole membership / invite record (AD-4). The owner holds an ACCEPTED row.
CREATE TABLE list_members
(
    list_id    uuid        NOT NULL REFERENCES lists (id) ON DELETE CASCADE,
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    status     text        NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED')),
    created_at timestamptz NOT NULL,
    PRIMARY KEY (list_id, user_id)
);

CREATE TABLE categories
(
    id      uuid PRIMARY KEY,
    name    text NOT NULL,
    list_id uuid NOT NULL REFERENCES lists (id) ON DELETE CASCADE,
    -- Target of items' composite FK: an item's category must belong to the item's list.
    UNIQUE (list_id, id)
);

CREATE TABLE items
(
    id          uuid PRIMARY KEY,
    name        text    NOT NULL,
    checked     boolean NOT NULL,
    category_id uuid    NOT NULL,
    list_id     uuid    NOT NULL REFERENCES lists (id) ON DELETE CASCADE,
    stores      text[]  NOT NULL DEFAULT '{}',
    recurring   text CHECK (recurring IN ('ONE_TIME', 'WEEKLY', 'BIWEEKLY', 'MONTHLY')),
    -- Plain text, no FK: survives the adder's deletion (AD-6).
    added_by    text,
    deleted     boolean NOT NULL DEFAULT false,
    deleted_at  timestamptz,
    checked_at  timestamptz,
    FOREIGN KEY (list_id, category_id) REFERENCES categories (list_id, id) ON DELETE CASCADE
);

CREATE TABLE feedback
(
    id         uuid PRIMARY KEY,
    text       text        NOT NULL,
    -- Plain copied string, no FK: feedback outlives its author (AD-6).
    username   text        NOT NULL,
    created_at timestamptz NOT NULL
);

CREATE TABLE refresh_tokens
(
    token      text PRIMARY KEY,
    username   text        NOT NULL,
    role       text        NOT NULL CHECK (role IN ('user', 'admin')),
    expires_at timestamptz NOT NULL
);

-- Singleton settings row; a missing row means the defaults and reads never write it (AD-6).
CREATE TABLE app_config
(
    id                   uuid PRIMARY KEY,
    registration_enabled boolean NOT NULL
);

-- AR-E11-15: exactly these indexes (users(username) is the UNIQUE constraint above).
CREATE INDEX items_list_id_idx ON items (list_id);
CREATE INDEX items_list_recurring_checked_at_idx ON items (list_id, recurring, checked_at);
CREATE INDEX items_deleted_deleted_at_idx ON items (deleted, deleted_at);
CREATE INDEX list_members_user_status_idx ON list_members (user_id, status);
CREATE INDEX refresh_tokens_expires_at_idx ON refresh_tokens (expires_at);
CREATE INDEX refresh_tokens_username_idx ON refresh_tokens (username);
