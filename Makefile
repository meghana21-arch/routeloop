.PHONY: dev test demo
dev:
	docker compose up --build
test:
	cd gateway && go test ./...
	docker compose config --quiet
demo:
	curl -N http://localhost:8080/v1/chat/completions -H 'content-type: application/json' -H 'X-RouteLoop-Workload: customer_support' -d '{"model":"routeloop/auto","stream":true,"messages":[{"role":"user","content":"Explain RouteLoop in one sentence."}]}'
