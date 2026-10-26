"""
Integration tests for BrandShield AI FastAPI endpoints.
Tests health check, guidelines, submission creation, rechecking, and human review decisions.
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

Base.metadata.create_all(bind=test_engine)


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
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["brand_context"] == "NovaPulse"


def test_brand_guidelines():
    response = client.get("/api/brand-guidelines")
    assert response.status_code == 200
    data = response.json()
    assert "profile" in data
    assert len(data["rules"]) >= 4
    assert len(data["verified_facts"]) >= 4


def test_check_text_validation_empty():
    """Empty or whitespace text should be rejected by validation."""
    response = client.post("/api/check", json={"text": "   "})
    assert response.status_code == 422


def test_check_text_creation_with_findings():
    """Submitting copy with violations should return findings and persist in DB."""
    payload = {
        "text": "Nova Pulse features a 14-day battery and is a miracle cure for all stress."
    }
    response = client.post("/api/check", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "submission_id" in data
    assert data["summary"]["total_findings"] >= 2
    assert len(data["findings"]) >= 2

    # Verify submission can be retrieved via GET
    sub_id = data["submission_id"]
    get_res = client.get(f"/api/submissions/{sub_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == sub_id


def test_recheck_edited_text():
    """Editing copy to be clean should resolve findings when rechecked."""
    # 1. First submit bad copy
    initial = client.post("/api/check", json={"text": "Nova Pulse has a 14-day battery life."}).json()
    sub_id = initial["submission_id"]
    assert initial["summary"]["total_findings"] > 0

    # 2. Recheck with compliant copy
    recheck_res = client.put(f"/api/submissions/{sub_id}/recheck", json={
        "text": "NovaPulse features up to 7 days of battery life on a single charge."
    })
    assert recheck_res.status_code == 200
    rechecked_data = recheck_res.json()
    assert rechecked_data["summary"]["status"] == "CLEAN"
    assert rechecked_data["summary"]["total_findings"] == 0


def test_human_review_decision_approve():
    """Test approving a submission."""
    sub = client.post("/api/check", json={"text": "NovaPulse with 7 days of battery life."}).json()
    sub_id = sub["submission_id"]

    decision_payload = {
        "decision": "APPROVE",
        "reviewer_name": "Compliance Lead Sarah",
        "notes": "Verified all claims against Q3 spec sheet."
    }
    res = client.post(f"/api/submissions/{sub_id}/decision", json=decision_payload)
    assert res.status_code == 201
    data = res.json()
    assert data["decision"] == "APPROVE"
    assert data["reviewer_name"] == "Compliance Lead Sarah"

    # Confirm submission status updated
    sub_detail = client.get(f"/api/submissions/{sub_id}").json()
    assert sub_detail["status"] == "APPROVED"
    assert len(sub_detail["reviews"]) == 1


def test_human_review_decision_invalid_choice():
    """Invalid decision choices must return 422."""
    sub = client.post("/api/check", json={"text": "NovaPulse standard copy."}).json()
    sub_id = sub["submission_id"]

    res = client.post(f"/api/submissions/{sub_id}/decision", json={
        "decision": "MAYBE_LATER",
        "reviewer_name": "Reviewer"
    })
    assert res.status_code == 422
