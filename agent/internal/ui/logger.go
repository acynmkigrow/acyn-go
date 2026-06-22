package ui

import (
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// SessionLogger writes every command + response to ~/.acyn-go/sessions/<ip>-<ts>.log.
type SessionLogger struct {
	f *os.File
}

func NewSessionLogger(ip string) (*SessionLogger, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	dir := filepath.Join(home, ".acyn-go", "sessions")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	name := fmt.Sprintf("%s-%s.log", ip, time.Now().Format("20060102-150405"))
	f, err := os.Create(filepath.Join(dir, name))
	if err != nil {
		return nil, err
	}
	return &SessionLogger{f: f}, nil
}

// Record appends a single command + output entry to the log.
func (l *SessionLogger) Record(cmd, out string, err error) {
	if l == nil || l.f == nil {
		return
	}
	stamp := time.Now().Format(time.RFC3339)
	if err != nil {
		fmt.Fprintf(l.f, "[%s] %s -> ERR: %v\n", stamp, cmd, err)
		return
	}
	fmt.Fprintf(l.f, "[%s] %s\n%s\n", stamp, cmd, out)
}

// Close flushes and closes the log file.
func (l *SessionLogger) Close() error {
	if l == nil || l.f == nil {
		return nil
	}
	return l.f.Close()
}
