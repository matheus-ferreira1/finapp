package httpapi_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/matheus-ferreira1/finapp/internal/app"
	"github.com/matheus-ferreira1/finapp/internal/httpapi"
	"github.com/matheus-ferreira1/finapp/internal/storage/sqlite"
)

// client calls the real handler (service + SQLite file) in-process.
type client struct {
	t     *testing.T
	h     http.Handler
	store *sqlite.Store
}

func newClient(t *testing.T) *client {
	t.Helper()
	store, err := sqlite.Open(filepath.Join(t.TempDir(), "finapp.db"))
	if err != nil {
		t.Fatalf("sqlite.Open() error = %v", err)
	}
	t.Cleanup(func() { _ = store.Close() })

	static := fstest.MapFS{
		"index.html":    {Data: []byte("<html>spa</html>")},
		"assets/app.js": {Data: []byte("console.log('app')")},
	}
	return &client{t: t, h: httpapi.NewHandler(app.New(store), static), store: store}
}

// do sends the request and decodes the JSON response body (nil when empty).
func (c *client) do(method, path string, body any) (int, any) {
	c.t.Helper()
	var reader *bytes.Reader
	switch b := body.(type) {
	case nil:
		reader = bytes.NewReader(nil)
	case string:
		reader = bytes.NewReader([]byte(b))
	default:
		raw, err := json.Marshal(b)
		if err != nil {
			c.t.Fatal(err)
		}
		reader = bytes.NewReader(raw)
	}

	rec := httptest.NewRecorder()
	c.h.ServeHTTP(rec, httptest.NewRequest(method, path, reader))

	var out any
	if rec.Body.Len() > 0 && strings.HasPrefix(rec.Header().Get("Content-Type"), "application/json") {
		if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
			c.t.Fatalf("%s %s: invalid JSON %q: %v", method, path, rec.Body.String(), err)
		}
	}
	return rec.Code, out
}

type obj = map[string]any

func asObj(t *testing.T, v any) obj {
	t.Helper()
	o, ok := v.(obj)
	if !ok {
		t.Fatalf("got %T (%v), want a JSON object", v, v)
	}
	return o
}

func asList(t *testing.T, v any) []any {
	t.Helper()
	l, ok := v.([]any)
	if !ok {
		t.Fatalf("got %T (%v), want a JSON array", v, v)
	}
	return l
}

func TestStaticAndHealth(t *testing.T) {
	c := newClient(t)

	tests := []struct {
		name         string
		path         string
		wantStatus   int
		wantContains string
	}{
		{"health check", "/api/health", http.StatusOK, `"status":"ok"`},
		{"health check names the app", "/api/health", http.StatusOK, `"app":"finapp"`},
		{"unknown api route", "/api/nope", http.StatusNotFound, ""},
		{"static asset", "/assets/app.js", http.StatusOK, "console.log"},
		{"root serves index", "/", http.StatusOK, "spa"},
		{"client route falls back to index", "/lancamentos", http.StatusOK, "spa"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			c.h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, tt.path, nil))

			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d", rec.Code, tt.wantStatus)
			}
			if !strings.Contains(rec.Body.String(), tt.wantContains) {
				t.Fatalf("body = %q, want it to contain %q", rec.Body.String(), tt.wantContains)
			}
		})
	}
}
