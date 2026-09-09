import os

from fastapi import FastAPI, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import psycopg

app = FastAPI(title="RouteLoop Evaluator", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("WEB_ORIGIN", "https://routeloop-ten.vercel.app")],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

class Evaluation(BaseModel):
    output: str
    request_id: str | None = None
    expected: str | None = None
    required_terms: list[str] = Field(default_factory=list)

@app.get("/healthz")
def health(): return {"status": "ok", "service": "routeloop-evaluator"}

def persist_evaluation(item: Evaluation, score: float, passed: bool, checks: int) -> bool:
    database_url = os.getenv("DATABASE_URL")
    if not database_url or not item.request_id:
        return False
    try:
        with psycopg.connect(database_url, connect_timeout=5) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """INSERT INTO evaluations
                       (request_id, evaluator_id, evaluator_version, score, passed, checks)
                       VALUES (%s, 'deterministic', '1', %s, %s, %s)""",
                    (item.request_id, score, passed, checks),
                )
        return True
    except psycopg.Error:
        return False

@app.post("/v1/evaluate")
def evaluate(item: Evaluation, x_routeloop_evaluator_key: str | None = Header(default=None)):
    text = item.output.casefold()
    checks = [term.casefold() in text for term in item.required_terms]
    if item.expected is not None:
        checks.append(item.expected.casefold().strip() == text.strip())
    score = sum(checks) / len(checks) if checks else 1.0
    passed = score >= .9
    expected_key = os.getenv("EVALUATOR_API_KEY")
    authorized = bool(expected_key) and x_routeloop_evaluator_key == expected_key
    persisted = persist_evaluation(item, score, passed, len(checks)) if authorized else False
    return {"evaluator_id": "deterministic", "evaluator_version": "1", "score": score, "passed": passed, "checks": len(checks), "request_id": item.request_id, "persisted": persisted}
