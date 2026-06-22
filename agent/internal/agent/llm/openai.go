package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// OpenAI is a minimal chat-completions client so the agent doesn't pull
// in a transitive SDK just for one POST.
type OpenAI struct {
	apiKey string
	model  string
	http   *http.Client
}

func NewOpenAI(apiKey string) (*OpenAI, error) {
	if apiKey == "" {
		return nil, errors.New("OPENAI_API_KEY is empty")
	}
	return &OpenAI{
		apiKey: apiKey,
		model:  "gpt-4o-mini",
		http:   &http.Client{Timeout: 30 * time.Second},
	}, nil
}

type oaiMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type oaiRequest struct {
	Model          string                 `json:"model"`
	Messages       []oaiMessage           `json:"messages"`
	ResponseFormat map[string]string      `json:"response_format"`
	Temperature    float64                `json:"temperature"`
	Extra          map[string]interface{} `json:"-"`
}

type oaiResponse struct {
	Choices []struct {
		Message oaiMessage `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

func (o *OpenAI) Plan(ctx context.Context, system, user string) (*Plan, error) {
	body, _ := json.Marshal(oaiRequest{
		Model: o.model,
		Messages: []oaiMessage{
			{Role: "system", Content: system},
			{Role: "user", Content: user},
		},
		ResponseFormat: map[string]string{"type": "json_object"},
		Temperature:    0.1,
	})
	req, _ := http.NewRequestWithContext(ctx, "POST",
		"https://api.openai.com/v1/chat/completions", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+o.apiKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := o.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	var parsed oaiResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("openai: %w", err)
	}
	if parsed.Error != nil {
		return nil, errors.New("openai: " + parsed.Error.Message)
	}
	if len(parsed.Choices) == 0 {
		return nil, errors.New("openai: no choices")
	}
	content := strings.TrimSpace(parsed.Choices[0].Message.Content)
	var plan Plan
	if err := json.Unmarshal([]byte(content), &plan); err != nil {
		return nil, fmt.Errorf("openai: invalid plan JSON: %w", err)
	}
	return &plan, nil
}

func (o *OpenAI) Close() error { return nil }
