-- Tambah tabel push_subscriptions untuk DB app yang sudah ada.
-- Jalankan: psql -h localhost -p 5434 -U postgres -d screenhouse_app -f database/app/push_subscriptions.sql

BEGIN;

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint    TEXT NOT NULL,
    p256dh      TEXT NOT NULL,
    auth        TEXT NOT NULL,
    user_agent  TEXT,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id);

COMMIT;
