# Database schema

finapp stores everything in a single SQLite file (`finapp.db`). The schema is created
by the migrations in [`internal/storage/sqlite/migrations`](../internal/storage/sqlite/migrations)
when the app starts, so the simplest way to import data is:

1. Start finapp once so it creates the database, then stop it.
2. Run your SQL with `sqlite3 finapp.db < import.sql`.

Always enable foreign keys in your import session (`PRAGMA foreign_keys = ON;`), otherwise
SQLite will not check references. The database rejects rows that break the rules below.

## Conventions

- **Money** is an integer number of cents, always positive. `R$ 1.234,56` is `123456`.
  The `type` column gives the direction.
- **Dates** are `YYYY-MM-DD` text. **Months** (`recurrence_month`) are `YYYY-MM` text.
- **Booleans** are `0` or `1`.
- Primary keys are `INTEGER PRIMARY KEY`: omit them on insert and SQLite assigns one.

`my` and `shared` amounts are not stored. They are computed from `amount_cents` and the split rule.

## `categories`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer | |
| `name` | text | not blank |
| `kind` | text | `income` or `expense` |
| `archived` | integer | default `0` |

`(name, kind)` is unique. Settlements have no category.

## `split_rules`

How a shared expense is divided. `my_percent = 50` is "50/50"; `30` is "30/70" (your part first).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer | |
| `name` | text | unique, not blank |
| `my_percent` | integer | `0` to `100` |
| `archived` | integer | default `0` |

An expense without a split rule is entirely yours. The app does not let you change the percent of a
rule already in use: archive it and create a new one.

## `transactions`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer | |
| `date` | text | `YYYY-MM-DD` |
| `description` | text | default empty |
| `type` | text | `income`, `expense` or `settlement` (money received from your partner for shared expenses) |
| `category_id` | integer | required for `income` and `expense`, must be `NULL` for `settlement` |
| `amount_cents` | integer | greater than zero |
| `split_rule_id` | integer | only for `expense`; `NULL` means the expense is only yours |
| `installment_number` | integer | with `installment_total`, both or neither; `1 <= number <= total` |
| `installment_total` | integer | e.g. `number = 2`, `total = 12` is "2/12" |
| `confirmed` | integer | `1` once it really happened, default `0` |
| `recurrence_id` | integer | set when generated from a recurrence |
| `recurrence_month` | text | `YYYY-MM` the recurrence was generated for |
| `created_at`, `updated_at` | text | default to the current time |

A recurrence generates at most one transaction per `recurrence_month`. When importing history,
leave `recurrence_id` and `recurrence_month` as `NULL`.

The database does not check that `type` matches the category's `kind`; keep income transactions on
income categories and expenses on expense categories.

## `recurrences`

Income and expenses that happen every month.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer | |
| `day` | integer | `1` to `31`; short months use their last day |
| `description` | text | not blank |
| `type` | text | `income` or `expense` |
| `category_id` | integer | required |
| `estimated_amount_cents` | integer | greater than zero |
| `split_rule_id` | integer | only for `expense` |
| `active` | integer | default `1`; inactive recurrences are not generated |

## `settings`

Key/value pairs seeded with defaults: `partner_name` (empty), `currency` (`BRL`), `locale` (`pt-BR`).

## Import example

```sql
PRAGMA foreign_keys = ON;
BEGIN;

INSERT INTO categories (name, kind) VALUES ('Salary', 'income'), ('Housing', 'expense');
INSERT INTO split_rules (name, my_percent) VALUES ('50/50', 50);

-- Salary, confirmed
INSERT INTO transactions (date, description, type, category_id, amount_cents, confirmed)
SELECT '2026-01-05', 'Salary', 'income', id, 500000, 1 FROM categories WHERE name = 'Salary' AND kind = 'income';

-- Shared expense, installment 2/12
INSERT INTO transactions (date, description, type, category_id, amount_cents, split_rule_id,
                          installment_number, installment_total, confirmed)
SELECT '2026-01-10', 'Rent', 'expense', c.id, 150000, r.id, 2, 12, 1
FROM categories c, split_rules r WHERE c.name = 'Housing' AND r.name = '50/50';

-- Money received from your partner
INSERT INTO transactions (date, description, type, amount_cents, confirmed)
VALUES ('2026-01-20', 'Partner settlement', 'settlement', 75000, 1);

COMMIT;
```
