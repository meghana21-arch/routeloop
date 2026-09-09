package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

func TestBoundedInt(t *testing.T) {
	for _, test := range []struct {
		raw  string
		want int
	}{{"", 10}, {"25", 25}, {"0", 1}, {"999", 100}} {
		if got := boundedInt(test.raw, 10, 1, 100); got != test.want {
			t.Fatalf("boundedInt(%q)=%d, want %d", test.raw, got, test.want)
		}
	}
}

func TestAPIKeyMiddleware(t *testing.T) {
	t.Setenv("ROUTELOOP_API_KEY", "test-secret")
	handler := requireAPIKey(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) }))
	unauthorized := httptest.NewRecorder()
	handler.ServeHTTP(unauthorized, httptest.NewRequest(http.MethodPost, "/", nil))
	if unauthorized.Code != http.StatusUnauthorized {
		t.Fatalf("without key status=%d", unauthorized.Code)
	}
	authorized := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/", strings.NewReader("{}"))
	request.Header.Set("Authorization", "Bearer test-secret")
	handler.ServeHTTP(authorized, request)
	if authorized.Code != http.StatusNoContent {
		t.Fatalf("with key status=%d", authorized.Code)
	}
}

func TestMain(m *testing.M) {
	os.Unsetenv("DATABASE_URL")
	os.Exit(m.Run())
}
