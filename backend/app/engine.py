"""
BrandShield AI - Deterministic Verification Engine
Inspects marketing text against brand rules, verified evidence, and claim databases.
Categorizes findings into:
- RULE_VIOLATION: Direct violation of approved brand guidelines or compliance requirements.
- FACTUAL_CONTRADICTION: Confirmed conflict with verified engineering/clinical specifications.
- UNSUPPORTED_CLAIM: Unverified assertion lacking supporting evidence (not labeled as false).
"""

import re
import uuid
from typing import List, Dict, Any
from .rules_data import BRAND_PROFILE, BRAND_RULES, VERIFIED_FACTS, VERIFIED_CLAIM_EVIDENCE


def check_brand_rules(text: str) -> List[Dict[str, Any]]:
    """
    Checks for compliance with explicit brand rules.
    """
    findings = []
    text_lower = text.lower()

    # Rule 001: Medical Cure / Absolute Claims
    r1 = next(r for r in BRAND_RULES if r["rule_id"] == "RULE-001")
    for forbidden in r1["forbidden_terms"]:
        match = re.search(r"\b" + re.escape(forbidden) + r"\b", text, re.IGNORECASE)
        if match:
            findings.append({
                "id": str(uuid.uuid4())[:8],
                "category": "RULE_VIOLATION",
                "severity": r1["severity"],
                "rule_or_evidence_id": r1["rule_id"],
                "rule_title": r1["title"],
                "flagged_text": match.group(0),
                "issue": f"Forbidden absolute claim detected: '{match.group(0)}'",
                "explanation": r1["explanation"],
                "suggested_correction": r1["suggested_correction"]
            })

    # Rule 002: Mandatory FDA Disclaimer if health/disease words are present
    r2 = next(r for r in BRAND_RULES if r["rule_id"] == "RULE-002")
    has_health_trigger = any(re.search(r"\b" + re.escape(kw) + r"\b", text, re.IGNORECASE) for kw in r2["trigger_keywords"])
    disclaimer_present = (r2["required_disclaimer"].lower() in text_lower)
    if has_health_trigger and not disclaimer_present:
        findings.append({
            "id": str(uuid.uuid4())[:8],
            "category": "RULE_VIOLATION",
            "severity": r2["severity"],
            "rule_or_evidence_id": r2["rule_id"],
            "rule_title": r2["title"],
            "flagged_text": "(Document Scope)",
            "issue": "Missing mandatory FDA health disclaimer.",
            "explanation": r2["explanation"],
            "suggested_correction": r2["suggested_correction"]
        })

    # Rule 003: Brand Spelling & Capitalization
    r3 = next(r for r in BRAND_RULES if r["rule_id"] == "RULE-003")
    # Matches any variation of nova and pulse (separated by space, hyphen, or concatenated)
    for m in re.finditer(r"\bnova[- ]?pulse\b", text, re.IGNORECASE):
        if m.group(0) != "NovaPulse":
            findings.append({
                "id": str(uuid.uuid4())[:8],
                "category": "RULE_VIOLATION",
                "severity": r3["severity"],
                "rule_or_evidence_id": r3["rule_id"],
                "rule_title": r3["title"],
                "flagged_text": m.group(0),
                "issue": f"Incorrect brand name format: '{m.group(0)}'",
                "explanation": r3["explanation"],
                "suggested_correction": r3["suggested_correction"]
            })

    # Rule 004: Refund and Guarantee Windows
    r4 = next(r for r in BRAND_RULES if r["rule_id"] == "RULE-004")
    for term in r4["forbidden_terms"]:
        match = re.search(r"\b" + re.escape(term) + r"\b", text, re.IGNORECASE)
        if match:
            findings.append({
                "id": str(uuid.uuid4())[:8],
                "category": "RULE_VIOLATION",
                "severity": r4["severity"],
                "rule_or_evidence_id": r4["rule_id"],
                "rule_title": r4["title"],
                "flagged_text": match.group(0),
                "issue": f"Unauthorized refund/guarantee assertion: '{match.group(0)}'",
                "explanation": r4["explanation"],
                "suggested_correction": r4["suggested_correction"]
            })

    return findings


def check_factual_contradictions(text: str) -> List[Dict[str, Any]]:
    """
    Checks if claims contradict verified ground-truth hardware & clinical specs.
    """
    findings = []

    # Fact 001: Battery life (Verified max: 7 days)
    # Detect patterns like: 14 days battery, 10-day battery, battery lasts 12 days
    battery_matches = re.finditer(r"\b(\d+)\s*(?:-|to\s*)?(?:day|days)\b(?:\s*(?:of\s*)?battery)?", text, re.IGNORECASE)
    for bm in battery_matches:
        days = int(bm.group(1))
        # Check context: is this mentioning battery?
        start = max(0, bm.start() - 25)
        end = min(len(text), bm.end() + 25)
        context = text[start:end].lower()
        if "battery" in context or "charge" in context or "runtime" in context:
            if days > BRAND_PROFILE["official_specs"]["battery_life_days"]:
                f1 = next(f for f in VERIFIED_FACTS if f["fact_id"] == "FACT-001")
                findings.append({
                    "id": str(uuid.uuid4())[:8],
                    "category": "FACTUAL_CONTRADICTION",
                    "severity": "HIGH",
                    "rule_or_evidence_id": f1["fact_id"],
                    "rule_title": f1["topic"],
                    "flagged_text": bm.group(0),
                    "issue": f"Claimed battery life ({days} days) contradicts certified specification.",
                    "explanation": f"{f1['explanation']} Official spec: {f1['ground_truth']}",
                    "suggested_correction": f1["suggested_correction"]
                })

    # Fact 002: Water resistance (Verified: 50 meters / 5 ATM)
    # Detect patterns like: waterproof to 100m, 100 meters, 200m
    water_matches = re.finditer(r"\b(\d+)\s*(?:m|meters|meter)\b", text, re.IGNORECASE)
    for wm in water_matches:
        meters = int(wm.group(1))
        start = max(0, wm.start() - 30)
        end = min(len(text), wm.end() + 30)
        context = text[start:end].lower()
        if any(w in context for w in ["water", "submersible", "swimming", "diving", "depth", "waterproof", "water-resistant"]):
            if meters > BRAND_PROFILE["official_specs"]["water_resistance_meters"]:
                f2 = next(f for f in VERIFIED_FACTS if f["fact_id"] == "FACT-002")
                findings.append({
                    "id": str(uuid.uuid4())[:8],
                    "category": "FACTUAL_CONTRADICTION",
                    "severity": "HIGH",
                    "rule_or_evidence_id": f2["fact_id"],
                    "rule_title": f2["topic"],
                    "flagged_text": wm.group(0),
                    "issue": f"Claimed depth rating ({meters}m) contradicts hardware certification.",
                    "explanation": f"{f2['explanation']} Official spec: {f2['ground_truth']}",
                    "suggested_correction": f2["suggested_correction"]
                })

    # Fact 003: ECG sensor accuracy (Verified: 98.2%, never 100% or zero-error)
    acc_matches = re.finditer(r"\b(100%|100 percent|zero[- ]error|flawless)\s*(?:accurate|accuracy|precision)?\b", text, re.IGNORECASE)
    for am in acc_matches:
        start = max(0, am.start() - 30)
        end = min(len(text), am.end() + 30)
        context = text[start:end].lower()
        if any(w in context for w in ["ecg", "heart", "vital", "sensor", "reading", "pulse", "accuracy", "clinical"]):
            f3 = next(f for f in VERIFIED_FACTS if f["fact_id"] == "FACT-003")
            findings.append({
                "id": str(uuid.uuid4())[:8],
                "category": "FACTUAL_CONTRADICTION",
                "severity": "HIGH",
                "rule_or_evidence_id": f3["fact_id"],
                "rule_title": f3["topic"],
                "flagged_text": am.group(0),
                "issue": f"Claim of '{am.group(0)}' accuracy contradicts clinical trial NP-2025.",
                "explanation": f"{f3['explanation']} Ground truth: {f3['ground_truth']}",
                "suggested_correction": f3["suggested_correction"]
            })

    # Fact 004: Customer Count (Verified: 250,000 members, not millions)
    user_matches = re.finditer(r"\b(\d+)\s*(?:million|m)\s*(?:users|customers|members|subscribers)\b", text, re.IGNORECASE)
    for um in user_matches:
        f4 = next(f for f in VERIFIED_FACTS if f["fact_id"] == "FACT-004")
        findings.append({
            "id": str(uuid.uuid4())[:8],
            "category": "FACTUAL_CONTRADICTION",
            "severity": "MEDIUM",
            "rule_or_evidence_id": f4["fact_id"],
            "rule_title": f4["topic"],
            "flagged_text": um.group(0),
            "issue": f"Claim of '{um.group(0)}' conflicts with audited customer base.",
            "explanation": f"{f4['explanation']} Ground truth: {f4['ground_truth']}",
            "suggested_correction": f4["suggested_correction"]
        })

    return findings


def check_unsupported_claims(text: str) -> List[Dict[str, Any]]:
    """
    Detects quantitative or scientific performance claims that have no registered proof.
    CRITICAL RULE: Never label an unverified claim as false!
    """
    findings = []

    # Pattern: Specific percentage reductions or boosts (e.g. "reduces stress by 45%", "boosts sleep by 30%")
    metric_matches = re.finditer(r"\b(?:reduces|improves|boosts|increases|decreases|lowers|enhances)\s+([a-zA-Z\s]{2,25}?)\s+by\s+(\d+(?:\.\d+)?%)(?!\w)", text, re.IGNORECASE)
    for mm in metric_matches:
        matched_phrase = mm.group(0)
        # Check if this exact claim is whitelisted in registered evidence
        if not any(evidence.lower() in matched_phrase.lower() for evidence in VERIFIED_CLAIM_EVIDENCE):
            findings.append({
                "id": str(uuid.uuid4())[:8],
                "category": "UNSUPPORTED_CLAIM",
                "severity": "MEDIUM",
                "rule_or_evidence_id": "EVID-REQ-METRIC",
                "rule_title": "Quantitative Efficacy Claim Without Evidence",
                "flagged_text": matched_phrase,
                "issue": f"Unverified quantitative claim: '{matched_phrase}'",
                "explanation": (
                    "This claim asserts a specific statistical efficacy rate that is not registered in the approved "
                    "brand knowledge base. [Note: This claim is unverified, not proven false.]"
                ),
                "suggested_correction": (
                    f"Either link an approved peer-reviewed clinical trial, or replace with qualitative copy "
                    f"such as 'designed to support healthy {mm.group(1).strip()}'."
                )
            })

    # Pattern: Endorsements or physician stats (e.g. "recommended by 9 out of 10 doctors", "trusted by 500 cardiologists")
    endorse_matches = re.finditer(r"\b(?:recommended|trusted|prescribed)\s+by\s+(?:\d+\s+(?:out\s+of\s+\d+|percent|%|[a-zA-Z]+)|\d+)\s+(?:doctors|cardiologists|physicians|experts)\b", text, re.IGNORECASE)
    for em in endorse_matches:
        matched_phrase = em.group(0)
        if not any(evidence.lower() in matched_phrase.lower() for evidence in VERIFIED_CLAIM_EVIDENCE):
            findings.append({
                "id": str(uuid.uuid4())[:8],
                "category": "UNSUPPORTED_CLAIM",
                "severity": "HIGH",
                "rule_or_evidence_id": "EVID-REQ-ENDORSE",
                "rule_title": "Professional Endorsement Claim Lacks Source",
                "flagged_text": matched_phrase,
                "issue": f"Unverified professional endorsement: '{matched_phrase}'",
                "explanation": (
                    "Medical practitioner endorsement claims require documented survey methodology and verified panel records. "
                    "[Note: This claim is flagged as unverified; publish only after substantiation is attached.]"
                ),
                "suggested_correction": (
                    "Provide verified survey reference ID or remove the statistical endorsement."
                )
            })

    return findings


def analyze_marketing_text(text: str) -> Dict[str, Any]:
    """
    Main entry point for text verification.
    Runs all deterministic engines and compiles structured governance report.
    """
    if not text or not text.strip():
        return {
            "summary": {
                "total_findings": 0,
                "rule_violations": 0,
                "factual_contradictions": 0,
                "unsupported_claims": 0,
                "status": "CLEAN"
            },
            "findings": []
        }

    rule_violations = check_brand_rules(text)
    factual_contradictions = check_factual_contradictions(text)
    unsupported_claims = check_unsupported_claims(text)

    all_findings = rule_violations + factual_contradictions + unsupported_claims

    # Sort findings by severity (HIGH -> MEDIUM -> LOW)
    severity_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    all_findings.sort(key=lambda x: severity_order.get(x["severity"], 3))

    has_high_issues = any(f["severity"] == "HIGH" for f in all_findings)
    status = "ACTION_REQUIRED" if has_high_issues else ("WARNINGS_FOUND" if all_findings else "CLEAN")

    return {
        "summary": {
            "total_findings": len(all_findings),
            "rule_violations": len(rule_violations),
            "factual_contradictions": len(factual_contradictions),
            "unsupported_claims": len(unsupported_claims),
            "status": status
        },
        "findings": all_findings
    }
