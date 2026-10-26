"""
Integration tests for FastAPI endpoints, specifically POST /review for AetherGlow.
Validates:
- Health check
- POST /review with clean text
- POST /review with prohibited phrases
- POST /review with terminology mismatch
- POST /review with unsupported claims
- POST /review with empty input (validation failure)
- POST /review with multiple findings in one submission
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db

# StaticPool ensures that all connections share the same in-memory SQLite database
TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_db():
    """Wipes and recreates test tables before each test."""
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    yield


def test_health_check():
    """Verifies that health check returns healthy status and AetherGlow brand context."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["brand_context"] == "AetherGlow"


def test_review_clean_text():
    """POST /review with compliant text should return 200 with 0 findings and CLEAN status."""
    payload = {
        "text": "AetherGlow radiance serum is formulated for our customers. All products are made with 70% recycled packaging."
    }
    response = client.post("/review", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["brand"] == "AetherGlow"
    assert data["status"] == "CLEAN"
    assert data["total_findings"] == 0
    assert len(data["findings"]) == 0


def test_review_prohibited_phrase():
    """POST /review detects 'guaranteed 100% results'."""
    payload = {
        "text": "Experience guaranteed 100% results with AetherGlow nightly treatment."
    }
    response = client.post("/review", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["total_findings"] >= 1
    prohibited = [f for f in data["findings"] if f["finding_type"] == "Prohibited Phrase"]
    assert len(prohibited) == 1
    assert prohibited[0]["severity"] == "HIGH"
    assert "RULE-PROHIBITED-01" in prohibited[0]["matched_rule_or_source"]
    assert prohibited[0]["status_or_uncertainty_label"] == "Confirmed Violation"


def test_review_terminology_mismatch():
    """POST /review detects terminology mismatch ('consumers')."""
    payload = {
        "text": "AetherGlow provides skincare solutions to mindful consumers."
    }
    response = client.post("/review", json=payload)
    assert response.status_code == 200
    data = response.json()
    terms = [f for f in data["findings"] if f["finding_type"] == "Terminology Mismatch"]
    assert len(terms) == 1
    assert "customers" in terms[0]["suggested_correction"]


def test_review_unsupported_claim():
    """POST /review marks unsupported claims as 'Unverified claim' rather than false."""
    payload = {
        "text": "AetherGlow essence reduces dark spots by 75% in three days."
    }
    response = client.post("/review", json=payload)
    assert response.status_code == 200
    data = response.json()
    unsupported = [f for f in data["findings"] if f["finding_type"] == "Unsupported Claim"]
    assert len(unsupported) == 1
    assert unsupported[0]["status_or_uncertainty_label"] == "Unverified claim"
    assert "not declared false" in unsupported[0]["explanation"]


def test_review_empty_input():
    """POST /review with empty or whitespace text should return HTTP 422 with a useful error message."""
    # Empty string
    res_empty = client.post("/review", json={"text": ""})
    assert res_empty.status_code == 422
    assert "cannot be empty" in res_empty.text

    # Whitespace string
    res_spaces = client.post("/review", json={"text": "    "})
    assert res_spaces.status_code == 422
    assert "cannot be empty" in res_spaces.text


def test_review_multiple_findings():
    """POST /review returns multiple findings in a single submission."""
    payload = {
        "text": (
            "AetherGlow guarantees 100% results for all consumers! "
            "Our patented formula reduces wrinkles by 80% and is made with 100% recycled packaging."
        )
    }
    response = client.post("/review", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["total_findings"] >= 4

    types = {f["finding_type"] for f in data["findings"]}
    assert "Prohibited Phrase" in types
    assert "Terminology Mismatch" in types
    assert "Factual Contradiction" in types
    assert "Unsupported Claim" in types
