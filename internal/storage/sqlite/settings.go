package sqlite

import "context"

// Settings returns every setting as key/value.
func (s *Store) Settings(ctx context.Context) (map[string]string, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT key, value FROM settings`)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }() // rows.Err() reports the failures that matter

	out := make(map[string]string)
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return nil, err
		}
		out[k] = v
	}
	return out, rows.Err()
}

// SetSetting changes an existing setting; unknown keys are rejected.
func (s *Store) SetSetting(ctx context.Context, key, value string) error {
	res, err := s.db.ExecContext(ctx, `UPDATE settings SET value = ? WHERE key = ?`, value, key)
	if err != nil {
		return err
	}
	return requireAffected(res)
}
