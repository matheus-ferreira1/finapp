package httpapi_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/matheus-ferreira1/finapp/internal/httpapi"
)

func newTestHandler() http.Handler {
	static := fstest.MapFS{
		"index.html":    {Data: []byte("<html>spa</html>")},
		"assets/app.js": {Data: []byte("console.log('app')")},
	}
	return httpapi.NewHandler(static)
}

func TestHandler(t *testing.T) {
	tests := []struct {
		name         string
		path         string
		wantStatus   int
		wantContains string
	}{
		{"health check", "/api/health", http.StatusOK, `"status":"ok"`},
		{"unknown api route", "/api/nope", http.StatusNotFound, ""},
		{"static asset", "/assets/app.js", http.StatusOK, "console.log"},
		{"root serves index", "/", http.StatusOK, "spa"},
		{"client route falls back to index", "/lancamentos", http.StatusOK, "spa"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, tt.path, nil)

			newTestHandler().ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d", rec.Code, tt.wantStatus)
			}
			if !strings.Contains(rec.Body.String(), tt.wantContains) {
				t.Fatalf("body = %q, want it to contain %q", rec.Body.String(), tt.wantContains)
			}
		})
	}
}
