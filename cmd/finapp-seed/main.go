// Command finapp-seed creates a database populated with sample data, for local development.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/matheus-ferreira1/finapp/internal/app"
	"github.com/matheus-ferreira1/finapp/internal/seed"
	"github.com/matheus-ferreira1/finapp/internal/storage/sqlite"
)

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	dbPath := flag.String("db", "dev.db", "path to the SQLite database file")
	force := flag.Bool("force", false, "delete the database first and recreate it")
	flag.Parse()

	if *force {
		if err := removeDatabase(*dbPath); err != nil {
			return err
		}
	} else if _, err := os.Stat(*dbPath); err == nil {
		log.Printf("%s already exists, skipping (use --force to recreate it)", *dbPath)
		return nil
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}

	if err := populate(*dbPath); err != nil {
		_ = removeDatabase(*dbPath) // never leave a half-seeded database behind
		return err
	}
	log.Printf("seeded %s", *dbPath)
	return nil
}

func populate(path string) error {
	store, err := sqlite.Open(path)
	if err != nil {
		return err
	}
	defer func() { _ = store.Close() }()
	return seed.Run(context.Background(), app.New(store), time.Now())
}

// removeDatabase deletes the database file and its SQLite sidecar files.
func removeDatabase(path string) error {
	for _, suffix := range []string{"", "-wal", "-shm", "-journal"} {
		if err := os.Remove(path + suffix); err != nil && !errors.Is(err, os.ErrNotExist) {
			return fmt.Errorf("remove %s: %w", path+suffix, err)
		}
	}
	return nil
}
