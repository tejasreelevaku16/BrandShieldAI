"""
Automated unit tests for AetherGlow Brand Rule Engine.
Validates:
- Clean text
- Prohibited phrases (case-insensitive)
- Terminology mismatches ('consumers' -> 'customers')
- Factual contradictions (Packaging specification)
- Unsupported claims (marked 'Unverified claim', not declared false)
- Multiple findings in one submission
"""

import pytest
from app.engine import (
    analyze_marketing_text,
    check_prohibited_phrases,
    check_terminology,
    check_approved_facts,
    check_unsupported_claims
)


def test_clean_text():
    """Clean text adhering to all rules and facts should return 0 findings."""
    clean_copy = (
        "AetherGlow daily radiance serum is crafted for daily nourishment. "
        "Our customers love the gentle hydration, and all AetherGlow products are made with "
        "70% recycled packaging as part of our sustainability promise."
    )
    result = analyze_marketing_text(clean_copy)
    assert result["status"] == "CLEAN"
    assert result["total_findings"] == 0
    assert len(result["findings"]) == 0


def test_prohibited_phrase_case_insensitive():
    """'guaranteed 100% results' must be flagged regardless of capitalization."""
    copy_upper = "Our revolutionary essence provides GUARANTEED 100% RESULTS for every skin type."
    result = analyze_marketing_text(copy_upper)

    prohibited = [f for f in result["findings"] if f["finding_type"] == "Prohibited Phrase"]
    assert len(prohibited) == 1
    assert prohibited[0]["severity"] == "HIGH"
    assert "RULE-PROHIBITED-01" in prohibited[0]["matched_rule_or_source"]
    assert prohibited[0]["status_or_uncertainty_label"] == "Confirmed Violation"
    assert "guaranteed 100% results" in prohibited[0]["flagged_text"].lower()


def test_terminology_mismatch():
    """Using 'consumers' instead of 'customers' must trigger a Terminology Mismatch finding."""
    copy = "We prioritize delivering the finest skincare experience to modern consumers everywhere."
    result = analyze_marketing_text(copy)

    term_findings = [f for f in result["findings"] if f["finding_type"] == "Terminology Mismatch"]
    assert len(term_findings) == 1
    assert "customers" in term_findings[0]["suggested_correction"]
    assert "consumers" in term_findings[0]["flagged_text"].lower()
    assert "RULE-TERM-01" in term_findings[0]["matched_rule_or_source"]


def test_factual_contradiction_packaging():
    """Claiming 100% or other non-70% recycled packaging contradicts approved fact FACT-PKG-01."""
    copy = "AetherGlow bottles are made with 100% recycled packaging to protect our oceans."
    result = analyze_marketing_text(copy)

    contradictions = [f for f in result["findings"] if f["finding_type"] == "Factual Contradiction"]
    assert len(contradictions) == 1
    assert contradictions[0]["severity"] == "HIGH"
    assert "FACT-PKG-01" in contradictions[0]["matched_rule_or_source"]
    assert "70%" in contradictions[0]["explanation"]


def test_unsupported_claim_labeled_unverified():
    """
    Quantitative efficacy assertions without evidence must be classified as Unsupported Claim
    and marked with status 'Unverified claim' (never declared false).
    """
    copy = "AetherGlow formula reduces wrinkles by 85% in just 48 hours."
    result = analyze_marketing_text(copy)

    unsupported = [f for f in result["findings"] if f["finding_type"] == "Unsupported Claim"]
    assert len(unsupported) == 1
    # Check required label
    assert unsupported[0]["status_or_uncertainty_label"] == "Unverified claim"
    # Ensure explanation clarifies it is NOT declared false
    assert "not declared false" in unsupported[0]["explanation"]
    assert "clinical trial" in unsupported[0]["suggested_correction"]


def test_multiple_findings_in_one_submission():
    """A submission with multiple violations should return all distinct findings."""
    problematic_copy = (
        "AetherGlow serum offers guaranteed 100% results for all consumers! "
        "Our cream reduces fine lines by 60% within one week, and each bottle is made with "
        "100% recycled packaging."
    )
    result = analyze_marketing_text(problematic_copy)

    assert result["status"] == "ACTION_REQUIRED"
    assert result["total_findings"] >= 4

    types = {f["finding_type"] for f in result["findings"]}
    assert "Prohibited Phrase" in types
    assert "Terminology Mismatch" in types
    assert "Factual Contradiction" in types
    assert "Unsupported Claim" in types
