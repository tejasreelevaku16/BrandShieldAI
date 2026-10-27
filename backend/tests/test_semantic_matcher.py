"""
BrandShield AI - Test Suite for Semantic Verification & Lightweight Engine Validation
Validates:
1. Same claim with different wording.
2. A claim that contradicts an approved brand fact.
3. Two unrelated sentences.
4. The same fact with different percentages (70% vs 100% packaging).
5. A prohibited phrase detected independently of semantic similarity.
6. Distinction between contradiction and unsupported claims (never marking false solely on similarity).
7. Bugfix: 'post-consumer' in recycled material descriptions does not trigger audience terminology rule.
"""

import pytest
from app.semantic_matcher import SemanticMatcher, get_semantic_matcher, CANDIDATE_SIMILARITY_THRESHOLD
from app.engine import analyze_marketing_text
from app.rules_data import APPROVED_FACTS, BRAND_RULES


# ---------------- Prompt Case 1: Same claim with different wording ----------------
def test_case_same_claim_with_different_wording():
    """
    Evaluates:
    Approved Fact: 'AetherGlow products are made with 70% recycled packaging.'
    Claim: 'Our bottles are crafted using 70% reclaimed materials.'
    Verifies that semantic similarity identifies high candidate alignment,
    and because the claimed 70% matches the approved 70%, 0 contradictions are flagged.
    """
    matcher = SemanticMatcher()
    approved_fact = "AetherGlow products are made with 70% recycled packaging."
    claim = "Our bottles are crafted using 70% reclaimed materials."

    sim = matcher.compute_similarity(claim, approved_fact)
    assert sim >= 0.40, f"Expected high candidate similarity >= 0.40, got {sim:.4f}"

    result = analyze_marketing_text(claim)
    assert result["total_findings"] == 0, "Consistent claim with different wording should not generate findings"
    assert result["status"] == "CLEAN"


# ---------------- Prompt Case 2: Claim that contradicts an approved brand fact ----------------
def test_case_claim_contradicting_approved_brand_fact():
    """
    Evaluates:
    Approved Fact: 'AetherGlow was founded in 2020.'
    Claim: 'AetherGlow origin traces back to 1995 as an artisanal apothecary.'
    Verifies that candidate similarity triggers, and the grounded checker flags a Factual Contradiction.
    """
    matcher = SemanticMatcher()
    approved_fact = "AetherGlow was founded in 2020."
    claim = "AetherGlow origin traces back to 1995 as an artisanal apothecary."

    sim = matcher.compute_similarity(claim, approved_fact)
    assert sim >= CANDIDATE_SIMILARITY_THRESHOLD, f"Expected similarity >= {CANDIDATE_SIMILARITY_THRESHOLD}, got {sim:.4f}"

    result = analyze_marketing_text(claim)
    assert result["total_findings"] == 1
    f = result["findings"][0]
    assert f["category"] == "FACTUAL_CONTRADICTION"
    assert f["severity"] == "HIGH"
    assert "1995" in f["issue"] and "2020" in f["issue"]


# ---------------- Prompt Case 3: Two unrelated sentences ----------------
def test_case_two_unrelated_sentences():
    """
    Evaluates two unrelated sentences against brand facts:
    1. 'Our customer service team is available weekdays from 9 AM to 5 PM.'
    2. 'The botanical greenhouse relies on natural sunlight and rainwater irrigation.'
    Verifies that similarity scores remain below candidate threshold and generate 0 findings.
    """
    matcher = SemanticMatcher()
    approved_fact = "AetherGlow products are made with 70% recycled packaging."
    unrelated_1 = "Our customer service team is available weekdays from 9 AM to 5 PM."
    unrelated_2 = "The botanical greenhouse relies on natural sunlight and rainwater irrigation."

    sim_1 = matcher.compute_similarity(unrelated_1, approved_fact)
    sim_2 = matcher.compute_similarity(unrelated_2, approved_fact)
    assert sim_1 < CANDIDATE_SIMILARITY_THRESHOLD, f"Unrelated sentence similarity should be low, got {sim_1:.4f}"
    assert sim_2 < CANDIDATE_SIMILARITY_THRESHOLD, f"Unrelated sentence similarity should be low, got {sim_2:.4f}"

    res_1 = analyze_marketing_text(unrelated_1)
    res_2 = analyze_marketing_text(unrelated_2)
    assert res_1["total_findings"] == 0 and res_1["status"] == "CLEAN"
    assert res_2["total_findings"] == 0 and res_2["status"] == "CLEAN"


# ---------------- Prompt Case 4: Same fact with different percentages (70% vs 100%) ----------------
def test_case_same_fact_with_different_percentages():
    """
    Evaluates packaging statements:
    1. 'AetherGlow products are made with 70% recycled packaging.' (Compliant with fact)
    2. 'AetherGlow products are made with 100% recycled packaging.' (Contradicts 70% specification)
    """
    text_70 = "AetherGlow products are made with 70% recycled packaging."
    text_100 = "AetherGlow products are made with 100% recycled packaging."

    res_70 = analyze_marketing_text(text_70)
    assert res_70["total_findings"] == 0
    assert res_70["status"] == "CLEAN"

    res_100 = analyze_marketing_text(text_100)
    assert res_100["total_findings"] == 1
    assert res_100["findings"][0]["category"] == "FACTUAL_CONTRADICTION"
    assert "70%" in res_100["findings"][0]["issue"] or "70%" in res_100["findings"][0]["explanation"]


# ---------------- Prompt Case 5: Prohibited phrase detected independently of semantic similarity ----------------
def test_case_prohibited_phrase_detected_independently_of_semantic_similarity():
    """
    Evaluates:
    'Our moisturizing cream delivers guaranteed 100% results for glowing skin.'
    Verifies that the deterministic rule engine identifies 'guaranteed 100% results'
    regardless of semantic similarity scores.
    """
    claim = "Our moisturizing cream delivers guaranteed 100% results for glowing skin."
    res = analyze_marketing_text(claim)
    assert res["total_findings"] >= 1
    rule_violations = [f for f in res["findings"] if f["category"] == "RULE_VIOLATION"]
    assert len(rule_violations) >= 1
    assert any("guaranteed 100% results" in f["flagged_text"].lower() for f in rule_violations)
    assert rule_violations[0]["severity"] == "HIGH"


# ---------------- Prompt Requirement 4: Distinguish Contradiction vs Unsupported Claim ----------------
def test_case_distinguish_contradiction_from_unsupported_claim():
    """
    Verifies:
    1. A genuine contradiction is marked 'FACTUAL_CONTRADICTION'.
    2. An unsubstantiated claim (e.g. novel biodegradability extension or quantitative trial claim)
       is marked 'UNSUPPORTED_CLAIM' with status 'Unverified / Needs Human Review', and is NOT declared false.
    3. An unrelated sentence with low similarity is NOT marked false, but returned as CLEAN.
    """
    # 1. Contradiction
    res_contra = analyze_marketing_text("Our containers are produced using 100% reclaimed materials.")
    assert res_contra["findings"][0]["category"] == "FACTUAL_CONTRADICTION"

    # 2. Unsupported Novel Claim (ocean biodegradability)
    res_novel = analyze_marketing_text("Our bottles are 100% biodegradable in ocean water within 30 days.")
    assert res_novel["findings"][0]["category"] == "UNSUPPORTED_CLAIM"
    assert res_novel["findings"][0]["status"] in ["Unverified", "Needs Human Review"]
    assert "not declared false" in res_novel["findings"][0]["explanation"].lower() or "unverified" in res_novel["findings"][0]["explanation"].lower()

    # 3. Low similarity sentence is not marked false
    res_clean = analyze_marketing_text("Our office doors open at 8:30 AM every morning.")
    assert res_clean["status"] == "CLEAN"
    assert res_clean["total_findings"] == 0


# ---------------- Bugfix Verification: post-consumer in materials ----------------
def test_post_consumer_recycled_materials_not_flagged_as_audience_term():
    """
    Verifies that 'post-consumer' in material descriptions (e.g. '70% post-consumer recycled plastic')
    is NOT incorrectly flagged as an audience terminology mismatch ('consumers' -> 'customers').
    """
    claim = "Our packaging uses 70% post-consumer recycled plastic."
    res = analyze_marketing_text(claim)
    terminology_violations = [f for f in res["findings"] if f["category"] == "RULE_VIOLATION" and "Terminology" in f["finding_type"]]
    assert len(terminology_violations) == 0, f"Expected no terminology violation for 'post-consumer', got: {terminology_violations}"


# ---------------- System Fallback & Diagnostic Status ----------------
def test_graceful_fallback_runtime_status():
    """
    Verifies runtime diagnostic status indicates active zero-dependency engine mode and memory isolation.
    """
    matcher = get_semantic_matcher()
    status = matcher.get_runtime_status()
    assert "model_identifier" in status
    assert "engine_mode" in status
    assert status["candidate_similarity_threshold"] == CANDIDATE_SIMILARITY_THRESHOLD
    assert status["memory_footprint"] == "<2MB RAM"
