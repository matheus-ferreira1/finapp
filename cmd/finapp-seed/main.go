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

	_, statErr := os.Stat(*dbPath)
	existed := statErr == nil
	if statErr != nil && !errors.Is(statErr, os.ErrNotExist) {
		return statErr
	}
	if *force {
		if err := removeDatabase(*dbPath); err != nil {
			return err
		}
		existed = false
	}

	err := populate(*dbPath)
	switch {
	case errors.Is(err, seed.ErrNotEmpty):
		log.Printf("%s already has data, skipping (use --force to recreate it)", *dbPath)
		return nil
	case err != nil:
		if !existed { // never leave a half-seeded database behind, but keep one that was already there
			if rmErr := removeDatabase(*dbPath); rmErr != nil {
				err = errors.Join(err, rmErr)
			}
		}
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
