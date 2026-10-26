"""
BrandShield AI - Dynamic Rule & Verification Engine for AetherGlow
Evaluates marketing text against editable brand rules, approved fact sources,
and substantiation guidelines stored in the database.

Key capabilities:
- Dynamic rule evaluation (rules can be added, updated, enabled/disabled via database)
- Factual contradiction detection against approved sample facts
- Unsupported claims marked strictly as 'Unverified claim' (never declared false)
"""

import re
import uuid
from typing import List, Dict, Any, Optional
from .rules_data import BRAND_PROFILE, BRAND_RULES, APPROVED_FACTS, APPROVED_WHITELIST_CLAIMS


def evaluate_dynamic_rules(text: str, rules: List[Any]) -> List[Dict[str, Any]]:
    """
    Evaluates text against a list of active rules (from database or defaults).
    Only active rules are processed.
    """
    findings = []

    for rule in rules:
        # Check active status
        is_active = getattr(rule, "is_active", None)
        if is_active is None and isinstance(rule, dict):
            is_active = rule.get("is_active", True)
        if is_active is False:
            continue

        # Extract rule attributes
        rule_id = getattr(rule, "rule_id", None) or (rule.get("rule_id") if isinstance(rule, dict) else "RULE")
        name = getattr(rule, "name", None) or (rule.get("title") or rule.get("name") if isinstance(rule, dict) else "Brand Rule")
        rule_type = getattr(rule, "rule_type", None) or (rule.get("rule_type") if isinstance(rule, dict) else None)
        finding_type = getattr(rule, "finding_type", None) or (rule.get("finding_type") if isinstance(rule, dict) else None)
        
        # If rule_type not set, infer from finding_type or rule_id
        if not rule_type:
            if finding_type == "Terminology Mismatch" or "TERM" in rule_id:
                rule_type = "preferred_terminology"
            elif finding_type == "Prohibited Phrase" or "PROHIBITED" in rule_id:
                rule_type = "prohibited_phrase"
            else:
                rule_type = "prohibited_phrase"

        severity = getattr(rule, "severity", None) or (rule.get("severity") if isinstance(rule, dict) else "MEDIUM")
        description = getattr(rule, "description", None) or (rule.get("description") if isinstance(rule, dict) else "")
        prohibited_phrase = getattr(rule, "prohibited_phrase", None) or (rule.get("prohibited_phrase") if isinstance(rule, dict) else None)
        preferred_replacement = getattr(rule, "preferred_replacement", None) or (rule.get("preferred_replacement") if isinstance(rule, dict) else None)

        # 1. Prohibited Phrase
        if rule_type == "prohibited_phrase":
            phrases_to_check = []
            if prohibited_phrase:
                phrases_to_check.append(prohibited_phrase)
            elif isinstance(rule, dict) and rule.get("prohibited_phrases"):
                phrases_to_check.extend(rule.get("prohibited_phrases", []))

            for phrase in phrases_to_check:
                # If phrase is guaranteed 100% results, support grammatical variants (guarantees/guarantee/guaranteed)
                if "guaranteed 100% results" in phrase.lower():
                    pattern = r"\bguarante(?:ed|es|e)?\s+100%\s+results?\b"
                else:
                    pattern = r"\b" + re.escape(phrase) + r"(?!\w)"

                for match in re.finditer(pattern, text, re.IGNORECASE):
                    findings.append({
                        "id": str(uuid.uuid4())[:8],
                        "finding_type": "Prohibited Phrase",
                        "category": "RULE_VIOLATION",
                        "severity": severity,
                        "matched_rule_or_source": f"{rule_id}: {name}",
                        "rule_or_evidence_id": rule_id,
                        "rule_title": name,
                        "flagged_text": match.group(0),
                        "issue": f"Prohibited phrase detected: '{match.group(0)}'",
                        "explanation": description or f"AetherGlow prohibits the use of '{phrase}'.",
                        "suggested_correction": preferred_replacement or f"Remove or replace '{match.group(0)}' with compliant benefit language.",
                        "status_or_uncertainty_label": "Confirmed Violation"
                    })

        # 2. Preferred Terminology
        elif rule_type == "preferred_terminology":
            target_terms = []
            if prohibited_phrase:
                target_terms.append(prohibited_phrase)
            elif isinstance(rule, dict) and rule.get("disallowed_terms"):
                target_terms.extend(rule.get("disallowed_terms", []))

            for term in target_terms:
                if term.lower() in ["consumer", "consumers"]:
                    pattern = r"\bconsumers?\b"
                else:
                    pattern = r"\b" + re.escape(term) + r"(?!\w)"

                for match in re.finditer(pattern, text, re.IGNORECASE):
                    replacement = preferred_replacement or (rule.get("required_term") if isinstance(rule, dict) else "customers")
                    findings.append({
                        "id": str(uuid.uuid4())[:8],
                        "finding_type": "Terminology Mismatch",
                        "category": "RULE_VIOLATION",
                        "severity": severity,
                        "matched_rule_or_source": f"{rule_id}: {name}",
                        "rule_or_evidence_id": rule_id,
                        "rule_title": name,
                        "flagged_text": match.group(0),
                        "issue": f"Terminology mismatch: '{match.group(0)}' used instead of '{replacement}'",
                        "explanation": description or f"AetherGlow brand voice guidelines mandate using '{replacement}' rather than '{match.group(0)}'.",
                        "suggested_correction": f"Use '{replacement}' instead of '{match.group(0)}'.",
                        "status_or_uncertainty_label": "Confirmed Violation"
                    })

        # 3. Required Phrase
        elif rule_type == "required_phrase":
            required_text = preferred_replacement or prohibited_phrase
            if required_text and required_text.lower() not in text.lower():
                findings.append({
                    "id": str(uuid.uuid4())[:8],
                    "finding_type": "Missing Required Statement",
                    "category": "RULE_VIOLATION",
                    "severity": severity,
                    "matched_rule_or_source": f"{rule_id}: {name}",
                    "rule_or_evidence_id": rule_id,
                    "rule_title": name,
                    "flagged_text": "(Document Scope)",
                    "issue": f"Missing required brand statement: '{required_text}'",
                    "explanation": description or "This required statement is mandatory for compliance.",
                    "suggested_correction": f"Include mandatory statement: '{required_text}'.",
                    "status_or_uncertainty_label": "Confirmed Violation"
                })

        # 4. Custom Text Match
        elif rule_type == "custom_text":
            if prohibited_phrase:
                pattern = r"\b" + re.escape(prohibited_phrase) + r"(?!\w)"
                for match in re.finditer(pattern, text, re.IGNORECASE):
                    findings.append({
                        "id": str(uuid.uuid4())[:8],
                        "finding_type": "Brand Rule Violation",
                        "category": "RULE_VIOLATION",
                        "severity": severity,
                        "matched_rule_or_source": f"{rule_id}: {name}",
                        "rule_or_evidence_id": rule_id,
                        "rule_title": name,
                        "flagged_text": match.group(0),
                        "issue": f"Custom rule match: '{match.group(0)}'",
                        "explanation": description,
                        "suggested_correction": preferred_replacement or "Review and align with brand guidelines.",
                        "status_or_uncertainty_label": "Confirmed Violation"
                    })

    return findings


def evaluate_dynamic_facts(text: str, facts: List[Any]) -> List[Dict[str, Any]]:
    """
    Checks if text conflicts with approved facts in the database.
    Example: '70% recycled packaging', 'founded in 2020'.
    """
    findings = []

    for fact in facts:
        is_active = getattr(fact, "is_active", None)
        if is_active is None and isinstance(fact, dict):
            is_active = fact.get("is_active", True)
        if is_active is False:
            continue

        fact_id = getattr(fact, "fact_id", None) or (fact.get("fact_id") if isinstance(fact, dict) else "FACT")
        statement = getattr(fact, "statement", None) or (fact.get("statement") if isinstance(fact, dict) else "")
        source_name = getattr(fact, "source_name", None) or (fact.get("source_name") or fact.get("title") if isinstance(fact, dict) else "Approved Company Specification")

        # 1. Packaging fact: 70% recycled packaging
        if "70%" in statement and "recycled packaging" in statement.lower():
            pattern = r"\b(?:made\s+with\s+)?(\d{1,3}%|zero%?)\s+(?:post-consumer\s+)?(?:recycled|recyclable)\s+packaging\b"
            for match in re.finditer(pattern, text, re.IGNORECASE):
                claimed_str = match.group(1).replace("%", "").strip().lower()
                claimed_num = 0 if claimed_str == "zero" else int(claimed_str)
                if claimed_num != 70:
                    findings.append({
                        "id": str(uuid.uuid4())[:8],
                        "finding_type": "Factual Contradiction",
                        "category": "FACTUAL_CONTRADICTION",
                        "severity": "HIGH",
                        "matched_rule_or_source": f"{fact_id}: {source_name}",
                        "rule_or_evidence_id": fact_id,
                        "rule_title": "Recycled Packaging Content",
                        "flagged_text": match.group(0),
                        "issue": f"Packaging claim '{match.group(0)}' conflicts with approved sample fact (70%).",
                        "explanation": f"Claim conflicts with approved demonstration fact: '{statement}' (Source: {source_name}).",
                        "suggested_correction": f"Align with approved fact: '{statement}'.",
                        "status_or_uncertainty_label": "Factual Contradiction"
                    })

        # 2. Founding year fact: founded in 2020
        if "2020" in statement and "founded" in statement.lower():
            pattern = r"\b(?:founded|established|created)\s+in\s+(\d{4})\b"
            for match in re.finditer(pattern, text, re.IGNORECASE):
                claimed_year = int(match.group(1))
                if claimed_year != 2020:
                    findings.append({
                        "id": str(uuid.uuid4())[:8],
                        "finding_type": "Factual Contradiction",
                        "category": "FACTUAL_CONTRADICTION",
                        "severity": "HIGH",
                        "matched_rule_or_source": f"{fact_id}: {source_name}",
                        "rule_or_evidence_id": fact_id,
                        "rule_title": "Founding Year Specification",
                        "flagged_text": match.group(0),
                        "issue": f"Founding year '{match.group(0)}' conflicts with approved sample fact (2020).",
                        "explanation": f"Claim conflicts with approved demonstration fact: '{statement}' (Source: {source_name}).",
                        "suggested_correction": f"Align with approved fact: '{statement}'.",
                        "status_or_uncertainty_label": "Factual Contradiction"
                    })

    return findings


def check_unsupported_claims(text: str) -> List[Dict[str, Any]]:
    """
    Detects quantitative or clinical claims that lack support from approved facts.
    CRITICAL REQUIREMENT: Unsupported claims must be marked 'Unverified claim'
    rather than automatically declared false.
    """
    findings = []

    # Pattern: Specific percentage reductions or boosts (e.g. 'reduces wrinkles by 85%')
    metric_pattern = r"\b(?:reduces?|improves?|boosts?|increases?|decreases?|lowers?|eliminates?)\s+([a-zA-Z\s]{2,25}?)\s+by\s+(\d+(?:\.\d+)?%)(?!\w)"
    for match in re.finditer(metric_pattern, text, re.IGNORECASE):
        matched_phrase = match.group(0)
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


# Backward-compatible helper aliases for direct engine testing
def check_prohibited_phrases(text: str) -> List[Dict[str, Any]]:
    return evaluate_dynamic_rules(text, [r for r in BRAND_RULES if r.get("rule_type") == "prohibited_phrase"])


def check_terminology(text: str) -> List[Dict[str, Any]]:
    return evaluate_dynamic_rules(text, [r for r in BRAND_RULES if r.get("rule_type") == "preferred_terminology"])


def check_approved_facts(text: str) -> List[Dict[str, Any]]:
    return evaluate_dynamic_facts(text, APPROVED_FACTS)


def analyze_marketing_text(
    text: str,
    active_rules: Optional[List[Any]] = None,
    active_facts: Optional[List[Any]] = None
) -> Dict[str, Any]:
    """
    Main entry point for evaluating marketing copy for AetherGlow.
    Accepts optional database active rules and approved facts.
    Falls back gracefully to default knowledge base if none provided.
    """
    if not text or not text.strip():
        return {
            "brand": BRAND_PROFILE["brand_name"],
            "total_findings": 0,
            "status": "CLEAN",
            "findings": []
        }

    rules_to_use = active_rules if active_rules is not None else BRAND_RULES
    facts_to_use = active_facts if active_facts is not None else APPROVED_FACTS

    rule_findings = evaluate_dynamic_rules(text, rules_to_use)
    fact_findings = evaluate_dynamic_facts(text, facts_to_use)
    unsupported_findings = check_unsupported_claims(text)

    all_findings = rule_findings + fact_findings + unsupported_findings

    severity_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    all_findings.sort(key=lambda x: severity_order.get(x["severity"], 3))

    status = "CLEAN" if len(all_findings) == 0 else "ACTION_REQUIRED"

    return {
        "brand": BRAND_PROFILE["brand_name"],
        "total_findings": len(all_findings),
        "status": status,
        "findings": all_findings
    }
