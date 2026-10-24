// Package sqlite persists finapp data in a single SQLite file.
package sqlite

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"net/url"
	"path/filepath"

	"github.com/pressly/goose/v3"
	"modernc.org/sqlite" // registers the pure-Go "sqlite" driver
	sqlite3 "modernc.org/sqlite/lib"

	"github.com/matheus-ferreira1/finapp/internal/domain"
)

//go:embed migrations/*.sql
var migrations embed.FS

// Store gives access to the database through domain types.
type Store struct {
	db *sql.DB
}

// Open opens (creating it if needed) the database at path and applies pending migrations.
func Open(path string) (*Store, error) {
	db, err := sql.Open("sqlite", dsn(path))
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}
	if err := db.PingContext(context.Background()); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("open database %s: %w", path, err)
	}
	if err := migrate(db); err != nil {
		_ = db.Close()
		return nil, err
	}
	return &Store{db: db}, nil
}

func (s *Store) Close() error { return s.db.Close() }

func dsn(path string) string {
	u := url.URL{Path: filepath.ToSlash(path)}
	return "file:" + u.EscapedPath() +
		"?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)"
}

func migrate(db *sql.DB) error {
	fsys, err := fs.Sub(migrations, "migrations")
	if err != nil {
		return fmt.Errorf("load migrations: %w", err)
	}
	provider, err := goose.NewProvider(goose.DialectSQLite3, db, fsys)
	if err != nil {
		return fmt.Errorf("create migration provider: %w", err)
	}
	if _, err := provider.Up(context.Background()); err != nil {
		return fmt.Errorf("apply migrations: %w", err)
	}
	return nil
}

// mapErr translates driver errors into domain errors.
func mapErr(err error) error {
	var se *sqlite.Error
	if errors.As(err, &se) && se.Code() == sqlite3.SQLITE_CONSTRAINT_UNIQUE {
		return domain.ErrDuplicate
	}
	return err
}

// requireAffected turns an update/delete that touched no row into ErrNotFound.
func requireAffected(res sql.Result) error {
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return domain.ErrNotFound
	}
	return nil
}

// nullInt converts an optional int64 for SQL parameters.
func nullInt[T ~int | ~int64](v *T) sql.NullInt64 {
	if v == nil {
		return sql.NullInt64{}
	}
	return sql.NullInt64{Int64: int64(*v), Valid: true}
}

func ptrInt[T ~int | ~int64](n sql.NullInt64) *T {
	if !n.Valid {
		return nil
	}
	v := T(n.Int64)
	return &v
}
