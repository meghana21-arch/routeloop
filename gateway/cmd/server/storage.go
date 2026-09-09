package main

import (
	"context"
	"database/sql"
	_ "embed"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

func saveTrace(ctx context.Context, db *sql.DB, trace Trace) error {
	_, err := db.ExecContext(ctx, `
		INSERT INTO traces (request_id, provider, model, workload, latency_ms, cost_usd, status, created_at, prompt_tokens, completion_tokens, total_tokens, retry_count, http_status, routing_reason)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		ON CONFLICT (request_id) DO NOTHING`,
		trace.RequestID, trace.Provider, trace.Model, trace.Workload, trace.LatencyMS, trace.CostUSD, trace.Status, trace.CreatedAt,
		trace.PromptTokens, trace.CompletionTokens, trace.TotalTokens, trace.RetryCount, trace.HTTPStatus, trace.RoutingReason,
	)
	return err
}

type TraceQuery struct {
	Limit, Offset            int
	Provider, Status, Search string
}

func traceWhere(query TraceQuery) (string, []any) {
	clauses, args := []string{"1=1"}, []any{}
	add := func(template string, value any) {
		args = append(args, value)
		clauses = append(clauses, fmt.Sprintf(template, len(args)))
	}
	if query.Provider != "" {
		add("t.provider = $%d", query.Provider)
	}
	if query.Status != "" {
		add("t.status = $%d", query.Status)
	}
	if query.Search != "" {
		args = append(args, query.Search)
		n := len(args)
		clauses = append(clauses, fmt.Sprintf("(t.request_id ILIKE '%%' || $%d || '%%' OR t.workload ILIKE '%%' || $%d || '%%' OR t.model ILIKE '%%' || $%d || '%%')", n, n, n))
	}
	return strings.Join(clauses, " AND "), args
}

func listStoredTraces(ctx context.Context, db *sql.DB, query TraceQuery) ([]Trace, int, error) {
	where, args := traceWhere(query)
	var total int
	if err := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM traces t WHERE "+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	args = append(args, query.Limit, query.Offset)
	statement := fmt.Sprintf(`SELECT t.request_id, t.provider, t.model, t.workload, t.latency_ms, t.cost_usd, t.status, t.created_at,
		t.prompt_tokens, t.completion_tokens, t.total_tokens, t.retry_count, t.http_status, t.routing_reason, e.score, e.passed
		FROM traces t LEFT JOIN LATERAL (SELECT score, passed FROM evaluations WHERE request_id=t.request_id ORDER BY created_at DESC LIMIT 1) e ON true
		WHERE %s ORDER BY t.created_at DESC LIMIT $%d OFFSET $%d`, where, len(args)-1, len(args))
	rows, err := db.QueryContext(ctx, statement, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := make([]Trace, 0, query.Limit)
	for rows.Next() {
		var trace Trace
		var score sql.NullFloat64
		var passed sql.NullBool
		if err := rows.Scan(&trace.RequestID, &trace.Provider, &trace.Model, &trace.Workload, &trace.LatencyMS, &trace.CostUSD, &trace.Status, &trace.CreatedAt, &trace.PromptTokens, &trace.CompletionTokens, &trace.TotalTokens, &trace.RetryCount, &trace.HTTPStatus, &trace.RoutingReason, &score, &passed); err != nil {
			return nil, 0, err
		}
		if score.Valid {
			trace.EvaluationScore = &score.Float64
		}
		if passed.Valid {
			trace.EvaluationPassed = &passed.Bool
		}
		items = append(items, trace)
	}
	return items, total, rows.Err()
}

func storedMetrics(ctx context.Context, db *sql.DB) (map[string]any, error) {
	var requests int
	var totalCost, averageLatency, errorRate float64
	var quality sql.NullFloat64
	err := db.QueryRowContext(ctx, `SELECT COUNT(*), COALESCE(SUM(cost_usd),0), COALESCE(AVG(latency_ms),0), COALESCE(AVG(CASE WHEN status='failed' THEN 1.0 ELSE 0.0 END),0), (SELECT AVG(score) FROM evaluations) FROM traces`).Scan(&requests, &totalCost, &averageLatency, &errorRate, &quality)
	if err != nil {
		return nil, err
	}
	var evaluated any
	if quality.Valid {
		evaluated = quality.Float64
	}
	return map[string]any{"requests": requests, "total_cost_usd": totalCost, "average_latency_ms": averageLatency, "error_rate": errorRate, "evaluated_quality": evaluated}, nil
}

//go:embed migrations/001_traces.sql
var initialSchema string

//go:embed migrations/002_trace_details.sql
var traceDetailsSchema string

//go:embed migrations/003_evaluations.sql
var evaluationsSchema string

func openDatabase() (*sql.DB, string) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		return nil, "memory"
	}

	db, err := sql.Open("postgres", url)
	if err != nil {
		log.Printf("database configuration failed; using memory: %v", err)
		return nil, "memory"
	}
	db.SetMaxOpenConns(8)
	db.SetMaxIdleConns(4)
	db.SetConnMaxLifetime(30 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		log.Printf("database unavailable; using memory: %v", err)
		return nil, "memory"
	}
	if _, err := db.ExecContext(ctx, initialSchema); err != nil {
		db.Close()
		log.Printf("database migration failed; using memory: %v", err)
		return nil, "memory"
	}
	if _, err := db.ExecContext(ctx, traceDetailsSchema); err != nil {
		db.Close()
		log.Printf("database detail migration failed; using memory: %v", err)
		return nil, "memory"
	}
	if _, err := db.ExecContext(ctx, evaluationsSchema); err != nil {
		db.Close()
		log.Printf("database evaluation migration failed; using memory: %v", err)
		return nil, "memory"
	}
	return db, "postgres"
}
