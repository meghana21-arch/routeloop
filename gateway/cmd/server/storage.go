package main

import (
	"context"
	"database/sql"
	_ "embed"
	"log"
	"os"
	"time"

	_ "github.com/lib/pq"
)

func saveTrace(ctx context.Context, db *sql.DB, trace Trace) error {
	_, err := db.ExecContext(ctx, `
		INSERT INTO traces (request_id, provider, model, workload, latency_ms, cost_usd, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (request_id) DO NOTHING`,
		trace.RequestID, trace.Provider, trace.Model, trace.Workload, trace.LatencyMS, trace.CostUSD, trace.Status, trace.CreatedAt,
	)
	return err
}

func listStoredTraces(ctx context.Context, db *sql.DB, limit int) ([]Trace, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT request_id, provider, model, workload, latency_ms, cost_usd, status, created_at
		FROM traces ORDER BY created_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Trace, 0, limit)
	for rows.Next() {
		var trace Trace
		if err := rows.Scan(&trace.RequestID, &trace.Provider, &trace.Model, &trace.Workload, &trace.LatencyMS, &trace.CostUSD, &trace.Status, &trace.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, trace)
	}
	return items, rows.Err()
}

//go:embed migrations/001_traces.sql
var initialSchema string

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
	return db, "postgres"
}
