package sqlite

import (
	"context"
	"database/sql"

	"github.com/matheus-ferreira1/finapp/internal/domain"
)

func (s *Store) CreateRecurrence(ctx context.Context, r *domain.Recurrence) error {
	res, err := s.db.ExecContext(ctx, `
		INSERT INTO recurrences (day, description, type, category_id, estimated_amount_cents, split_rule_id, active)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		r.Day, r.Description, r.Type, r.CategoryID, r.EstimatedAmount, splitRuleID(r.SplitRule), r.Active)
	if err != nil {
		return mapErr(err)
	}
	r.ID, err = res.LastInsertId()
	return err
}

func (s *Store) UpdateRecurrence(ctx context.Context, r domain.Recurrence) error {
	res, err := s.db.ExecContext(ctx, `
		UPDATE recurrences
		SET day = ?, description = ?, type = ?, category_id = ?, estimated_amount_cents = ?, split_rule_id = ?, active = ?
		WHERE id = ?`,
		r.Day, r.Description, r.Type, r.CategoryID, r.EstimatedAmount, splitRuleID(r.SplitRule), r.Active, r.ID)
	if err != nil {
		return mapErr(err)
	}
	return requireAffected(res)
}

// DeleteRecurrence removes the recurrence; transactions it generated are kept, unlinked.
func (s *Store) DeleteRecurrence(ctx context.Context, id int64) error {
	res, err := s.db.ExecContext(ctx, `DELETE FROM recurrences WHERE id = ?`, id)
	if err != nil {
		return err
	}
	return requireAffected(res)
}

// ListRecurrences returns recurrences ordered by day of the month.
func (s *Store) ListRecurrences(ctx context.Context) ([]domain.Recurrence, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT r.id, r.day, r.description, r.type, r.category_id, r.estimated_amount_cents,
		       r.split_rule_id, sr.name, sr.my_percent, sr.archived, r.active
		FROM recurrences r
		LEFT JOIN split_rules sr ON sr.id = r.split_rule_id
		ORDER BY r.day, r.id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.Recurrence
	for rows.Next() {
		var (
			r            domain.Recurrence
			ruleID       sql.NullInt64
			ruleName     sql.NullString
			rulePercent  sql.NullInt64
			ruleArchived sql.NullBool
		)
		if err := rows.Scan(&r.ID, &r.Day, &r.Description, &r.Type, &r.CategoryID, &r.EstimatedAmount,
			&ruleID, &ruleName, &rulePercent, &ruleArchived, &r.Active); err != nil {
			return nil, err
		}
		if ruleID.Valid {
			r.SplitRule = &domain.SplitRule{ID: ruleID.Int64, Name: ruleName.String, MyPercent: int(rulePercent.Int64), Archived: ruleArchived.Bool}
		}
		out = append(out, r)
	}
	return out, rows.Err()
}
