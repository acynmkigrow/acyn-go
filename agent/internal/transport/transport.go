// Package transport defines the connector interface used by ACYN-Go.
package transport

import "io"

// Conn is the minimal contract every device transport must satisfy.
type Conn interface {
	io.Closer
	// Send writes a command (without trailing newline) and blocks until the
	// device prompt is detected or the read times out. It returns the raw
	// output captured between the command echo and the prompt.
	Send(cmd string) (string, error)
}
