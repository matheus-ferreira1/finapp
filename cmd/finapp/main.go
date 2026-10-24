package main

import (
	"flag"
	"log"
	"net/http"

	"github.com/matheus-ferreira1/finapp/internal/httpapi"
	"github.com/matheus-ferreira1/finapp/web"
)

func main() {
	addr := flag.String("addr", "127.0.0.1:8080", "address to listen on")
	flag.Parse()

	log.Printf("finapp listening on http://%s", *addr)
	log.Fatal(http.ListenAndServe(*addr, httpapi.NewHandler(web.Dist())))
}
