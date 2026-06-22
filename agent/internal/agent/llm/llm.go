package llm

import "context"

// Plan is the JSON contract every LLM provider returns.
type Plan struct {
	Commands    []string `json:"commands"`
	Description string   `json:"description"`
	Warning     string   `json:"warning,omitempty"`
}

// Provider is the minimal contract for an AI brain.
type Provider interface {
	Plan(ctx context.Context, system, user string) (*Plan, error)
	Close() error
}
