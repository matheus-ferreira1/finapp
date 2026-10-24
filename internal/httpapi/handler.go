// Package httpapi exposes the JSON API and serves the embedded single-page app.
package httpapi

import (
	"encoding/json"
	"io/fs"
	"net/http"
	"strings"
)

// NewHandler returns the root handler: /api/* routes plus the SPA served from static.
func NewHandler(static fs.FS) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", health)
	mux.HandleFunc("/api/", http.NotFound)
	mux.Handle("/", spa(static))
	return mux
}

func health(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
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
