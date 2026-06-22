// Package ui — cross-platform browser launcher.
package ui

import (
	"os/exec"
	"runtime"
)

// OpenBrowser tries to open the given URL in the user's default browser.
// Returns nil on success; the caller should fall back to printing the URL on error.
func OpenBrowser(url string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default: // linux, freebsd, etc.
		cmd = exec.Command("xdg-open", url)
	}
	return cmd.Start()
}
