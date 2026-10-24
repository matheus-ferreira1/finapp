package sqlite

import (
	"context"

	"github.com/matheus-ferreira1/finapp/internal/domain"
)

func (s *Store) CreateCategory(ctx context.Context, c *domain.Category) error {
	res, err := s.db.ExecContext(ctx,
		`INSERT INTO categories (name, kind, archived) VALUES (?, ?, ?)`, c.Name, c.Kind, c.Archived)
	if err != nil {
		return mapErr(err)
	}
	c.ID, err = res.LastInsertId()
	return err
}

func (s *Store) UpdateCategory(ctx context.Context, c domain.Category) error {
	res, err := s.db.ExecContext(ctx,
		`UPDATE categories SET name = ?, kind = ?, archived = ? WHERE id = ?`, c.Name, c.Kind, c.Archived, c.ID)
	if err != nil {
		return mapErr(err)
	}
	return requireAffected(res)
}

// ListCategories returns categories ordered by name; archived ones only when requested.
func (s *Store) ListCategories(ctx context.Context, includeArchived bool) ([]domain.Category, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, name, kind, archived FROM categories WHERE archived = 0 OR ? ORDER BY name, kind`, includeArchived)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }() // rows.Err() reports the failures that matter

	var out []domain.Category
	for rows.Next() {
		var c domain.Category
		if err := rows.Scan(&c.ID, &c.Name, &c.Kind, &c.Archived); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}
