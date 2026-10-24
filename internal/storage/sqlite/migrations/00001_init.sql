-- +goose Up
CREATE TABLE categories (
    id       INTEGER PRIMARY KEY,
    name     TEXT    NOT NULL CHECK (trim(name) <> ''),
    kind     TEXT    NOT NULL CHECK (kind IN ('income', 'expense')),
    archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
    UNIQUE (name, kind)
);

CREATE TABLE split_rules (
    id         INTEGER PRIMARY KEY,
    name       TEXT    NOT NULL UNIQUE CHECK (trim(name) <> ''),
    my_percent INTEGER NOT NULL CHECK (my_percent BETWEEN 0 AND 100),
    archived   INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1))
);

CREATE TABLE recurrences (
    id                     INTEGER PRIMARY KEY,
    day                    INTEGER NOT NULL CHECK (day BETWEEN 1 AND 31),
    description            TEXT    NOT NULL CHECK (trim(description) <> ''),
    type                   TEXT    NOT NULL CHECK (type IN ('income', 'expense')),
    category_id            INTEGER NOT NULL REFERENCES categories (id),
    estimated_amount_cents INTEGER NOT NULL CHECK (estimated_amount_cents > 0),
    split_rule_id          INTEGER REFERENCES split_rules (id),
    active                 INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    CHECK (split_rule_id IS NULL OR type = 'expense')
);

CREATE TABLE transactions (
    id                 INTEGER PRIMARY KEY,
    date               TEXT    NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
    description        TEXT    NOT NULL DEFAULT '',
    type               TEXT    NOT NULL CHECK (type IN ('income', 'expense', 'settlement')),
    category_id        INTEGER REFERENCES categories (id),
    amount_cents       INTEGER NOT NULL CHECK (amount_cents > 0),
    split_rule_id      INTEGER REFERENCES split_rules (id),
    installment_number INTEGER,
    installment_total  INTEGER,
    confirmed          INTEGER NOT NULL DEFAULT 0 CHECK (confirmed IN (0, 1)),
    recurrence_id      INTEGER REFERENCES recurrences (id) ON DELETE SET NULL,
    recurrence_month   TEXT CHECK (recurrence_month IS NULL OR recurrence_month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
    created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at         TEXT    NOT NULL DEFAULT (datetime('now')),
    CHECK (
        (type = 'settlement' AND category_id IS NULL AND split_rule_id IS NULL)
        OR (type <> 'settlement' AND category_id IS NOT NULL)
    ),
    CHECK (split_rule_id IS NULL OR type = 'expense'),
    CHECK (
        (installment_number IS NULL AND installment_total IS NULL)
        OR (installment_number >= 1 AND installment_total IS NOT NULL AND installment_number <= installment_total)
    )
);

CREATE INDEX transactions_date_idx ON transactions (date);

-- A recurrence generates at most one transaction per month.
CREATE UNIQUE INDEX transactions_recurrence_month_uq
    ON transactions (recurrence_id, recurrence_month)
    WHERE recurrence_id IS NOT NULL;

CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

INSERT INTO settings (key, value) VALUES
    ('partner_name', ''),
    ('currency', 'BRL'),
    ('locale', 'pt-BR');

-- +goose Down
DROP TABLE settings;
DROP INDEX transactions_recurrence_month_uq;
DROP INDEX transactions_date_idx;
DROP TABLE transactions;
DROP TABLE recurrences;
DROP TABLE split_rules;
DROP TABLE categories;
