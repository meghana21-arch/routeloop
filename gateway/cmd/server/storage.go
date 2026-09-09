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
