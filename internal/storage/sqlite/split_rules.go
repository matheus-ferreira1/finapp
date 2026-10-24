package sqlite

import (
	"context"
	"database/sql"

	"github.com/matheus-ferreira1/finapp/internal/domain"
)

func (s *Store) CreateSplitRule(ctx context.Context, r *domain.SplitRule) error {
	res, err := s.db.ExecContext(ctx,
		`INSERT INTO split_rules (name, my_percent, archived) VALUES (?, ?, ?)`, r.Name, r.MyPercent, r.Archived)
	if err != nil {
		return mapErr(err)
	}
	r.ID, err = res.LastInsertId()
	return err
}

// UpdateSplitRule renames or archives a rule. Its percent is frozen once any
// transaction or recurrence uses it, so history is never rewritten.
func (s *Store) UpdateSplitRule(ctx context.Context, r domain.SplitRule) error {
	var current int
	err := s.db.QueryRowContext(ctx, `SELECT my_percent FROM split_rules WHERE id = ?`, r.ID).Scan(&current)
	if err == sql.ErrNoRows {
		return domain.ErrNotFound
	}
	if err != nil {
		return err
	}

	if current != r.MyPercent {
		var used bool
		err := s.db.QueryRowContext(ctx,
			`SELECT EXISTS (SELECT 1 FROM transactions WHERE split_rule_id = ?1)
			     OR EXISTS (SELECT 1 FROM recurrences WHERE split_rule_id = ?1)`, r.ID).Scan(&used)
		if err != nil {
			return err
		}
		if used {
			return domain.ErrSplitRuleInUse
		}
	}

	res, err := s.db.ExecContext(ctx,
		`UPDATE split_rules SET name = ?, my_percent = ?, archived = ? WHERE id = ?`, r.Name, r.MyPercent, r.Archived, r.ID)
	if err != nil {
		return mapErr(err)
	}
	return requireAffected(res)
}

// ListSplitRules returns rules ordered by name; archived ones only when requested.
func (s *Store) ListSplitRules(ctx context.Context, includeArchived bool) ([]domain.SplitRule, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, name, my_percent, archived FROM split_rules WHERE archived = 0 OR ? ORDER BY name`, includeArchived)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }() // rows.Err() reports the failures that matter

	var out []domain.SplitRule
	for rows.Next() {
		var r domain.SplitRule
		if err := rows.Scan(&r.ID, &r.Name, &r.MyPercent, &r.Archived); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}
