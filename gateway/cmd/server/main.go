package main

import (
	"bufio"
	"bytes"
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}
type ChatRequest struct {
	Model    string         `json:"model"`
	Messages []Message      `json:"messages"`
	Stream   bool           `json:"stream"`
	Metadata map[string]any `json:"metadata,omitempty"`
}
type Choice struct {
	Index        int     `json:"index"`
	Message      Message `json:"message"`
	FinishReason string  `json:"finish_reason"`
}
type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}
type ChatResponse struct {
	ID, Object, Model string
	Created           int64
	Choices           []Choice
	Usage             Usage
}
type Trace struct {
	RequestID        string    `json:"request_id"`
	Provider         string    `json:"provider"`
	Model            string    `json:"model"`
	Workload         string    `json:"workload"`
	LatencyMS        int64     `json:"latency_ms"`
	CostUSD          float64   `json:"cost_usd"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"created_at"`
	PromptTokens     int       `json:"prompt_tokens"`
	CompletionTokens int       `json:"completion_tokens"`
	TotalTokens      int       `json:"total_tokens"`
	RetryCount       int       `json:"retry_count"`
	HTTPStatus       int       `json:"http_status"`
	RoutingReason    string    `json:"routing_reason"`
	EvaluationScore  *float64  `json:"evaluation_score,omitempty"`
	EvaluationPassed *bool     `json:"evaluation_passed,omitempty"`
}
type Provider interface {
	Name() string
	Chat(context.Context, ChatRequest) (string, Usage, error)
}

type HTTPProvider struct{ name, key, endpoint string }

func (p HTTPProvider) Name() string { return p.name }
func (p HTTPProvider) Chat(ctx context.Context, req ChatRequest) (string, Usage, error) {
	var body any
	endpoint := p.endpoint
	headers := map[string]string{"Content-Type": "application/json"}
	switch p.name {
	case "openai":
		body = map[string]any{"model": env("OPENAI_MODEL", "gpt-4o-mini"), "messages": req.Messages}
		headers["Authorization"] = "Bearer " + p.key
	case "anthropic":
		body = map[string]any{"model": env("ANTHROPIC_MODEL", "claude-3-5-haiku-latest"), "max_tokens": 1024, "messages": req.Messages}
		headers["x-api-key"] = p.key
		headers["anthropic-version"] = "2023-06-01"
	case "gemini":
		headers["x-goog-api-key"] = strings.TrimSpace(p.key)
		parts := make([]map[string]any, 0, len(req.Messages))
		for _, m := range req.Messages {
			parts = append(parts, map[string]any{"role": mapRole(m.Role), "parts": []map[string]string{{"text": m.Content}}})
		}
		body = map[string]any{"contents": parts}
	}
	b, _ := json.Marshal(body)
	hreq, _ := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewReader(b))
	for k, v := range headers {
		hreq.Header.Set(k, v)
	}
	resp, err := http.DefaultClient.Do(hreq)
	if err != nil {
		return "", Usage{}, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if resp.StatusCode >= 400 {
		return "", Usage{}, fmt.Errorf("%s returned %d", p.name, resp.StatusCode)
	}
	return normalize(p.name, raw)
}
func mapRole(r string) string {
	if r == "assistant" {
		return "model"
	}
	return "user"
}
func normalize(provider string, raw []byte) (string, Usage, error) {
	var v map[string]any
	if json.Unmarshal(raw, &v) != nil {
		return "", Usage{}, errors.New("invalid provider response")
	}
	if provider == "openai" {
		choices, _ := v["choices"].([]any)
		if len(choices) > 0 {
			m, _ := choices[0].(map[string]any)["message"].(map[string]any)
			return fmt.Sprint(m["content"]), Usage{}, nil
		}
	}
	if provider == "anthropic" {
		c, _ := v["content"].([]any)
		if len(c) > 0 {
			return fmt.Sprint(c[0].(map[string]any)["text"]), Usage{}, nil
		}
	}
	if provider == "gemini" {
		c, _ := v["candidates"].([]any)
		if len(c) > 0 {
			content := c[0].(map[string]any)["content"].(map[string]any)
			parts := content["parts"].([]any)
			usage := Usage{}
			if meta, ok := v["usageMetadata"].(map[string]any); ok {
				usage.PromptTokens = asInt(meta["promptTokenCount"])
				usage.CompletionTokens = asInt(meta["candidatesTokenCount"])
				usage.TotalTokens = asInt(meta["totalTokenCount"])
			}
			return fmt.Sprint(parts[0].(map[string]any)["text"]), usage, nil
		}
	}
	return "", Usage{}, errors.New("empty provider response")
}
func asInt(v any) int {
	if n, ok := v.(float64); ok {
		return int(n)
	}
	return 0
}

type MockProvider struct{}

func (MockProvider) Name() string { return "mock" }
func (MockProvider) Chat(ctx context.Context, r ChatRequest) (string, Usage, error) {
	time.Sleep(time.Duration(80+rand.Intn(120)) * time.Millisecond)
	prompt := ""
	if len(r.Messages) > 0 {
		prompt = r.Messages[len(r.Messages)-1].Content
	}
	return "RouteLoop mock response: " + prompt, Usage{PromptTokens: len(prompt)/4 + 1, CompletionTokens: 12, TotalTokens: len(prompt)/4 + 13}, nil
}

var mu sync.RWMutex
var traces = []Trace{}
var database, storageMode = openDatabase()

func main() {
	if database != nil {
		defer database.Close()
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, map[string]any{"status": "ok", "service": "routeloop-gateway", "storage": storageMode})
	})
	mux.HandleFunc("GET /v1/traces", getTraces)
	mux.HandleFunc("GET /v1/metrics", getMetrics)
	mux.Handle("POST /v1/chat/completions", requireAPIKey(http.HandlerFunc(chat)))
	port := env("PORT", "8080")
	log.Printf("RouteLoop gateway listening on :%s with %s storage", port, storageMode)
	log.Fatal(http.ListenAndServe(":"+port, cors(mux)))
}
func requireAPIKey(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		expected := strings.TrimSpace(os.Getenv("ROUTELOOP_API_KEY"))
		provided := strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
		valid := expected != "" && provided != "" && subtle.ConstantTimeCompare([]byte(provided), []byte(expected)) == 1
		if !valid {
			writeError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}
func chat(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	id := fmt.Sprintf("req_%x", rand.Uint64())
	var req ChatRequest
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&req); err != nil {
		http.Error(w, "invalid request", 400)
		return
	}
	p := choose(req)
	var text string
	var usage Usage
	var err error
	attempts := 0
	for attempt := 0; attempt < 3; attempt++ {
		attempts++
		ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		text, usage, err = p.Chat(ctx, req)
		cancel()
		if err == nil {
			break
		}
		time.Sleep(time.Duration(100*(1<<attempt)) * time.Millisecond)
	}
	status := "completed"
	httpStatus := http.StatusOK
	if err != nil {
		status = "failed"
		httpStatus = http.StatusBadGateway
		http.Error(w, err.Error(), 502)
	} else if req.Stream {
		stream(w, id, p.Name(), text)
	} else {
		writeJSON(w, map[string]any{"id": id, "object": "chat.completion", "created": time.Now().Unix(), "model": p.Name(), "choices": []Choice{{Index: 0, Message: Message{Role: "assistant", Content: text}, FinishReason: "stop"}}, "usage": usage})
	}
	workload, _ := req.Metadata["workload"].(string)
	if workload == "" {
		workload = r.Header.Get("X-RouteLoop-Workload")
	}
	routingReason := "requested-provider"
	if req.Model == "" || req.Model == "routeloop/auto" {
		routingReason = "default-provider"
	}
	t := Trace{RequestID: id, Provider: p.Name(), Model: providerModel(p.Name()), Workload: workload, LatencyMS: time.Since(start).Milliseconds(), CostUSD: estimate(p.Name(), usage), Status: status, CreatedAt: time.Now(), PromptTokens: usage.PromptTokens, CompletionTokens: usage.CompletionTokens, TotalTokens: usage.TotalTokens, RetryCount: attempts - 1, HTTPStatus: httpStatus, RoutingReason: routingReason}
	recordTrace(t)
}
func providerModel(provider string) string {
	switch provider {
	case "openai":
		return env("OPENAI_MODEL", "gpt-4o-mini")
	case "anthropic":
		return env("ANTHROPIC_MODEL", "claude-3-5-haiku-latest")
	case "gemini":
		return env("GEMINI_MODEL", "gemini-3.6-flash")
	default:
		return "deterministic-v1"
	}
}
func choose(r ChatRequest) Provider {
	requested := strings.TrimPrefix(r.Model, "routeloop/")
	if requested == "" || requested == "auto" {
		requested = env("DEFAULT_PROVIDER", "mock")
	}
	switch requested {
	case "openai":
		if k := os.Getenv("OPENAI_API_KEY"); k != "" {
			return HTTPProvider{"openai", k, "https://api.openai.com/v1/chat/completions"}
		}
	case "anthropic":
		if k := os.Getenv("ANTHROPIC_API_KEY"); k != "" {
			return HTTPProvider{"anthropic", k, "https://api.anthropic.com/v1/messages"}
		}
	case "gemini":
		if k := os.Getenv("GEMINI_API_KEY"); k != "" {
			return HTTPProvider{"gemini", k, "https://generativelanguage.googleapis.com/v1beta/models/" + env("GEMINI_MODEL", "gemini-3.6-flash") + ":generateContent"}
		}
	}
	return MockProvider{}
}
func stream(w http.ResponseWriter, id, model, text string) {
	f, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "stream unsupported", 500)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	s := bufio.NewWriter(w)
	for _, word := range strings.Fields(text) {
		payload, _ := json.Marshal(map[string]any{"id": id, "object": "chat.completion.chunk", "model": model, "choices": []any{map[string]any{"delta": map[string]string{"content": word + " "}, "index": 0}}})
		fmt.Fprintf(s, "data: %s\n\n", payload)
		s.Flush()
		f.Flush()
	}
	fmt.Fprint(s, "data: [DONE]\n\n")
	s.Flush()
	f.Flush()
}
func recordTrace(trace Trace) {
	mu.Lock()
	traces = append([]Trace{trace}, traces...)
	if len(traces) > 1000 {
		traces = traces[:1000]
	}
	mu.Unlock()
	if database != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if err := saveTrace(ctx, database, trace); err != nil {
				log.Printf("trace persistence failed: %v", err)
			}
		}()
	}
}
func getTraces(w http.ResponseWriter, r *http.Request) {
	query := TraceQuery{Limit: boundedInt(r.URL.Query().Get("limit"), 100, 1, 200), Offset: boundedInt(r.URL.Query().Get("offset"), 0, 0, 10000), Provider: r.URL.Query().Get("provider"), Status: r.URL.Query().Get("status"), Search: r.URL.Query().Get("search")}
	if database != nil {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()
		stored, total, err := listStoredTraces(ctx, database, query)
		if err == nil {
			writeJSON(w, map[string]any{"data": stored, "storage": "postgres", "pagination": map[string]int{"limit": query.Limit, "offset": query.Offset, "total": total}})
			return
		}
		log.Printf("trace query failed; using memory: %v", err)
	}
	mu.RLock()
	defer mu.RUnlock()
	writeJSON(w, map[string]any{"data": traces, "storage": "memory"})
}
func getMetrics(w http.ResponseWriter, r *http.Request) {
	if database != nil {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()
		metrics, err := storedMetrics(ctx, database)
		if err == nil {
			writeJSON(w, map[string]any{"data": metrics, "storage": "postgres"})
			return
		}
		log.Printf("metrics query failed; using memory: %v", err)
	}
	mu.RLock()
	defer mu.RUnlock()
	var totalCost float64
	var totalLatency int64
	failures := 0
	for _, trace := range traces {
		totalCost += trace.CostUSD
		totalLatency += trace.LatencyMS
		if trace.Status == "failed" {
			failures++
		}
	}
	averageLatency, errorRate := float64(0), float64(0)
	if len(traces) > 0 {
		averageLatency = float64(totalLatency) / float64(len(traces))
		errorRate = float64(failures) / float64(len(traces))
	}
	writeJSON(w, map[string]any{"data": map[string]any{"requests": len(traces), "total_cost_usd": totalCost, "average_latency_ms": averageLatency, "error_rate": errorRate, "evaluated_quality": nil}, "storage": "memory"})
}
func boundedInt(raw string, fallback, minimum, maximum int) int {
	value, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	if value < minimum {
		return minimum
	}
	if value > maximum {
		return maximum
	}
	return value
}
func estimate(p string, u Usage) float64 {
	rate := 0.000001
	if p == "openai" {
		rate = .000003
	} else if p == "anthropic" {
		rate = .000004
	} else if p == "gemini" {
		rate = .0000004
	}
	return float64(u.TotalTokens) * rate
}
func env(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}
func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}
func writeError(w http.ResponseWriter, message string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]any{"error": map[string]any{"message": message, "status": status}})
}
func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", env("WEB_ORIGIN", "*"))
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-RouteLoop-Workload")
		if r.Method == "OPTIONS" {
			w.WriteHeader(204)
			return
		}
		next.ServeHTTP(w, r)
	})
}
