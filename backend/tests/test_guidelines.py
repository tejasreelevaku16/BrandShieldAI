"""
Automated tests for Task 4: Editable Brand Guidelines and Fact Sources.
Validates:
- Creating, reading, editing, and deleting brand rules
- Disabling a rule and verifying it no longer affects new reviews
- Adding a new rule dynamically and verifying it affects new reviews
- Creating and updating approved facts
- Handling invalid input (empty names, invalid types) and 404s
- Preserving historical findings unchanged when guidelines are modified
"""

import os
import tempfile
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app, seed_default_guidelines_if_empty
from app.database import Base, get_db
from app.models import BrandRule, ApprovedFact, ContentReview


@pytest.fixture
def temp_db_client():
    """Isolated temporary SQLite database file for testing Task 4."""
    temp_dir = tempfile.mkdtemp()
    db_path = os.path.join(temp_dir, "test_brandshield_task4.db")
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    Base.metadata.create_all(bind=engine)
    db = TestingSession()
    seed_default_guidelines_if_empty(db)
    db.close()

    def override_get_db():
        session = TestingSession()
        try:
            yield session
        finally:
            session.close()

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


def test_list_and_create_rule(temp_db_client):
    """Test listing seeded rules and creating a new brand rule."""
    client, _, _, _ = temp_db_client

    # Verify seeded rules exist
    res = client.get("/rules")
    assert res.status_code == 200
    rules = res.json()
    assert len(rules) >= 2

    # Create a new rule
    new_rule_payload = {
        "rule_id": "RULE-TEST-01",
        "name": "Prohibit Miracle Claims",
        "rule_type": "prohibited_phrase",
        "description": "Never claim products are miracle formulas.",
        "severity": "HIGH",
        "prohibited_phrase": "miracle formula",
        "preferred_replacement": "advanced formulation",
        "is_active": True
    }
    create_res = client.post("/rules", json=new_rule_payload)
    assert create_res.status_code == 201
    created_rule = create_res.json()
    assert created_rule["rule_id"] == "RULE-TEST-01"
    assert created_rule["name"] == "Prohibit Miracle Claims"

    # Fetch rule by ID
    get_res = client.get("/rules/RULE-TEST-01")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Prohibit Miracle Claims"


def test_update_and_toggle_rule(temp_db_client):
    """Test editing an existing rule and toggling its active status."""
    client, _, _, _ = temp_db_client

    # Update description and severity
    update_res = client.put("/rules/RULE-TERM-01", json={
        "name": "Updated Nomenclature Standard",
        "severity": "MEDIUM"
    })
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["name"] == "Updated Nomenclature Standard"
    assert updated["severity"] == "MEDIUM"

    # Toggle active status to False
    toggle_res = client.patch("/rules/RULE-TERM-01/toggle")
    assert toggle_res.status_code == 200
    assert toggle_res.json()["is_active"] is False

    # Toggle back to True
    toggle_res2 = client.patch("/rules/RULE-TERM-01/toggle")
    assert toggle_res2.status_code == 200
    assert toggle_res2.json()["is_active"] is True


def test_disabled_rule_does_not_affect_new_reviews(temp_db_client):
    """
    CRITICAL: Disabling a rule must immediately stop it from flagging new reviews,
    without changing any Python source code.
    """
    client, _, _, _ = temp_db_client
    test_content = "Experience guaranteed 100% results with AetherGlow."

    # 1. While active, rule flags the prohibited phrase
    res_active = client.post("/reviews", json={"content": test_content})
    assert res_active.status_code == 201
    findings_active = res_active.json()["findings"]
    assert any("guaranteed 100% results" in f["flagged_text"].lower() for f in findings_active)

    # 2. Disable RULE-PROHIBITED-01
    toggle_res = client.patch("/rules/RULE-PROHIBITED-01/toggle")
    assert toggle_res.status_code == 200
    assert toggle_res.json()["is_active"] is False

    # 3. New review submitted now should NOT flag this rule!
    res_disabled = client.post("/reviews", json={"content": test_content})
    assert res_disabled.status_code == 201
    findings_disabled = res_disabled.json()["findings"]
    prohibited_findings = [f for f in findings_disabled if f["finding_type"] == "Prohibited Phrase"]
    assert len(prohibited_findings) == 0


def test_newly_added_rule_immediately_affects_reviews(temp_db_client):
    """
    CRITICAL: Adding a new active rule must immediately affect subsequent reviews.
    """
    client, _, _, _ = temp_db_client
    copy_text = "This breakthrough product is an absolute miracle cure."

    # 1. Initially, 'miracle cure' is not a registered rule
    res_before = client.post("/reviews", json={"content": copy_text})
    assert res_before.status_code == 201
    assert not any("miracle cure" in (f.get("flagged_text") or "").lower() for f in res_before.json()["findings"])

    # 2. Add dynamic rule for 'miracle cure'
    client.post("/rules", json={
        "rule_id": "RULE-MIRACLE-01",
        "name": "Prohibit Miracle Terminology",
        "rule_type": "prohibited_phrase",
        "description": "Never describe products using miracle language.",
        "severity": "HIGH",
        "prohibited_phrase": "miracle cure",
        "preferred_replacement": "nourishing skincare formula",
        "is_active": True
    })

    # 3. Now review the same copy: it MUST flag the new rule!
    res_after = client.post("/reviews", json={"content": copy_text})
    assert res_after.status_code == 201
    findings_after = res_after.json()["findings"]
    miracle_findings = [f for f in findings_after if "miracle cure" in (f.get("flagged_text") or "").lower()]
    assert len(miracle_findings) == 1
    assert "RULE-MIRACLE-01" in miracle_findings[0]["matched_rule_or_source"]


def test_create_and_update_approved_facts(temp_db_client):
    """Test creating, reading, and updating approved facts."""
    client, _, _, _ = temp_db_client

    # Verify seeded facts exist
    facts_res = client.get("/facts")
    assert facts_res.status_code == 200
    facts = facts_res.json()
    assert len(facts) >= 2
    assert any("70% recycled packaging" in f["statement"] for f in facts)
    assert any("founded in 2020" in f["statement"] for f in facts)

    # Create a new approved fact
    new_fact_res = client.post("/facts", json={
        "fact_id": "FACT-CLINICAL-01",
        "statement": "Clinically proven to improve skin hydration by 28% in 14 days.",
        "source_name": "DermaLab Independent Clinical Trial DL-2024-9",
        "source_url": "https://aetherglow.example.com/clinical/DL-2024-9",
        "verification_status": "verified_sample"
    })
    assert new_fact_res.status_code == 201
    created_fact = new_fact_res.json()
    assert created_fact["fact_id"] == "FACT-CLINICAL-01"

    # Update fact
    update_res = client.put("/facts/FACT-CLINICAL-01", json={
        "statement": "Clinically proven to improve skin hydration by 30% in 14 days."
    })
    assert update_res.status_code == 200
    assert "30%" in update_res.json()["statement"]


def test_historical_findings_preserved_after_guidelines_change(temp_db_client):
    """
    CRITICAL: Modifying or deleting a rule must NEVER change or erase historical findings
    on previously saved reviews.
    """
    client, _, _, _ = temp_db_client

    # 1. Create a review with rule violation
    res = client.post("/reviews", json={"content": "AetherGlow guarantees 100% results."})
    review_id = res.json()["id"]
    original_findings_count = res.json()["total_findings"]
    assert original_findings_count >= 1

    # 2. Modify or disable the rule
    client.patch("/rules/RULE-PROHIBITED-01/toggle")

    # 3. Retrieve the past review: findings must remain completely intact!
    past_review = client.get(f"/reviews/{review_id}").json()
    assert past_review["total_findings"] == original_findings_count
    assert len(past_review["findings"]) == original_findings_count


def test_invalid_input_and_404_handling(temp_db_client):
    """Test validation errors for empty fields and 404s for nonexistent rules/facts."""
    client, _, _, _ = temp_db_client

    # Empty rule name -> 422
    bad_rule = client.post("/rules", json={
        "name": "   ",
        "rule_type": "prohibited_phrase",
        "description": "Valid description"
    })
    assert bad_rule.status_code == 422

    # Nonexistent rule -> 404
    missing_rule = client.get("/rules/NONEXISTENT-RULE-ID")
    assert missing_rule.status_code == 404

    # Empty fact statement -> 422
    bad_fact = client.post("/facts", json={
        "statement": "",
        "source_name": "Valid source"
    })
    assert bad_fact.status_code == 422

    # Nonexistent fact -> 404
    missing_fact = client.get("/facts/NONEXISTENT-FACT-ID")
    assert missing_fact.status_code == 404
