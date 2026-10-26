"""
Unit tests for BrandShield AI Deterministic Verification Engine.
Validates brand rules, factual contradictions, and unsupported claim handling.
"""

import pytest
from app.engine import analyze_marketing_text, check_brand_rules, check_factual_contradictions, check_unsupported_claims


def test_clean_compliant_text():
    """Text adhering to all rules and verified facts should return 0 findings."""
    clean_copy = (
        "NovaPulse is designed to support healthy daily habits. "
        "With up to 7 days of battery life and water resistance up to 50 meters, "
        "it helps you stay on track. Enjoy our 30-day risk-free money-back guarantee."
    )
    result = analyze_marketing_text(clean_copy)
    assert result["summary"]["status"] == "CLEAN"
    assert len(result["findings"]) == 0


def test_rule_violation_prohibited_cure():
    """Absolute cure or miracle claims must trigger a HIGH severity RULE_VIOLATION."""
    copy = "NovaPulse is a miracle cure that eliminates heart disease forever."
    result = analyze_marketing_text(copy)
    
    violations = [f for f in result["findings"] if f["category"] == "RULE_VIOLATION"]
    assert len(violations) >= 1
    assert any(v["rule_or_evidence_id"] == "RULE-001" for v in violations)
    assert any(v["severity"] == "HIGH" for v in violations)


def test_rule_violation_missing_fda_disclaimer():
    """Discussion of disease diagnosis or treatment without disclaimer must trigger RULE-002."""
    copy = "NovaPulse can diagnose clinical symptom patterns in your daily heart condition."
    result = analyze_marketing_text(copy)
    
    violations = [f for f in result["findings"] if f["rule_or_evidence_id"] == "RULE-002"]
    assert len(violations) == 1
    assert "FDA" in violations[0]["issue"] or "FDA" in violations[0]["explanation"]


def test_rule_violation_brand_spelling():
    """Incorrect trademark capitalization (e.g., Nova Pulse) must trigger RULE-003."""
    copy = "Try the new Nova Pulse tracker today."
    result = analyze_marketing_text(copy)
    
    violations = [f for f in result["findings"] if f["rule_or_evidence_id"] == "RULE-003"]
    assert len(violations) >= 1
    assert violations[0]["suggested_correction"] == "Change spelling to 'NovaPulse'."


def test_factual_contradiction_battery():
    """Claiming battery life exceeding verified 7-day lab spec must trigger FACTUAL_CONTRADICTION."""
    copy = "NovaPulse delivers 14 days of battery life on a single charge."
    result = analyze_marketing_text(copy)
    
    contradictions = [f for f in result["findings"] if f["category"] == "FACTUAL_CONTRADICTION"]
    assert len(contradictions) == 1
    assert contradictions[0]["rule_or_evidence_id"] == "FACT-001"
    assert "7 days" in contradictions[0]["explanation"]


def test_factual_contradiction_water_resistance():
    """Claiming depth exceeding 50m rating must trigger FACTUAL_CONTRADICTION."""
    copy = "NovaPulse is certified waterproof up to 100 meters for extreme deep-sea diving."
    result = analyze_marketing_text(copy)
    
    contradictions = [f for f in result["findings"] if f["category"] == "FACTUAL_CONTRADICTION"]
    assert len(contradictions) == 1
    assert contradictions[0]["rule_or_evidence_id"] == "FACT-002"
    assert contradictions[0]["severity"] == "HIGH"


def test_factual_contradiction_100_percent_accuracy():
    """Claiming 100% sensor accuracy contradicts clinical study NP-2025 (98.2%)."""
    copy = "NovaPulse optical sensor provides 100% accurate ECG readings every time."
    result = analyze_marketing_text(copy)
    
    contradictions = [f for f in result["findings"] if f["category"] == "FACTUAL_CONTRADICTION"]
    assert len(contradictions) >= 1
    assert any(c["rule_or_evidence_id"] == "FACT-003" for c in contradictions)


def test_unsupported_claim_not_marked_as_false():
    """
    Quantitative efficacy assertions without evidence must be classified as UNSUPPORTED_CLAIM.
    Must never be labeled as false or factual contradiction.
    """
    copy = "NovaPulse reduces stress cortisol by 45% within two weeks."
    result = analyze_marketing_text(copy)
    
    unsupported = [f for f in result["findings"] if f["category"] == "UNSUPPORTED_CLAIM"]
    assert len(unsupported) == 1
    # Ensure it's NOT in factual contradictions
    contradictions = [f for f in result["findings"] if f["category"] == "FACTUAL_CONTRADICTION"]
    assert len(contradictions) == 0
    # Must explicitly state in explanation that it is unverified, not proven false
    assert "not proven false" in unsupported[0]["explanation"]
