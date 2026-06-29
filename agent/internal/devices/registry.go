// Package devices holds prompt hints and high-level command templates for each
// supported device family.
package devices

import "sync"

// Profile describes how to talk to a class of device.
type Profile struct {
	// Prompts are the substrings that mark "device is ready for the next command".
	Prompts []string
	// PromptRegex, when set, replaces the simple substring scan with an
	// anchored regex match against the tail of the (ANSI-stripped) read
	// buffer. Use it for vendors whose prompt has variable modes (e.g.
	// MikroTik's "[admin@x] > " vs "[admin@x] <SAFE> > ").
	PromptRegex string
	// Hints is an extra paragraph appended to the LLM system prompt so the model
	// emits commands in the dialect this device understands.
	Hints string
	// SaveCmd is the command used to persist configuration.
	SaveCmd string
	// LoginPrelude are silent, idempotent commands run once after the initial
	// prompt is detected. Use them to disable paging, ANSI colour, and line
	// wrapping so the parser sees clean output. Failures are non-fatal.
	LoginPrelude []string
	// UsernameSuffix is appended to the SSH username before login. MikroTik
	// uses this to pass flags like "+ctw500w" that disable colours, terminal
	// detection, and line wrapping at the protocol level.
	UsernameSuffix string
	// OnConnect is raw bytes sent immediately after the initial prompt is
	// seen (before LoginPrelude). MikroTik uses Ctrl-X (0x18) here to enter
	// Safe Mode so any failure drops the TCP session and auto-rolls back.
	OnConnect []byte
	// OnCommit is raw bytes sent on a graceful Close to commit Safe-Mode
	// changes (Ctrl-X again on MikroTik). Skipped if Close is called after
	// a fatal error so the device performs an automatic rollback.
	OnCommit []byte
}


var (
	mu       sync.RWMutex
	profiles = map[string]Profile{}
)

// Register adds (or overrides) a device profile.
func Register(name string, p Profile) {
	mu.Lock()
	defer mu.Unlock()
	profiles[name] = p
}

// Get returns a profile by name, falling back to the generic HG profile.
func Get(name string) Profile {
	mu.RLock()
	defer mu.RUnlock()
	if p, ok := profiles[name]; ok {
		return p
	}
	return profiles["hg"]
}
