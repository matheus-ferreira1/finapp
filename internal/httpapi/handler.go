// Package httpapi exposes the JSON API and serves the embedded single-page app.
package httpapi

import (
	"encoding/json"
	"io/fs"
	"net/http"
	"strings"

	"github.com/matheus-ferreira1/finapp/internal/app"
)

// NewHandler returns the root handler: /api/* routes plus the SPA served from static.
func NewHandler(svc *app.Service, static fs.FS) http.Handler {
	a := &api{svc: svc}
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/health", health)

	mux.HandleFunc("GET /api/categories", a.handle(a.listCategories))
	mux.HandleFunc("POST /api/categories", a.handle(a.createCategory))
	mux.HandleFunc("PUT /api/categories/{id}", a.handle(a.updateCategory))

	mux.HandleFunc("GET /api/split-rules", a.handle(a.listSplitRules))
	mux.HandleFunc("POST /api/split-rules", a.handle(a.createSplitRule))
	mux.HandleFunc("PUT /api/split-rules/{id}", a.handle(a.updateSplitRule))

	mux.HandleFunc("GET /api/transactions", a.handle(a.listTransactions))
	mux.HandleFunc("POST /api/transactions", a.handle(a.createTransaction))
	mux.HandleFunc("PUT /api/transactions/{id}", a.handle(a.updateTransaction))
	mux.HandleFunc("DELETE /api/transactions/{id}", a.handle(a.deleteTransaction))

	mux.HandleFunc("GET /api/recurrences", a.handle(a.listRecurrences))
	mux.HandleFunc("POST /api/recurrences", a.handle(a.createRecurrence))
	mux.HandleFunc("POST /api/recurrences/generate", a.handle(a.generateRecurrences))
	mux.HandleFunc("PUT /api/recurrences/{id}", a.handle(a.updateRecurrence))
	mux.HandleFunc("DELETE /api/recurrences/{id}", a.handle(a.deleteRecurrence))

	mux.HandleFunc("GET /api/reports/monthly", a.handle(a.monthlyReport))
	mux.HandleFunc("GET /api/reports/categories", a.handle(a.categoryReport))

	mux.HandleFunc("GET /api/settings", a.handle(a.getSettings))
	mux.HandleFunc("PUT /api/settings", a.handle(a.updateSettings))

	mux.HandleFunc("/api/", http.NotFound)
	mux.Handle("/", spa(static))
	return mux
}

func health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// spa serves files from static and falls back to index.html for unknown paths,
// so client-side routes survive a page reload.
func spa(static fs.FS) http.Handler {
	files := http.FileServerFS(static)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(r.URL.Path, "/")
		if name == "" {
			files.ServeHTTP(w, r)
			return
		}
		if _, err := fs.Stat(static, name); err != nil {
			r.URL.Path = "/"
		}
		files.ServeHTTP(w, r)
	})
}
