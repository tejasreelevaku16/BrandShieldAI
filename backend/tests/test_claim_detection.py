"""
Automated tests for BrandShield AI Content Review Engine and Guideline Detection.
Validates:
1. Prohibited phrase detection (Rule A: 'guaranteed 100% results').
2. Capitalization and whitespace insensitivity (extra spaces, newlines, mixed case).
3. Terminology mismatch detection with whole-word matching (Rule B: 'consumers' vs 'consumerism'/'consume').
4. Factual contradiction detection (Fact A: 70% vs 100% recycled packaging).
5. Unsupported quantitative performance claims labeled strictly 'Unverified' (Claim B: 85% wrinkle reduction in 48 hours).
6. Clean content producing 0 findings and accurate clean message.
7. Multiple distinct findings detected in a single submission paragraph.
8. Disabled database rules do not trigger findings.
9. Structured findings schema compatibility with frontend (type, severity, matched_text, explanation, source, suggested_correction, status).
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
from app.engine import analyze_marketing_text


@pytest.fixture
def temp_db_client():
    """Isolated temporary SQLite database file for testing review engine and API endpoints."""
    temp_dir = tempfile.mkdtemp()
    db_path = os.path.join(temp_dir, "test_claim_detection.db")
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


def test_prohibited_phrase_detected(temp_db_client):
    """Verifies that 'guaranteed 100% results' is detected as a high severity Prohibited Phrase."""
    client, _, _, _ = temp_db_client
    payload = {
        "content": "Our serum provides guaranteed 100% results for glowing skin."
    }
    res = client.post("/reviews", json=payload)
    assert res.status_code == 201
    data = res.json()

    prohibited = [f for f in data["findings"] if f["finding_type"] == "Prohibited Phrase" or f.get("type") == "Prohibited Phrase"]
    assert len(prohibited) == 1
    p = prohibited[0]
    assert p["severity"] == "HIGH"
    assert "guaranteed 100% results" in p["flagged_text"].lower()
    assert "guaranteed 100% results" in p["matched_text"].lower()
    assert "RULE-PROHIBITED-01" in p["matched_rule_or_source"]
    assert "RULE-PROHIBITED-01" in p["source"]


def test_capitalization_and_whitespace_insensitivity():
    """Verifies that case variations and extra whitespace do not bypass prohibited phrase detection."""
    variations = [
        "AetherGlow delivers GUARANTEED 100% RESULTS for you.",
        "AetherGlow delivers Guaranteed   100%   Results for you.",
        "AetherGlow delivers guaranteed\n100%\tresults for you.",
        "AetherGlow guarantees 100% results for everyone."
    ]
    for text in variations:
        result = analyze_marketing_text(text)
        prohibited = [f for f in result["findings"] if f["finding_type"] == "Prohibited Phrase"]
        assert len(prohibited) >= 1, f"Failed to detect prohibited phrase in: {text!r}"
        assert prohibited[0]["severity"] == "HIGH"


def test_terminology_mismatch_detected_with_whole_words():
    """
    Verifies that 'consumers' is flagged as Terminology Mismatch,
    while unrelated words containing the substring (e.g. 'consume', 'consumerism') are NOT flagged.
    """
    # 1. Flagged text with 'consumers'
    flag_copy = "We create skincare for everyday consumers."
    result_flagged = analyze_marketing_text(flag_copy)
    term_findings = [f for f in result_flagged["findings"] if f["finding_type"] == "Terminology Mismatch"]
    assert len(term_findings) == 1
    assert term_findings[0]["flagged_text"].lower() == "consumers"
    assert "customers" in term_findings[0]["suggested_correction"]
    assert term_findings[0]["severity"] == "LOW"

    # 2. Unrelated whole words must NOT trigger a finding
    safe_copy = "Customers consume gentle oils, and our philosophy stands against reckless consumerism."
    result_safe = analyze_marketing_text(safe_copy)
    unrelated_terms = [f for f in result_safe["findings"] if f["finding_type"] == "Terminology Mismatch"]
    assert len(unrelated_terms) == 0, f"Unrelated words falsely flagged: {unrelated_terms}"


def test_packaging_contradiction_70_vs_100():
    """
    Verifies that claiming 100% recycled packaging conflicts with approved 70% fact (FACT-PKG-01)
    and cites the approved sample brand facts source.
    """
    copy = "All bottles are made with 100% recycled packaging."
    result = analyze_marketing_text(copy)

    contradictions = [f for f in result["findings"] if f["finding_type"] == "Factual Contradiction"]
    assert len(contradictions) == 1
    c = contradictions[0]
    assert c["severity"] == "HIGH"
    assert "FACT-PKG-01" in c["matched_rule_or_source"]
    assert "70%" in c["explanation"]
    assert "100%" in c["flagged_text"]
    assert c["status"] == "Factual Contradiction"


def test_unsupported_performance_claim_marked_unverified():
    """
    Verifies that the performance claim 'reduces wrinkles by 85% in just 48 hours'
    is labeled 'Unverified' (and 'Unverified claim'), and is not labeled definitively false.
    """
    copy = "Our revolutionary formula reduces wrinkles by 85% in just 48 hours."
    result = analyze_marketing_text(copy)

    unsupported = [f for f in result["findings"] if f["finding_type"] == "Unsupported Claim"]
    assert len(unsupported) == 1
    u = unsupported[0]
    # Check that status is Unverified
    assert u["status"] == "Unverified"
    assert "Unverified" in u["status_or_uncertainty_label"]
    # Ensure explanation explicitly notes it is NOT declared false
    assert "not declared false" in u["explanation"]
    assert "clinical trial" in u["suggested_correction"].lower()


def test_clean_content_no_findings():
    """Verifies that compliant text adhering to all rules and facts produces 0 findings."""
    clean_copy = (
        "AetherGlow daily serum is formulated to nourish and support your skin's natural radiance. "
        "Our customers love the gentle hydration, and all AetherGlow products are made with "
        "70% recycled packaging as part of our sustainability promise."
    )
    result = analyze_marketing_text(clean_copy)
    assert result["status"] == "CLEAN"
    assert result["total_findings"] == 0
    assert len(result["findings"]) == 0
    assert "No brand governance issues" in result.get("message", "")


def test_multiple_issues_in_one_paragraph(temp_db_client):
    """
    Submits the full test paragraph:
    'AetherGlow daily serum provides guaranteed 100% results for all consumers!
     Our revolutionary formula reduces wrinkles by 85% in just 48 hours,
     and all bottles are made with 100% recycled packaging.'

    Verifies all 4 distinct findings:
    1. Prohibited phrase (Rule A)
    2. Terminology mismatch (Rule B)
    3. Unsupported performance claim (Claim B)
    4. Packaging contradiction (Fact A)
    """
    client, _, _, _ = temp_db_client
    test_paragraph = (
        "AetherGlow daily serum provides guaranteed 100% results for all consumers! "
        "Our revolutionary formula reduces wrinkles by 85% in just 48 hours, "
        "and all bottles are made with 100% recycled packaging."
    )
    res = client.post("/reviews", json={"content": test_paragraph})
    assert res.status_code == 201
    data = res.json()

    assert data["total_findings"] == 4
    assert data["status"] == "action_required"

    finding_types = {f["finding_type"] for f in data["findings"]}
    assert "Prohibited Phrase" in finding_types
    assert "Terminology Mismatch" in finding_types
    assert "Unsupported Claim" in finding_types
    assert "Factual Contradiction" in finding_types

    # Verify structured fields on every finding
    for f in data["findings"]:
        assert "type" in f
        assert "severity" in f
        assert "matched_text" in f
        assert "explanation" in f
        assert "source" in f
        assert "suggested_correction" in f
        assert "status" in f
        assert len(f["matched_text"]) > 0
        assert len(f["explanation"]) > 0


def test_disabled_rules_do_not_trigger_findings(temp_db_client):
    """Verifies that disabling rules in the database stops them from flagging new reviews."""
    client, _, _, TestingSession = temp_db_client

    db = TestingSession()
    # Disable the prohibited phrase rule
    rule = db.query(BrandRule).filter(BrandRule.rule_id == "RULE-PROHIBITED-01").first()
    assert rule is not None
    rule.is_active = False
    db.commit()
    db.close()

    # Now review text that contains ONLY the prohibited phrase
    copy = "Our formula provides guaranteed 100% results for our customers."
    res = client.post("/reviews", json={"content": copy})
    assert res.status_code == 201
    data = res.json()

    # The disabled rule must not trigger
    prohibited = [f for f in data["findings"] if f["finding_type"] == "Prohibited Phrase"]
    assert len(prohibited) == 0


def test_frontend_compatible_fields_in_api_response(temp_db_client):
    """
    Verifies that the review response payload returns all fields expected by the frontend:
    type, severity, matched_text, explanation, source, suggested_correction, status.
    """
    client, _, _, _ = temp_db_client
    payload = {
        "content": "AetherGlow promises guaranteed 100% results for all consumers!"
    }
    res = client.post("/api/reviews", json=payload)
    assert res.status_code == 201
    data = res.json()

    assert "findings" in data
    assert len(data["findings"]) >= 2
    for f in data["findings"]:
        assert f.get("type") in ["Prohibited Phrase", "Terminology Mismatch"]
        assert f.get("severity") in ["HIGH", "LOW", "MEDIUM"]
        assert f.get("matched_text") is not None
        assert f.get("source") is not None
        assert f.get("explanation") is not None
        assert f.get("suggested_correction") is not None
        assert f.get("status") is not None


def test_empty_content_validation_rejection(temp_db_client):
    """Verifies that empty string or whitespace-only submissions are rejected with HTTP 422."""
    client, _, _, _ = temp_db_client

    # Empty string
    res1 = client.post("/reviews", json={"content": ""})
    assert res1.status_code == 422
    assert "Marketing content cannot be empty" in res1.text

    # Whitespace only
    res2 = client.post("/reviews", json={"content": "   \n\t   "})
    assert res2.status_code == 422
    assert "Marketing content cannot be empty" in res2.text

    # Empty text field
    res3 = client.post("/reviews", json={"text": ""})
    assert res3.status_code == 422


def test_nonexistent_review_id_returns_404(temp_db_client):
    """Verifies that querying or updating a nonexistent review ID returns 404."""
    client, _, _, _ = temp_db_client

    # Nonexistent GET
    res_get = client.get("/reviews/nonexistent-id-000")
    assert res_get.status_code == 404
    assert "not found" in res_get.json()["detail"].lower()

    # Nonexistent POST decision
    res_dec = client.post(
        "/reviews/nonexistent-id-000/decision",
        json={"decision": "approved", "comment": "Reviewing phantom"}
    )
    assert res_dec.status_code == 404
    assert "not found" in res_dec.json()["detail"].lower()


def test_deduplication_of_duplicate_matches():
    """
    Verifies that duplicate matches covering the exact same span
    (e.g., from redundant rules) are deduplicated to prevent redundant UI cards.
    """
    redundant_rules = [
        {
            "rule_id": "RULE-A1",
            "name": "No Guarantees v1",
            "rule_type": "prohibited_phrase",
            "prohibited_phrase": "guaranteed 100% results",
            "severity": "HIGH",
            "is_active": True
        },
        {
            "rule_id": "RULE-A2",
            "name": "No Guarantees v2 (Duplicate)",
            "rule_type": "prohibited_phrase",
            "prohibited_phrase": "guaranteed 100% results",
            "severity": "HIGH",
            "is_active": True
        }
    ]
    text = "We promise guaranteed 100% results today."
    res = analyze_marketing_text(text, active_rules=redundant_rules, active_facts=[])
    # Even though both rules matched the same phrase at the same span, deduplication preserves only 1
    assert res["total_findings"] == 1
    assert len(res["findings"]) == 1


def test_complete_human_decision_workflow_preserves_findings(temp_db_client):
    """
    Verifies complete review workflow:
    1. Create review with findings
    2. Record human decision ('approved')
    3. Confirm findings are NOT overwritten or erased
    4. Confirm review persists in database and list
    5. Update human decision ('changes_requested') and confirm decision history
    """
    client, _, _, _ = temp_db_client

    # 1. Create review with issues
    test_text = "AetherGlow daily serum gives guaranteed 100% results for all consumers!"
    create_res = client.post("/reviews", json={"content": test_text})
    assert create_res.status_code == 201
    review_data = create_res.json()
    review_id = review_data["id"]
    original_findings_count = review_data["total_findings"]
    assert original_findings_count >= 2
    assert review_data["status"] == "action_required"
    assert review_data["human_decision"] is None

    # 2. Record human decision: approved
    decision_payload = {
        "decision": "approved",
        "comment": "Approved under legal exception #441"
    }
    dec_res = client.post(f"/reviews/{review_id}/decision", json=decision_payload)
    assert dec_res.status_code == 200
    updated_data = dec_res.json()

    # 3. Confirm status updated but automated findings are fully preserved
    assert updated_data["status"] == "approved"
    assert updated_data["total_findings"] == original_findings_count
    assert len(updated_data["findings"]) == original_findings_count
    assert updated_data["human_decision"]["decision"] == "approved"
    assert updated_data["human_decision"]["comment"] == "Approved under legal exception #441"

    # 4. Confirm review persists via GET
    get_res = client.get(f"/reviews/{review_id}")
    assert get_res.status_code == 200
    fetched_data = get_res.json()
    assert fetched_data["id"] == review_id
    assert fetched_data["total_findings"] == original_findings_count
    assert fetched_data["human_decision"]["decision"] == "approved"

    # 5. Update decision to changes_requested
    dec_res2 = client.post(f"/reviews/{review_id}/decision", json={"decision": "changes_requested", "comment": "Changed mind, revise text."})
    assert dec_res2.status_code == 200
    updated_data2 = dec_res2.json()
    assert updated_data2["status"] == "changes_requested"
    assert len(updated_data2["decisions"]) == 2
    assert updated_data2["decisions"][0]["decision"] == "changes_requested"
    assert updated_data2["decisions"][1]["decision"] == "approved"
    # Automated findings still intact
    assert updated_data2["total_findings"] == original_findings_count


def test_guideline_lifecycle_add_edit_toggle_affects_reviews(temp_db_client):
    """
    Verifies full lifecycle of brand guidelines:
    1. Add custom rule
    2. Confirm new rule triggers in future review
    3. Disable rule and confirm it stops triggering
    4. Re-enable rule and confirm it triggers again
    5. Edit rule phrase and confirm modified phrase triggers
    """
    client, _, _, _ = temp_db_client

    # 1. Add custom rule
    new_rule_payload = {
        "rule_id": "RULE-MIRACLE-01",
        "name": "No Miracle Cure Claims",
        "rule_type": "prohibited_phrase",
        "description": "Never use the phrase miracle cure in skincare descriptions.",
        "severity": "HIGH",
        "prohibited_phrase": "miracle cure",
        "preferred_replacement": "effective skincare treatment",
        "is_active": True
    }
    create_rule_res = client.post("/rules", json=new_rule_payload)
    assert create_rule_res.status_code == 201
    created_rule = create_rule_res.json()
    assert created_rule["rule_id"] == "RULE-MIRACLE-01"

    # 2. Check content containing 'miracle cure' -> must trigger
    rev1 = client.post("/reviews", json={"content": "This daily serum is a true miracle cure for tired skin."})
    assert rev1.status_code == 201
    findings1 = [f for f in rev1.json()["findings"] if f["rule_or_evidence_id"] == "RULE-MIRACLE-01"]
    assert len(findings1) == 1

    # 3. Disable the rule
    toggle_res1 = client.patch(f"/rules/{created_rule['rule_id']}/toggle")
    assert toggle_res1.status_code == 200
    assert toggle_res1.json()["is_active"] is False

    # Check content again -> must NOT trigger
    rev2 = client.post("/reviews", json={"content": "This daily serum is a true miracle cure for tired skin."})
    assert rev2.status_code == 201
    findings2 = [f for f in rev2.json()["findings"] if f["rule_or_evidence_id"] == "RULE-MIRACLE-01"]
    assert len(findings2) == 0

    # 4. Re-enable the rule
    toggle_res2 = client.patch(f"/rules/{created_rule['rule_id']}/toggle")
    assert toggle_res2.status_code == 200
    assert toggle_res2.json()["is_active"] is True

    # Check content again -> must trigger again
    rev3 = client.post("/reviews", json={"content": "This daily serum is a true miracle cure for tired skin."})
    assert rev3.status_code == 201
    findings3 = [f for f in rev3.json()["findings"] if f["rule_or_evidence_id"] == "RULE-MIRACLE-01"]
    assert len(findings3) == 1

    # 5. Edit rule phrase to 'miracle elixir'
    update_res = client.put(f"/rules/{created_rule['rule_id']}", json={
        "name": "No Miracle Elixir Claims",
        "prohibited_phrase": "miracle elixir",
        "description": "Updated rule banning miracle elixir wording."
    })
    assert update_res.status_code == 200
    assert update_res.json()["prohibited_phrase"] == "miracle elixir"

    # Check content with 'miracle elixir' -> must trigger
    rev4 = client.post("/reviews", json={"content": "This bottle is a miracle elixir for glowing skin."})
    assert rev4.status_code == 201
    findings4 = [f for f in rev4.json()["findings"] if f["rule_or_evidence_id"] == "RULE-MIRACLE-01"]
    assert len(findings4) == 1


def test_approved_fact_lifecycle_add_edit_toggle(temp_db_client):
    """
    Verifies full lifecycle of approved fact sources:
    1. Add custom fact
    2. Toggle fact active/inactive
    3. Update fact statement
    4. Delete fact
    """
    client, _, _, _ = temp_db_client

    # 1. Add approved fact
    fact_payload = {
        "fact_id": "FACT-NIAC-01",
        "statement": "AetherGlow serum contains certified 10% niacinamide.",
        "source_name": "Clinical Formulation Batch Record #2025-N10",
        "source_url": "https://aetherglow.example.com/spec-niac-10",
        "verification_status": "verified_sample",
        "is_active": True
    }
    create_res = client.post("/facts", json=fact_payload)
    assert create_res.status_code == 201
    created_fact = create_res.json()
    assert created_fact["fact_id"] == "FACT-NIAC-01"

    # 2. Toggle fact inactive
    toggle_res1 = client.patch(f"/facts/{created_fact['fact_id']}/toggle")
    assert toggle_res1.status_code == 200
    assert toggle_res1.json()["is_active"] is False

    # 3. Update fact
    update_res = client.put(f"/facts/{created_fact['fact_id']}", json={
        "statement": "AetherGlow serum contains certified 12% niacinamide.",
        "verification_status": "verified_certified",
        "is_active": True
    })
    assert update_res.status_code == 200
    assert update_res.json()["statement"] == "AetherGlow serum contains certified 12% niacinamide."
    assert update_res.json()["is_active"] is True

    # 4. Delete fact
    delete_res = client.delete(f"/facts/{created_fact['fact_id']}")
    assert delete_res.status_code == 200
    assert "deleted successfully" in delete_res.json()["message"]

    # Verify fact is gone
    get_res = client.get(f"/facts/{created_fact['fact_id']}")
    assert get_res.status_code == 404


def test_additional_unsupported_performance_claims():
    """
    Verifies that claims asserting '100% clinically proven' or 'guaranteed to work for everyone'
    are properly flagged as Unverified (never declared definitively false without evidence).
    """
    # 1. 100% clinically proven
    res1 = analyze_marketing_text("Our serum is 100% clinically proven to restore youth.")
    unverified1 = [f for f in res1["findings"] if f["finding_type"] == "Unsupported Claim"]
    assert len(unverified1) == 1
    assert unverified1[0]["status"] == "Unverified"
    assert "100% clinically proven" in unverified1[0]["flagged_text"].lower()

    # 2. Guaranteed to work for everyone
    res2 = analyze_marketing_text("This night cream is guaranteed to work for everyone.")
    unverified2 = [f for f in res2["findings"] if f["finding_type"] == "Unsupported Claim"]
    assert len(unverified2) == 1
    assert unverified2[0]["status"] == "Unverified"
    assert "work for everyone" in unverified2[0]["flagged_text"].lower()


def test_governance_analytics_computed_from_database(temp_db_client):
    """
    Verifies that GET /reviews/analytics computes real-time governance metrics
    strictly from actual database records without fake statistics.
    """
    client, _, _, _ = temp_db_client

    # Initial state: 0 reviews
    res_init = client.get("/reviews/analytics")
    assert res_init.status_code == 200
    data_init = res_init.json()
    assert data_init["total_reviews"] == 0
    assert data_init["awaiting_review"] == 0
    assert data_init["approved"] == 0

    # 1. Submit review with issues
    rev_issue = client.post("/reviews", json={"content": "AetherGlow gives guaranteed 100% results for all consumers!"})
    assert rev_issue.status_code == 201
    issue_id = rev_issue.json()["id"]

    # 2. Submit clean review
    rev_clean = client.post("/reviews", json={"content": "AetherGlow daily serum supports healthy customers with 70% recycled packaging."})
    assert rev_clean.status_code == 201

    # Check analytics: 2 total, 1 awaiting review, 1 clean, 1 with issues
    res_mid = client.get("/reviews/analytics")
    assert res_mid.status_code == 200
    data_mid = res_mid.json()
    assert data_mid["total_reviews"] == 2
    assert data_mid["awaiting_review"] == 1
    assert data_mid["clean_reviews"] == 1
    assert data_mid["reviews_with_issues"] == 1
    assert len(data_mid["top_triggered_guidelines"]) >= 1

    # 3. Record human verdict on the first review
    client.post(f"/reviews/{issue_id}/decision", json={"decision": "approved", "comment": "Approved with exceptions"})

    # Check analytics: 0 awaiting review, 1 approved
    res_final = client.get("/reviews/analytics")
    assert res_final.status_code == 200
    data_final = res_final.json()
    assert data_final["total_reviews"] == 2
    assert data_final["awaiting_review"] == 0
    assert data_final["approved"] == 1
    assert data_final["clean_reviews"] == 1
