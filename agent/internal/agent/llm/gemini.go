package llm

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/google/generative-ai-go/genai"
	"google.golang.org/api/option"
)

type Gemini struct {
	client *genai.Client
	model  *genai.GenerativeModel
}

// NewGemini wires up the Gemini Flash provider using GEMINI_API_KEY.
func NewGemini(ctx context.Context, apiKey string) (*Gemini, error) {
	if apiKey == "" {
		return nil, errors.New("GEMINI_API_KEY is empty")
	}
	c, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		return nil, err
	}
	m := c.GenerativeModel("gemini-1.5-flash")
	m.ResponseMIMEType = "application/json"
	return &Gemini{client: c, model: m}, nil
}

func (g *Gemini) Plan(ctx context.Context, system, user string) (*Plan, error) {
	g.model.SystemInstruction = &genai.Content{Parts: []genai.Part{genai.Text(system)}}
	resp, err := g.model.GenerateContent(ctx, genai.Text(user))
	if err != nil {
		return nil, err
	}
	if len(resp.Candidates) == 0 || len(resp.Candidates[0].Content.Parts) == 0 {
		return nil, errors.New("gemini: empty response")
	}
	var raw string
	for _, p := range resp.Candidates[0].Content.Parts {
		if t, ok := p.(genai.Text); ok {
			raw += string(t)
		}
	}
	raw = strings.TrimSpace(raw)
	raw = strings.TrimPrefix(raw, "```json")
	raw = strings.TrimPrefix(raw, "```")
	raw = strings.TrimSuffix(raw, "```")
	var plan Plan
	if err := json.Unmarshal([]byte(raw), &plan); err != nil {
		return nil, fmt.Errorf("gemini: invalid plan JSON: %w (raw=%q)", err, raw)
	}
	return &plan, nil
}

func (g *Gemini) Close() error { return g.client.Close() }
