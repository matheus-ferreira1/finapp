package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/matheus-ferreira1/finapp/internal/domain"
)

const dateLayout = "2006-01-02"

const selectTransactions = `
SELECT t.id, t.date, t.description, t.type, t.category_id, t.amount_cents,
       t.split_rule_id, sr.name, sr.my_percent, sr.archived,
       t.installment_number, t.installment_total, t.confirmed,
       t.recurrence_id, t.recurrence_month
FROM transactions t
LEFT JOIN split_rules sr ON sr.id = t.split_rule_id`

func (s *Store) CreateTransaction(ctx context.Context, tx *domain.Transaction) error {
	var recurrenceID sql.NullInt64
	var recurrenceMonth sql.NullString
	if tx.Recurrence != nil {
		recurrenceID = sql.NullInt64{Int64: tx.Recurrence.ID, Valid: true}
		recurrenceMonth = sql.NullString{String: tx.Recurrence.Month.String(), Valid: true}
	}

	res, err := s.db.ExecContext(ctx, `
		INSERT INTO transactions (date, description, type, category_id, amount_cents, split_rule_id,
		                          installment_number, installment_total, confirmed, recurrence_id, recurrence_month)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		tx.Date.Format(dateLayout), tx.Description, tx.Type, nullInt(tx.CategoryID), tx.Amount, splitRuleID(tx.SplitRule),
		nullInt(tx.InstallmentNumber), nullInt(tx.InstallmentTotal), tx.Confirmed, recurrenceID, recurrenceMonth)
	if err != nil {
		return mapErr(err)
	}
	tx.ID, err = res.LastInsertId()
	return err
}

// UpdateTransaction rewrites the editable fields. The link to a recurrence is never changed.
func (s *Store) UpdateTransaction(ctx context.Context, tx domain.Transaction) error {
	res, err := s.db.ExecContext(ctx, `
		UPDATE transactions
		SET date = ?, description = ?, type = ?, category_id = ?, amount_cents = ?, split_rule_id = ?,
		    installment_number = ?, installment_total = ?, confirmed = ?, updated_at = datetime('now')
		WHERE id = ?`,
		tx.Date.Format(dateLayout), tx.Description, tx.Type, nullInt(tx.CategoryID), tx.Amount, splitRuleID(tx.SplitRule),
		nullInt(tx.InstallmentNumber), nullInt(tx.InstallmentTotal), tx.Confirmed, tx.ID)
	if err != nil {
		return mapErr(err)
	}
	return requireAffected(res)
}

func (s *Store) DeleteTransaction(ctx context.Context, id int64) error {
	res, err := s.db.ExecContext(ctx, `DELETE FROM transactions WHERE id = ?`, id)
	if err != nil {
		return err
	}
	return requireAffected(res)
}

func (s *Store) GetTransaction(ctx context.Context, id int64) (domain.Transaction, error) {
	txs, err := s.queryTransactions(ctx, `WHERE t.id = ?`, id)
	if err != nil {
		return domain.Transaction{}, err
	}
	if len(txs) == 0 {
		return domain.Transaction{}, domain.ErrNotFound
	}
	return txs[0], nil
}

// ListTransactions returns every transaction ordered by date.
func (s *Store) ListTransactions(ctx context.Context) ([]domain.Transaction, error) {
	return s.queryTransactions(ctx, ``)
}

// ListTransactionsByMonth returns the transactions dated within the month.
func (s *Store) ListTransactionsByMonth(ctx context.Context, ym domain.YearMonth) ([]domain.Transaction, error) {
	first := time.Date(ym.Year, ym.Month, 1, 0, 0, 0, 0, time.UTC)
	next := first.AddDate(0, 1, 0)
	return s.queryTransactions(ctx, `WHERE t.date >= ? AND t.date < ?`, first.Format(dateLayout), next.Format(dateLayout))
}

// ListGeneratedFor returns the transactions generated from recurrences for the
// month, wherever their date was moved to since.
func (s *Store) ListGeneratedFor(ctx context.Context, ym domain.YearMonth) ([]domain.Transaction, error) {
	return s.queryTransactions(ctx, `WHERE t.recurrence_id IS NOT NULL AND t.recurrence_month = ?`, ym.String())
}

func (s *Store) queryTransactions(ctx context.Context, where string, args ...any) ([]domain.Transaction, error) {
	rows, err := s.db.QueryContext(ctx, selectTransactions+" "+where+" ORDER BY t.date, t.id", args...)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }() // rows.Err() reports the failures that matter

	var out []domain.Transaction
	for rows.Next() {
		tx, err := scanTransaction(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, tx)
	}
	return out, rows.Err()
}

func scanTransaction(rows *sql.Rows) (domain.Transaction, error) {
	var (
		tx                    domain.Transaction
		date                  string
		categoryID, ruleID    sql.NullInt64
		ruleName              sql.NullString
		rulePercent           sql.NullInt64
		ruleArchived          sql.NullBool
		instNumber, instTotal sql.NullInt64
		recurrenceID          sql.NullInt64
		recurrenceMonth       sql.NullString
	)
	err := rows.Scan(&tx.ID, &date, &tx.Description, &tx.Type, &categoryID, &tx.Amount,
		&ruleID, &ruleName, &rulePercent, &ruleArchived, &instNumber, &instTotal, &tx.Confirmed,
		&recurrenceID, &recurrenceMonth)
	if err != nil {
		return tx, err
	}

	if tx.Date, err = time.Parse(dateLayout, date); err != nil {
		return tx, err
	}
	tx.CategoryID = ptrInt[int64](categoryID)
	tx.InstallmentNumber = ptrInt[int](instNumber)
	tx.InstallmentTotal = ptrInt[int](instTotal)
	if ruleID.Valid {
		tx.SplitRule = &domain.SplitRule{ID: ruleID.Int64, Name: ruleName.String, MyPercent: int(rulePercent.Int64), Archived: ruleArchived.Bool}
	}
	if recurrenceID.Valid {
		month, err := domain.ParseYearMonth(recurrenceMonth.String)
		if err != nil {
			return tx, errors.Join(errors.New("corrupt recurrence_month"), err)
		}
		tx.Recurrence = &domain.RecurrenceRef{ID: recurrenceID.Int64, Month: month}
	}
	return tx, nil
}

func splitRuleID(r *domain.SplitRule) sql.NullInt64 {
	if r == nil {
		return sql.NullInt64{}
	}
	return sql.NullInt64{Int64: r.ID, Valid: true}
}
