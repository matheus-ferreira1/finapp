package launch

import (
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func TestResolveDBPath(t *testing.T) {
	dir := t.TempDir()
	exe := filepath.Join(dir, "bin", "finapp")
	link := filepath.Join(dir, "finapp-link")
	mustMkdir(t, filepath.Dir(exe))
	mustWrite(t, exe)
	if err := os.Symlink(exe, link); err != nil {
		t.Skip("symlinks not supported:", err)
	}
	// the temp dir itself may be behind a symlink (macOS), so compare resolved paths
	realBin, _ := filepath.EvalSymlinks(filepath.Dir(exe))

	tests := []struct {
		name, flag, env, executable, want string
	}{
		{"flag wins over env", "/a/flag.db", "/a/env.db", exe, "/a/flag.db"},
		{"env wins over default", "", "/a/env.db", exe, "/a/env.db"},
		{"defaults next to the executable", "", "", exe, filepath.Join(realBin, "finapp.db")},
		{"follows a symlinked executable", "", "", link, filepath.Join(realBin, "finapp.db")},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ResolveDBPath(tt.flag, tt.env, tt.executable)
			if err != nil {
				t.Fatal(err)
			}
			if got != tt.want {
				t.Errorf("got %q, want %q", got, tt.want)
			}
		})
	}
}

func TestEnsureWritable(t *testing.T) {
	t.Run("accepts a writable directory and leaves nothing behind", func(t *testing.T) {
		dir := t.TempDir()
		if err := EnsureWritable(filepath.Join(dir, "finapp.db")); err != nil {
			t.Fatal(err)
		}
		entries, _ := os.ReadDir(dir)
		if len(entries) != 0 {
			t.Errorf("left %d files behind", len(entries))
		}
	})

	t.Run("rejects a read-only directory and suggests --db", func(t *testing.T) {
		if os.Geteuid() == 0 {
			t.Skip("root ignores directory permissions")
		}
		dir := t.TempDir()
		if err := os.Chmod(dir, 0o500); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { _ = os.Chmod(dir, 0o700) })

		err := EnsureWritable(filepath.Join(dir, "finapp.db"))
		if err == nil || !strings.Contains(err.Error(), "--db") || !strings.Contains(err.Error(), dir) {
			t.Errorf("got %v, want an error naming the directory and suggesting --db", err)
		}
	})

	t.Run("rejects a missing directory", func(t *testing.T) {
		if err := EnsureWritable(filepath.Join(t.TempDir(), "nope", "finapp.db")); err == nil {
			t.Error("want an error")
		}
	})
}

func TestIsFinapp(t *testing.T) {
	tests := []struct {
		name    string
		handler http.HandlerFunc
		want    bool
	}{
		{"finapp", func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte(`{"app":"finapp","status":"ok"}`)) }, true},
		{"another json service", func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte(`{"status":"ok"}`)) }, false},
		{"not json", func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte(`<html>`)) }, false},
		{"not found", http.NotFound, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			srv := httptest.NewServer(tt.handler)
			defer srv.Close()
			if got := IsFinapp(strings.TrimPrefix(srv.URL, "http://")); got != tt.want {
				t.Errorf("got %v, want %v", got, tt.want)
			}
		})
	}

	t.Run("nothing listening", func(t *testing.T) {
		l := mustListen(t, "127.0.0.1:0")
		addr := l.Addr().String()
		_ = l.Close()
		if IsFinapp(addr) {
			t.Error("want false")
		}
	})
}

func TestListen(t *testing.T) {
	finapp := func() *httptest.Server {
		return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			_, _ = w.Write([]byte(`{"app":"finapp"}`))
		}))
	}
	other := func() net.Listener { return mustListen(t, "127.0.0.1:0") }

	t.Run("binds a free port", func(t *testing.T) {
		l, running, err := Listen("127.0.0.1:0", true)
		if err != nil || running {
			t.Fatalf("got running=%v err=%v", running, err)
		}
		_ = l.Close()
	})

	t.Run("reports another finapp on the port", func(t *testing.T) {
		srv := finapp()
		defer srv.Close()
		l, running, err := Listen(strings.TrimPrefix(srv.URL, "http://"), false)
		if err != nil || !running || l != nil {
			t.Fatalf("got listener=%v running=%v err=%v", l, running, err)
		}
	})

	t.Run("falls back to a free port when the default is taken by something else", func(t *testing.T) {
		busy := other()
		defer func() { _ = busy.Close() }()
		l, running, err := Listen(busy.Addr().String(), false)
		if err != nil || running {
			t.Fatalf("got running=%v err=%v", running, err)
		}
		defer func() { _ = l.Close() }()
		if l.Addr().String() == busy.Addr().String() {
			t.Error("reused the busy port")
		}
	})

	t.Run("fails when an explicit port is taken by something else", func(t *testing.T) {
		busy := other()
		defer func() { _ = busy.Close() }()
		if _, _, err := Listen(busy.Addr().String(), true); err == nil {
			t.Error("want an error")
		}
	})
}

func TestBrowserCommand(t *testing.T) {
	tests := []struct {
		goos string
		name string
		args []string
	}{
		{"darwin", "open", []string{"http://x"}},
		{"linux", "xdg-open", []string{"http://x"}},
		{"windows", "rundll32", []string{"url.dll,FileProtocolHandler", "http://x"}},
	}
	for _, tt := range tests {
		t.Run(tt.goos, func(t *testing.T) {
			name, args := browserCommand(tt.goos, "http://x")
			if name != tt.name || !reflect.DeepEqual(args, tt.args) {
				t.Errorf("got %s %v", name, args)
			}
		})
	}
}

func mustListen(t *testing.T, addr string) net.Listener {
	t.Helper()
	l, err := net.Listen("tcp", addr)
	if err != nil {
		t.Fatal(err)
	}
	return l
}

func mustMkdir(t *testing.T, dir string) {
	t.Helper()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
}

func mustWrite(t *testing.T, path string) {
	t.Helper()
	if err := os.WriteFile(path, []byte("x"), 0o755); err != nil {
		t.Fatal(err)
	}
}
