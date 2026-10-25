// Package launch holds what the finapp executable does around the server:
// locating the database, claiming a port and opening the browser.
package launch

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"

	"github.com/matheus-ferreira1/finapp/internal/httpapi"
)

const dbFileName = "finapp.db"

// ResolveDBPath picks the database file: the flag, then the environment, then
// finapp.db next to the executable (symlinks resolved, so a link to the binary
// does not scatter databases).
func ResolveDBPath(flagValue, envValue, executable string) (string, error) {
	if flagValue != "" {
		return flagValue, nil
	}
	if envValue != "" {
		return envValue, nil
	}
	resolved, err := filepath.EvalSymlinks(executable)
	if err != nil {
		return "", fmt.Errorf("locate the executable: %w", err)
	}
	return filepath.Join(filepath.Dir(resolved), dbFileName), nil
}

// EnsureWritable fails with a message pointing at --db when the database
// directory cannot be written to, instead of falling back somewhere else.
func EnsureWritable(dbPath string) error {
	dir := filepath.Dir(dbPath)
	probe, err := os.CreateTemp(dir, ".finapp-write-check-*")
	if err != nil {
		return fmt.Errorf("cannot write to %s: %w (choose another location with --db or FINAPP_DB)", dir, err)
	}
	_ = probe.Close()
	return os.Remove(probe.Name())
}

// IsFinapp reports whether a finapp server is answering on addr.
func IsFinapp(addr string) bool {
	client := http.Client{Timeout: time.Second}
	resp, err := client.Get("http://" + addr + "/api/health")
	if err != nil {
		return false
	}
	defer func() { _ = resp.Body.Close() }()
	var body struct {
		App string `json:"app"`
	}
	return resp.StatusCode == http.StatusOK && json.NewDecoder(resp.Body).Decode(&body) == nil && body.App == httpapi.AppName
}

// Listen claims addr. When another finapp already holds it, it returns a nil
// listener and running=true. When something else holds it, an address that was
// not asked for explicitly falls back to a free port; one that was is an error.
func Listen(addr string, explicit bool) (l net.Listener, running bool, err error) {
	l, err = net.Listen("tcp", addr)
	if err == nil {
		return l, false, nil
	}
	if IsFinapp(addr) {
		return nil, true, nil
	}
	if explicit {
		return nil, false, err
	}
	host, _, splitErr := net.SplitHostPort(addr)
	if splitErr != nil {
		return nil, false, err
	}
	l, err = net.Listen("tcp", net.JoinHostPort(host, "0"))
	return l, false, err
}

// OpenBrowser opens url in the user's default browser.
func OpenBrowser(url string) error {
	name, args := browserCommand(runtime.GOOS, url)
	return exec.Command(name, args...).Start()
}

func browserCommand(goos, url string) (string, []string) {
	switch goos {
	case "darwin":
		return "open", []string{url}
	case "windows":
		return "rundll32", []string{"url.dll,FileProtocolHandler", url}
	default:
		return "xdg-open", []string{url}
	}
}
