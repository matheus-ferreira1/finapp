package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/matheus-ferreira1/finapp/internal/app"
	"github.com/matheus-ferreira1/finapp/internal/httpapi"
	"github.com/matheus-ferreira1/finapp/internal/launch"
	"github.com/matheus-ferreira1/finapp/internal/storage/sqlite"
	"github.com/matheus-ferreira1/finapp/web"
)

const defaultAddr = "127.0.0.1:8080"

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	addr := flag.String("addr", defaultAddr, "address to listen on")
	dbPath := flag.String("db", "", "path to the SQLite database file (default: finapp.db next to the executable, or $FINAPP_DB)")
	noBrowser := flag.Bool("no-browser", false, "do not open the browser on start")
	flag.Parse()

	explicitAddr := false
	flag.Visit(func(f *flag.Flag) { explicitAddr = explicitAddr || f.Name == "addr" })

	listener, running, err := launch.Listen(*addr, explicitAddr)
	if err != nil {
		return fmt.Errorf("listen on %s: %w", *addr, err)
	}
	if running {
		log.Printf("finapp is already running on http://%s", *addr)
		openBrowser("http://"+*addr, *noBrowser)
		return nil
	}
	defer func() { _ = listener.Close() }()

	executable, err := os.Executable()
	if err != nil {
		return fmt.Errorf("locate the executable: %w", err)
	}
	path, err := launch.ResolveDBPath(*dbPath, os.Getenv("FINAPP_DB"), executable)
	if err != nil {
		return err
	}
	if err := launch.EnsureWritable(path); err != nil {
		return err
	}
	store, err := sqlite.Open(path)
	if err != nil {
		return err
	}
	defer func() { _ = store.Close() }()

	url := "http://" + listener.Addr().String()
	log.Printf("finapp listening on %s (database: %s)", url, path)
	openBrowser(url, *noBrowser)
	return http.Serve(listener, httpapi.NewHandler(app.New(store), web.Dist()))
}

func openBrowser(url string, disabled bool) {
	if disabled {
		return
	}
	if err := launch.OpenBrowser(url); err != nil {
		log.Printf("could not open the browser, open %s yourself: %v", url, err)
	}
}
