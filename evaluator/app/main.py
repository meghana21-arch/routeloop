from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="RouteLoop Evaluator", version="0.1.0")

class Evaluation(BaseModel):
    output: str
    expected: str | None = None
    required_terms: list[str] = Field(default_factory=list)

@app.get("/healthz")
def health(): return {"status": "ok", "service": "routeloop-evaluator"}

@app.post("/v1/evaluate")
def evaluate(item: Evaluation):
    text = item.output.casefold()
    checks = [term.casefold() in text for term in item.required_terms]
    if item.expected is not None:
        checks.append(item.expected.casefold().strip() == text.strip())
    score = sum(checks) / len(checks) if checks else 1.0
    return {"evaluator_id": "deterministic", "evaluator_version": "1", "score": score, "passed": score >= .9, "checks": len(checks)}
