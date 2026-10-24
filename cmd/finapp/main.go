package main

import (
	"flag"
	"log"
	"net/http"

	"github.com/matheus-ferreira1/finapp/internal/app"
	"github.com/matheus-ferreira1/finapp/internal/httpapi"
	"github.com/matheus-ferreira1/finapp/internal/storage/sqlite"
	"github.com/matheus-ferreira1/finapp/web"
)

func main() {
	addr := flag.String("addr", "127.0.0.1:8080", "address to listen on")
	dbPath := flag.String("db", "finapp.db", "path to the SQLite database file")
	flag.Parse()

	store, err := sqlite.Open(*dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer store.Close()

	log.Printf("finapp listening on http://%s (database: %s)", *addr, *dbPath)
	log.Fatal(http.ListenAndServe(*addr, httpapi.NewHandler(app.New(store), web.Dist())))
}
