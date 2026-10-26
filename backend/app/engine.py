"""
BrandShield AI - Deterministic Rule & Verification Engine for AetherGlow
Evaluates marketing text against approved brand rules, approved facts, and substantiation guidelines.

Distinguishes:
- Prohibited Phrases: Non-compliant absolute guarantees.
- Terminology Mismatches: Inconsistent audience naming.
- Factual Contradictions: Conflicting statements against approved technical/sustainability facts.
- Unsupported Claims: Unsubstantiated quantitative assertions, labeled strictly as 'Unverified claim' (never labeled false).
"""

import re
import uuid
from typing import List, Dict, Any
from .rules_data import BRAND_PROFILE, BRAND_RULES, APPROVED_FACTS, APPROVED_WHITELIST_CLAIMS


def check_prohibited_phrases(text: str) -> List[Dict[str, Any]]:
    """
    Detects prohibited phrases without case sensitivity.
    Example: 'guaranteed 100% results'
    """
    findings = []
    rule = next(r for r in BRAND_RULES if r["rule_id"] == "RULE-PROHIBITED-01")

    # Match exact prohibited phrases or slight grammatical variations
    for phrase in rule["prohibited_phrases"]:
        pattern = r"\b" + re.escape(phrase) + r"(?!\w)"
        for match in re.finditer(pattern, text, re.IGNORECASE):
            findings.append({
                "id": str(uuid.uuid4())[:8],
                "finding_type": rule["finding_type"],
                "category": "RULE_VIOLATION",
                "severity": rule["severity"],
                "matched_rule_or_source": f"{rule['rule_id']}: {rule['title']}",
                "rule_or_evidence_id": rule["rule_id"],
                "rule_title": rule["title"],
                "flagged_text": match.group(0),
                "issue": f"Prohibited phrase detected: '{match.group(0)}'",
                "explanation": rule["explanation"],
                "suggested_correction": rule["suggested_correction"],
                "status_or_uncertainty_label": rule["status_or_uncertainty_label"]
            })

    return findings


def check_terminology(text: str) -> List[Dict[str, Any]]:
    """
    Detects terminology mismatch: must use 'customers' instead of 'consumers'.
    Case-insensitive matching with whole word boundaries.
    """
    findings = []
    rule = next(r for r in BRAND_RULES if r["rule_id"] == "RULE-TERM-01")

    # Match 'consumer' or 'consumers'
    pattern = r"\bconsumers?\b"
    for match in re.finditer(pattern, text, re.IGNORECASE):
        findings.append({
            "id": str(uuid.uuid4())[:8],
            "finding_type": rule["finding_type"],
            "category": "RULE_VIOLATION",
            "severity": rule["severity"],
            "matched_rule_or_source": f"{rule['rule_id']}: {rule['title']}",
            "rule_or_evidence_id": rule["rule_id"],
            "rule_title": rule["title"],
            "flagged_text": match.group(0),
            "issue": f"Terminology mismatch: '{match.group(0)}' used instead of 'customers'",
            "explanation": rule["explanation"],
            "suggested_correction": rule["suggested_correction"],
            "status_or_uncertainty_label": rule["status_or_uncertainty_label"]
        })

    return findings


def check_approved_facts(text: str) -> List[Dict[str, Any]]:
    """
    Checks when submitted claims conflict with approved facts.
    Approved Fact: 'AetherGlow products are made with 70% recycled packaging.'
    Detects when packaging recycled percentage differs from 70%.
    """
    findings = []
    fact = next(f for f in APPROVED_FACTS if f["fact_id"] == "FACT-PKG-01")
    approved_pct = fact["approved_value"]

    # Detect claims like: '100% recycled packaging', '80% recycled packaging', '50% recycled packaging', 'zero recycled packaging'
    pattern = r"\b(?:made\s+with\s+)?(\d{1,3}%|zero%?)\s+(?:post-consumer\s+)?(?:recycled|recyclable)\s+packaging\b"
    for match in re.finditer(pattern, text, re.IGNORECASE):
        claimed_value_str = match.group(1).replace("%", "").strip().lower()
        claimed_num = 0 if claimed_value_str == "zero" else int(claimed_value_str)

        if claimed_num != approved_pct:
            findings.append({
                "id": str(uuid.uuid4())[:8],
                "finding_type": "Factual Contradiction",
                "category": "FACTUAL_CONTRADICTION",
                "severity": "HIGH",
                "matched_rule_or_source": f"{fact['fact_id']}: {fact['title']}",
                "rule_or_evidence_id": fact["fact_id"],
                "rule_title": fact["title"],
                "flagged_text": match.group(0),
                "issue": f"Packaging claim '{match.group(0)}' conflicts with approved fact ({approved_pct}%).",
                "explanation": fact["explanation"],
                "suggested_correction": fact["suggested_correction"],
                "status_or_uncertainty_label": fact["status_or_uncertainty_label"]
            })

    return findings


def check_unsupported_claims(text: str) -> List[Dict[str, Any]]:
    """
    Detects quantitative or clinical claims that lack support from approved facts.
    CRITICAL REQUIREMENT: Unsupported claims must be marked 'Unverified claim'
    rather than automatically declared false.
    """
    findings = []

    # Pattern: Specific percentage reductions or increases (e.g., 'reduces wrinkles by 85%', 'improves hydration by 90%')
    metric_pattern = r"\b(?:reduces?|improves?|boosts?|increases?|decreases?|lowers?|eliminates?)\s+([a-zA-Z\s]{2,25}?)\s+by\s+(\d+(?:\.\d+)?%)(?!\w)"
    for match in re.finditer(metric_pattern, text, re.IGNORECASE):
        matched_phrase = match.group(0)
        # Check if matched phrase is in approved whitelist
        if not any(evidence.lower() in matched_phrase.lower() for evidence in APPROVED_WHITELIST_CLAIMS):
            findings.append({
                "id": str(uuid.uuid4())[:8],
                "finding_type": "Unsupported Claim",
                "category": "UNSUPPORTED_CLAIM",
                "severity": "MEDIUM",
                "matched_rule_or_source": "EVID-REQ: Claim Substantiation Requirement",
                "rule_or_evidence_id": "EVID-REQ",
                "rule_title": "Quantitative Clinical Claim Lacks Registered Evidence",
                "flagged_text": matched_phrase,
                "issue": f"Unverified quantitative claim: '{matched_phrase}'",
                "explanation": (
                    "This statement asserts a specific quantitative efficacy rate that is not registered in the "
                    "AetherGlow approved facts library. Note: This claim is not declared false, but requires documented "
                    "clinical trial substantiation before publication."
                ),
                "suggested_correction": (
                    f"Attach registered clinical trial evidence, or soften to general lifestyle phrasing "
                    f"such as 'formulated to support healthy, glowing skin'."
                ),
                "status_or_uncertainty_label": "Unverified claim"
            })

    # Pattern: Endorsements or doctor survey stats (e.g. 'recommended by 9 out of 10 dermatologists')
    endorse_pattern = r"\b(?:recommended|trusted|prescribed)\s+by\s+(?:\d+\s+(?:out\s+of\s+\d+|percent|%|[a-zA-Z]+)|\d+)\s+(?:dermatologists|doctors|physicians|experts)\b"
    for match in re.finditer(endorse_pattern, text, re.IGNORECASE):
        matched_phrase = match.group(0)
        if not any(evidence.lower() in matched_phrase.lower() for evidence in APPROVED_WHITELIST_CLAIMS):
            findings.append({
                "id": str(uuid.uuid4())[:8],
                "finding_type": "Unsupported Claim",
                "category": "UNSUPPORTED_CLAIM",
                "severity": "HIGH",
                "matched_rule_or_source": "EVID-REQ: Professional Endorsement Substantiation",
                "rule_or_evidence_id": "EVID-REQ-ENDORSE",
                "rule_title": "Professional Endorsement Lacks Documented Survey",
                "flagged_text": matched_phrase,
                "issue": f"Unverified professional endorsement: '{matched_phrase}'",
                "explanation": (
                    "Medical practitioner endorsement claims require documented survey methodology and verified panel records. "
                    "Note: This claim is flagged as unverified, not declared false."
                ),
                "suggested_correction": "Provide verified survey reference ID or remove the statistical endorsement claim.",
                "status_or_uncertainty_label": "Unverified claim"
            })

    return findings


def analyze_marketing_text(text: str) -> Dict[str, Any]:
    """
    Main entry point for evaluating marketing copy for AetherGlow.
    Compiles all findings and sorts them by severity.
    """
    if not text or not text.strip():
        return {
            "brand": BRAND_PROFILE["brand_name"],
            "total_findings": 0,
            "status": "CLEAN",
            "findings": []
        }

    prohibited = check_prohibited_phrases(text)
    terminology = check_terminology(text)
    facts = check_approved_facts(text)
    unsupported = check_unsupported_claims(text)

    all_findings = prohibited + terminology + facts + unsupported

    severity_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    all_findings.sort(key=lambda x: severity_order.get(x["severity"], 3))

    status = "CLEAN" if len(all_findings) == 0 else "ACTION_REQUIRED"

    return {
        "brand": BRAND_PROFILE["brand_name"],
        "total_findings": len(all_findings),
        "status": status,
        "findings": all_findings
    }
