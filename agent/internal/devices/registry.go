// Package devices holds prompt hints and high-level command templates for each
// supported device family.
package devices

import "sync"

// Profile describes how to talk to a class of device.
type Profile struct {
	// Prompts are the substrings that mark "device is ready for the next command".
	Prompts []string
	// Hints is an extra paragraph appended to the LLM system prompt so the model
	// emits commands in the dialect this device understands.
	Hints string
	// SaveCmd is the command used to persist configuration.
	SaveCmd string
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
