"""
Automated tests for Task 3: Database and Human Review Workflow.
Validates:
- Creating and retrieving a review
- Review history ordering (newest first)
- Retrieving a nonexistent review (404)
- Saving each valid human decision ('approved', 'rejected', 'changes_requested')
- Rejecting an invalid decision (422)
- Preserving automated findings after a human decision
- Persistence after database reconnection
"""

import os
import tempfile
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import Base, get_db
from app.models import ContentReview


@pytest.fixture
def temp_db_client():
    """
    Creates an isolated temporary SQLite database file for testing,
    ensuring real disk persistence and isolation from development data.
    """
    temp_dir = tempfile.mkdtemp()
    db_path = os.path.join(temp_dir, "test_brandshield_task3.db")
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    yield client, db_path, engine, TestingSession

    app.dependency_overrides.clear()
    engine.dispose()
    try:
        os.remove(db_path)
        os.rmdir(temp_dir)
    except Exception:
        pass


def test_create_and_retrieve_review(temp_db_client):
    """Test creating a review via POST /reviews and retrieving it via GET /reviews/{id}."""
    client, _, _, _ = temp_db_client
    payload = {
        "content": "AetherGlow serum offers guaranteed 100% results for all consumers!"
    }
    create_res = client.post("/reviews", json=payload)
    assert create_res.status_code == 201
    created_data = create_res.json()

    assert "id" in created_data
    assert created_data["content"] == payload["content"]
    assert created_data["total_findings"] >= 2
    assert created_data["status"] == "action_required"
    assert created_data["human_decision"] is None

    review_id = created_data["id"]

    # Retrieve the saved review
    get_res = client.get(f"/reviews/{review_id}")
    assert get_res.status_code == 200
    retrieved_data = get_res.json()

    assert retrieved_data["id"] == review_id
    assert retrieved_data["content"] == payload["content"]
    assert len(retrieved_data["findings"]) == len(created_data["findings"])


def test_review_history_ordering(temp_db_client):
    """GET /reviews must return reviews in reverse chronological order (newest first)."""
    client, _, _, _ = temp_db_client

    # Create first review
    res1 = client.post("/reviews", json={"content": "First review text: gentle radiance."})
    assert res1.status_code == 201
    id1 = res1.json()["id"]

    # Create second review
    res2 = client.post("/reviews", json={"content": "Second review text: consumers notice results."})
    assert res2.status_code == 201
    id2 = res2.json()["id"]

    # Create third review
    res3 = client.post("/reviews", json={"content": "Third review text: 70% recycled packaging."})
    assert res3.status_code == 201
    id3 = res3.json()["id"]

    # Get history
    history_res = client.get("/reviews")
    assert history_res.status_code == 200
    reviews = history_res.json()
    assert len(reviews) >= 3

    # Newest must be first
    review_ids = [r["id"] for r in reviews[:3]]
    assert review_ids == [id3, id2, id1]


def test_get_nonexistent_review(temp_db_client):
    """GET /reviews/{nonexistent_id} must return a clear 404 response."""
    client, _, _, _ = temp_db_client
    response = client.get("/reviews/nonexistent-review-id-99999")
    assert response.status_code == 404
    data = response.json()
    assert "not found" in data["detail"].lower()


def test_save_valid_human_decisions(temp_db_client):
    """Saving each valid decision ('approved', 'rejected', 'changes_requested') must succeed."""
    client, _, _, _ = temp_db_client

    valid_decisions = ["approved", "rejected", "changes_requested"]

    for dec in valid_decisions:
        # Create a review
        res = client.post("/reviews", json={"content": f"Testing decision {dec}"})
        review_id = res.json()["id"]

        # Submit human decision
        dec_payload = {
            "decision": dec,
            "comment": f"Compliance officer verdict for {dec}"
        }
        dec_res = client.post(f"/reviews/{review_id}/decision", json=dec_payload)
        assert dec_res.status_code == 200
        dec_data = dec_res.json()

        assert dec_data["status"] == dec
        assert dec_data["human_decision"] is not None
        assert dec_data["human_decision"]["decision"] == dec
        assert dec_data["human_decision"]["comment"] == dec_payload["comment"]
        assert "created_at" in dec_data["human_decision"]

        # Verify persistence on re-fetch
        fetch_res = client.get(f"/reviews/{review_id}")
        assert fetch_res.status_code == 200
        assert fetch_res.json()["human_decision"]["decision"] == dec


def test_reject_invalid_decision(temp_db_client):
    """Submitting an arbitrary or invalid decision value must be rejected with 422."""
    client, _, _, _ = temp_db_client

    # Create a review
    res = client.post("/reviews", json={"content": "Content to test invalid decision"})
    review_id = res.json()["id"]

    # Submit invalid decision
    bad_payload = {
        "decision": "arbitrary_unapproved_status",
        "comment": "Invalid decision test"
    }
    bad_res = client.post(f"/reviews/{review_id}/decision", json=bad_payload)
    assert bad_res.status_code == 422
    assert "allowed values" in bad_res.text.lower() or "invalid decision" in bad_res.text.lower()


def test_preserve_automated_findings_after_human_decision(temp_db_client):
    """
    CRITICAL: A human decision must never silently change or erase the original automated findings.
    """
    client, _, _, _ = temp_db_client

    # Create review with multiple findings
    problematic_content = (
        "AetherGlow serum offers guaranteed 100% results for all consumers! "
        "Formulated with 100% recycled packaging."
    )
    create_res = client.post("/reviews", json={"content": problematic_content})
    assert create_res.status_code == 201
    initial_data = create_res.json()
    review_id = initial_data["id"]

    original_findings = initial_data["findings"]
    assert len(original_findings) >= 3
    original_finding_types = [f["finding_type"] for f in original_findings]

    # Submit an 'approved' decision (e.g. human override with comment)
    decision_payload = {
        "decision": "approved",
        "comment": "Special exemption approved by Head of Regulatory."
    }
    dec_res = client.post(f"/reviews/{review_id}/decision", json=decision_payload)
    assert dec_res.status_code == 200
    updated_data = dec_res.json()

    # The review status changed to approved, but automated findings are fully intact!
    assert updated_data["status"] == "approved"
    assert len(updated_data["findings"]) == len(original_findings)
    assert [f["finding_type"] for f in updated_data["findings"]] == original_finding_types

    # Re-querying directly via GET confirms findings are preserved in storage
    get_res = client.get(f"/reviews/{review_id}")
    persisted_findings = get_res.json()["findings"]
    assert len(persisted_findings) == len(original_findings)
    assert [f["finding_type"] for f in persisted_findings] == original_finding_types


def test_persistence_after_database_reconnection(temp_db_client):
    """Test that records persist across independent database connections on disk."""
    client, db_path, engine, _ = temp_db_client

    # 1. Create a review through the API
    content = "Persistent content test across connection restarts."
    res = client.post("/reviews", json={"content": content})
    review_id = res.json()["id"]

    # 2. Add a decision
    client.post(f"/reviews/{review_id}/decision", json={
        "decision": "changes_requested",
        "comment": "Needs clarification on botanical extract sources."
    })

    # 3. Simulate application restart: create a completely new engine and session to the SQLite file
    new_engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    NewSession = sessionmaker(autocommit=False, autoflush=False, bind=new_engine)
    new_db = NewSession()

    try:
        # Query directly from the new database session
        persisted_review = new_db.query(ContentReview).filter(ContentReview.id == review_id).first()
        assert persisted_review is not None
        assert persisted_review.content == content
        assert persisted_review.status == "changes_requested"
        assert len(persisted_review.decisions) == 1
        assert persisted_review.decisions[0].decision == "changes_requested"
        assert "Needs clarification" in persisted_review.decisions[0].comment
    finally:
        new_db.close()
        new_engine.dispose()
