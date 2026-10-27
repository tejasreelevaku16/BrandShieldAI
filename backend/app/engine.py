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


def phrase_to_regex(phrase: str) -> str:
    """Converts a phrase to a regex matching case-insensitively with flexible whitespace and word boundaries."""
    words = phrase.strip().split()
    if not words:
        return ""
    lower_words = [w.lower() for w in words]
    if any("guarante" in w for w in lower_words) and "100%" in lower_words and any("result" in w for w in lower_words):
        return r"\bguarante(?:ed|es|e|ing)?\s+100%\s+results?\b"

    escaped_words = [re.escape(w) for w in words]
    start_bound = r"\b" if re.match(r"^\w", words[0]) else r"(?<!\w)"
    end_bound = r"\b" if re.search(r"\w$", words[-1]) else r"(?!\w)"
    return start_bound + r"\s+".join(escaped_words) + end_bound


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
            if finding_type == "Terminology Mismatch" or "TERM" in rule_id.upper():
                rule_type = "preferred_terminology"
            elif finding_type == "Prohibited Phrase" or "PROHIBITED" in rule_id.upper():
                rule_type = "prohibited_phrase"
            else:
                rule_type = "prohibited_phrase"
        else:
            rule_type = str(rule_type).strip().lower()

        severity_raw = getattr(rule, "severity", None) or (rule.get("severity") if isinstance(rule, dict) else "MEDIUM")
        severity = (severity_raw or "MEDIUM").strip().upper()
        description = getattr(rule, "description", None) or (rule.get("description") if isinstance(rule, dict) else "")
        prohibited_phrase = getattr(rule, "prohibited_phrase", None) or (rule.get("prohibited_phrase") if isinstance(rule, dict) else None)
        preferred_replacement = getattr(rule, "preferred_replacement", None) or (rule.get("preferred_replacement") if isinstance(rule, dict) else None)

        # 1. Prohibited Phrase (Rule A)
        if rule_type in ["prohibited_phrase", "prohibited", "prohibited_terms"]:
            phrases_to_check = []
            if prohibited_phrase:
                phrases_to_check.append(prohibited_phrase)
            elif isinstance(rule, dict) and rule.get("prohibited_phrases"):
                phrases_to_check.extend(rule.get("prohibited_phrases", []))

            for phrase in phrases_to_check:
                phrase_clean = str(phrase).strip()
                if not phrase_clean:
                    continue

                pattern = phrase_to_regex(phrase_clean)
                if not pattern:
                    continue

                for match in re.finditer(pattern, text, re.IGNORECASE):
                    matched_str = match.group(0).strip()
                    findings.append({
                        "id": str(uuid.uuid4())[:8],
                        "finding_type": "Prohibited Phrase",
                        "type": "Prohibited Phrase",
                        "category": "RULE_VIOLATION",
                        "severity": severity,
                        "matched_rule_or_source": f"{rule_id}: {name}",
                        "source": f"{rule_id}: {name}",
                        "rule_or_evidence_id": rule_id,
                        "rule_title": name,
                        "flagged_text": matched_str,
                        "matched_text": matched_str,
                        "issue": f"Prohibited phrase detected: '{matched_str}'",
                        "explanation": description or f"AetherGlow prohibits the use of '{phrase_clean}'.",
                        "suggested_correction": preferred_replacement or f"Remove or replace '{matched_str}' with compliant benefit language.",
                        "status_or_uncertainty_label": "Confirmed Violation",
                        "status": "Confirmed Violation",
                        "start_offset": match.start(),
                        "end_offset": match.end()
                    })

        # 2. Preferred Terminology (Rule B)
        elif rule_type in ["preferred_terminology", "terminology", "disallowed_terms"]:
            target_terms = []
            if prohibited_phrase:
                target_terms.append(prohibited_phrase)
            elif isinstance(rule, dict) and rule.get("disallowed_terms"):
                target_terms.extend(rule.get("disallowed_terms", []))

            for term in target_terms:
                term_clean = str(term).strip()
                if not term_clean:
                    continue
                # Match whole words so unrelated words (e.g. 'consuming', 'consumerism', 'post-consumer') are not flagged
                if term_clean.lower() in ["consumer", "consumers"]:
                    pattern = r"(?<![\w-])consumers?(?![\w-])"
                else:
                    start_bound = r"\b" if re.match(r"^\w", term_clean) else r"(?<!\w)"
                    end_bound = r"\b" if re.search(r"\w$", term_clean) else r"(?!\w)"
                    pattern = start_bound + re.escape(term_clean) + end_bound

                for match in re.finditer(pattern, text, re.IGNORECASE):
                    matched_str = match.group(0).strip()
                    replacement = preferred_replacement or (rule.get("required_term") if isinstance(rule, dict) else "customers")
                    findings.append({
                        "id": str(uuid.uuid4())[:8],
                        "finding_type": "Terminology Mismatch",
                        "type": "Terminology Mismatch",
                        "category": "RULE_VIOLATION",
                        "severity": severity,
                        "matched_rule_or_source": f"{rule_id}: {name}",
                        "source": f"{rule_id}: {name}",
                        "rule_or_evidence_id": rule_id,
                        "rule_title": name,
                        "flagged_text": matched_str,
                        "matched_text": matched_str,
                        "issue": f"Terminology mismatch: '{matched_str}' used instead of '{replacement}'",
                        "explanation": description or f"AetherGlow brand voice guidelines mandate using '{replacement}' rather than '{matched_str}'.",
                        "suggested_correction": f"Use '{replacement}' instead of '{matched_str}'.",
                        "status_or_uncertainty_label": "Confirmed Violation",
                        "status": "Confirmed Violation",
                        "start_offset": match.start(),
                        "end_offset": match.end()
                    })

        # 3. Required Phrase
        elif rule_type == "required_phrase":
            required_text = preferred_replacement or prohibited_phrase
            if required_text and required_text.lower() not in text.lower():
                findings.append({
                    "id": str(uuid.uuid4())[:8],
                    "finding_type": "Missing Required Statement",
                    "type": "Missing Required Statement",
                    "category": "RULE_VIOLATION",
                    "severity": severity,
                    "matched_rule_or_source": f"{rule_id}: {name}",
                    "source": f"{rule_id}: {name}",
                    "rule_or_evidence_id": rule_id,
                    "rule_title": name,
                    "flagged_text": "(Document Scope)",
                    "matched_text": "(Document Scope)",
                    "issue": f"Missing required brand statement: '{required_text}'",
                    "explanation": description or "This required statement is mandatory for compliance.",
                    "suggested_correction": f"Include mandatory statement: '{required_text}'.",
                    "status_or_uncertainty_label": "Confirmed Violation",
                    "status": "Confirmed Violation",
                    "start_offset": None,
                    "end_offset": None
                })

        # 4. Custom Text Match
        elif rule_type == "custom_text":
            if prohibited_phrase:
                words = str(prohibited_phrase).strip().split()
                pattern = r"\b" + r"\s+".join(map(re.escape, words)) + r"(?!\w)"
                for match in re.finditer(pattern, text, re.IGNORECASE):
                    matched_str = match.group(0).strip()
                    findings.append({
                        "id": str(uuid.uuid4())[:8],
                        "finding_type": "Brand Rule Violation",
                        "type": "Brand Rule Violation",
                        "category": "RULE_VIOLATION",
                        "severity": severity,
                        "matched_rule_or_source": f"{rule_id}: {name}",
                        "source": f"{rule_id}: {name}",
                        "rule_or_evidence_id": rule_id,
                        "rule_title": name,
                        "flagged_text": matched_str,
                        "matched_text": matched_str,
                        "issue": f"Custom rule match: '{matched_str}'",
                        "explanation": description,
                        "suggested_correction": preferred_replacement or "Review and align with brand guidelines.",
                        "status_or_uncertainty_label": "Confirmed Violation",
                        "status": "Confirmed Violation",
                        "start_offset": match.start(),
                        "end_offset": match.end()
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
        source_name = getattr(fact, "source_name", None) or (fact.get("source_name") or fact.get("title") if isinstance(fact, dict) else "AetherGlow sample brand facts")

        # 1. Packaging fact: 70% recycled packaging (Fact A)
        if "70%" in statement and "recycled packaging" in statement.lower():
            # Matches packaging claims such as:
            # - 'all bottles are made with 100% recycled packaging'
            # - 'made with 100% recycled packaging'
            # - 'each bottle is made with 100% recycled packaging'
            # - '100% recycled packaging'
            pattern = (
                r"\b(?:(?:all|each|every|our)?\s*(?:bottles?|products?|packaging)\s+(?:are|is)\s+made\s+with\s+|made\s+with\s+)?"
                r"(\d{1,3}%|zero%?)\s+(?:post-consumer\s+)?"
                r"(?:recycled|recyclable)\s+(?:packaging|bottles|materials)\b"
            )
            for match in re.finditer(pattern, text, re.IGNORECASE):
                claimed_str = match.group(1).replace("%", "").strip().lower()
                claimed_num = 0 if claimed_str == "zero" else int(claimed_str)
                if claimed_num != 70:
                    matched_str = match.group(0).strip()
                    findings.append({
                        "id": str(uuid.uuid4())[:8],
                        "finding_type": "Factual Contradiction",
                        "type": "Factual Contradiction",
                        "category": "FACTUAL_CONTRADICTION",
                        "severity": "HIGH",
                        "matched_rule_or_source": f"{fact_id}: {source_name}",
                        "source": f"{fact_id}: {source_name}",
                        "rule_or_evidence_id": fact_id,
                        "rule_title": "Recycled Packaging Content",
                        "flagged_text": matched_str,
                        "matched_text": matched_str,
                        "issue": f"Packaging claim '{matched_str}' conflicts with approved sample fact (70%).",
                        "explanation": f"Claim conflicts with approved demonstration fact: '{statement}' (Source: {source_name}).",
                        "suggested_correction": f"Align packaging claim with approved fact: '{statement}'.",
                        "status_or_uncertainty_label": "Factual Contradiction",
                        "status": "Factual Contradiction",
                        "start_offset": match.start(),
                        "end_offset": match.end()
                    })

        # 2. Founding year fact: founded in 2020
        if "2020" in statement and "founded" in statement.lower():
            pattern = r"\b(?:founded|established|created)\s+in\s+(\d{4})\b"
            for match in re.finditer(pattern, text, re.IGNORECASE):
                claimed_year = int(match.group(1))
                if claimed_year != 2020:
                    matched_str = match.group(0).strip()
                    findings.append({
                        "id": str(uuid.uuid4())[:8],
                        "finding_type": "Factual Contradiction",
                        "type": "Factual Contradiction",
                        "category": "FACTUAL_CONTRADICTION",
                        "severity": "HIGH",
                        "matched_rule_or_source": f"{fact_id}: {source_name}",
                        "source": f"{fact_id}: {source_name}",
                        "rule_or_evidence_id": fact_id,
                        "rule_title": "Founding Year Specification",
                        "flagged_text": matched_str,
                        "matched_text": matched_str,
                        "issue": f"Founding year '{matched_str}' conflicts with approved sample fact (2020).",
                        "explanation": f"Claim conflicts with approved demonstration fact: '{statement}' (Source: {source_name}).",
                        "suggested_correction": f"Align with approved fact: '{statement}'.",
                        "status_or_uncertainty_label": "Factual Contradiction",
                        "status": "Factual Contradiction",
                        "start_offset": match.start(),
                        "end_offset": match.end()
                    })

    return findings


def check_unsupported_claims(text: str) -> List[Dict[str, Any]]:
    """
    Detects quantitative or clinical claims that lack support from approved facts (Claim B).
    CRITICAL REQUIREMENT: Unsupported claims must be labeled 'Unverified'
    rather than automatically declared false.
    """
    findings = []

    # Pattern: Specific percentage reductions or boosts (e.g. 'reduces wrinkles by 85%' or 'reduces wrinkles by 85% in just 48 hours')
    metric_pattern = (
        r"\b(?:reduces?|improves?|boosts?|increases?|decreases?|lowers?|eliminates?)\s+"
        r"([a-zA-Z\s]{2,25}?)\s+by\s+(\d+(?:\.\d+)?%)"
        r"(?:\s+(?:in|within)\s+(?:just\s+)?\d+\s+(?:hours?|days?|weeks?|months?))?"
    )
    for match in re.finditer(metric_pattern, text, re.IGNORECASE):
        matched_phrase = match.group(0).strip()
        if not any(evidence.lower() in matched_phrase.lower() for evidence in APPROVED_WHITELIST_CLAIMS):
            findings.append({
                "id": str(uuid.uuid4())[:8],
                "finding_type": "Unsupported Claim",
                "type": "Unsupported Claim",
                "category": "UNSUPPORTED_CLAIM",
                "severity": "MEDIUM",
                "matched_rule_or_source": "EVID-REQ: Claim Substantiation Requirement",
                "source": "EVID-REQ: Claim Substantiation Requirement",
                "rule_or_evidence_id": "EVID-REQ",
                "rule_title": "Quantitative Performance Claim Lacks Registered Evidence",
                "flagged_text": matched_phrase,
                "matched_text": matched_phrase,
                "issue": f"Unverified quantitative claim: '{matched_phrase}'",
                "explanation": (
                    f"The claim '{matched_phrase}' asserts a specific quantitative performance claim that is not registered "
                    "in the AetherGlow approved facts library. Note: This claim is flagged as unverified (not declared false), "
                    "but requires documented clinical trial substantiation before publication."
                ),
                "suggested_correction": (
                    "Attach registered clinical trial evidence, or soften to general lifestyle phrasing "
                    "such as 'formulated to support healthy, glowing skin'."
                ),
                "status_or_uncertainty_label": "Unverified claim",
                "status": "Unverified",
                "start_offset": match.start(),
                "end_offset": match.end()
            })

    # Pattern: Endorsements or doctor survey stats (e.g. 'recommended by 9 out of 10 dermatologists')
    endorse_pattern = r"\b(?:recommended|trusted|prescribed)\s+by\s+(?:\d+\s+(?:out\s+of\s+\d+|percent|%|[a-zA-Z]+)|\d+)\s+(?:dermatologists|doctors|physicians|experts)\b"
    for match in re.finditer(endorse_pattern, text, re.IGNORECASE):
        matched_phrase = match.group(0).strip()
        if not any(evidence.lower() in matched_phrase.lower() for evidence in APPROVED_WHITELIST_CLAIMS):
            findings.append({
                "id": str(uuid.uuid4())[:8],
                "finding_type": "Unsupported Claim",
                "type": "Unsupported Claim",
                "category": "UNSUPPORTED_CLAIM",
                "severity": "HIGH",
                "matched_rule_or_source": "EVID-REQ: Professional Endorsement Substantiation",
                "source": "EVID-REQ: Professional Endorsement Substantiation",
                "rule_or_evidence_id": "EVID-REQ-ENDORSE",
                "rule_title": "Professional Endorsement Lacks Documented Survey",
                "flagged_text": matched_phrase,
                "matched_text": matched_phrase,
                "issue": f"Unverified professional endorsement: '{matched_phrase}'",
                "explanation": (
                    "Medical practitioner endorsement claims require documented survey methodology and verified panel records. "
                    "Note: This claim is flagged as unverified (not declared false)."
                ),
                "suggested_correction": "Provide verified survey reference ID or remove the statistical endorsement claim.",
                "status_or_uncertainty_label": "Unverified claim",
                "status": "Unverified",
                "start_offset": match.start(),
                "end_offset": match.end()
            })

    # Pattern: Unsubstantiated clinical / scientific proof claims (e.g. '100% clinically proven')
    clinical_pattern = r"\b(?:(?:100%|completely|scientifically|medically)\s+)?clinically\s+(?:proven|tested|verified|backed)\b"
    for match in re.finditer(clinical_pattern, text, re.IGNORECASE):
        matched_phrase = match.group(0).strip()
        if not any(evidence.lower() in matched_phrase.lower() for evidence in APPROVED_WHITELIST_CLAIMS):
            findings.append({
                "id": str(uuid.uuid4())[:8],
                "finding_type": "Unsupported Claim",
                "type": "Unsupported Claim",
                "category": "UNSUPPORTED_CLAIM",
                "severity": "HIGH",
                "matched_rule_or_source": "EVID-REQ: Clinical Substantiation Standard",
                "source": "EVID-REQ: Clinical Substantiation Standard",
                "rule_or_evidence_id": "EVID-CLINICAL",
                "rule_title": "Clinical Efficacy Assertion Lacks Registered Study",
                "flagged_text": matched_phrase,
                "matched_text": matched_phrase,
                "issue": f"Unverified clinical efficacy claim: '{matched_phrase}'",
                "explanation": (
                    f"The claim '{matched_phrase}' asserts clinical efficacy. Under AetherGlow advertising standards, "
                    "such assertions are marked as Unverified (not declared false) until documented clinical trial evidence is registered."
                ),
                "suggested_correction": (
                    "Replace with substantiated phrasing such as 'dermatologist tested for sensitive skin' "
                    "or cite documented clinical trial protocol."
                ),
                "status_or_uncertainty_label": "Unverified claim",
                "status": "Unverified",
                "start_offset": match.start(),
                "end_offset": match.end()
            })

    # Pattern: Universal efficacy promises (e.g. 'guaranteed to work for everyone')
    universal_pattern = r"\b(?:guaranteed\s+to\s+work\s+for\s+(?:everyone|all\s+skin\s+types|anyone)|works?\s+for\s+(?:everyone|all\s+skin\s+types))\b"
    for match in re.finditer(universal_pattern, text, re.IGNORECASE):
        matched_phrase = match.group(0).strip()
        if not any(evidence.lower() in matched_phrase.lower() for evidence in APPROVED_WHITELIST_CLAIMS):
            findings.append({
                "id": str(uuid.uuid4())[:8],
                "finding_type": "Unsupported Claim",
                "type": "Unsupported Claim",
                "category": "UNSUPPORTED_CLAIM",
                "severity": "HIGH",
                "matched_rule_or_source": "EVID-REQ: Universal Performance Substantiation",
                "source": "EVID-REQ: Universal Performance Substantiation",
                "rule_or_evidence_id": "EVID-UNIVERSAL",
                "rule_title": "Universal Guarantee Lacks Demographic Substantiation",
                "flagged_text": matched_phrase,
                "matched_text": matched_phrase,
                "issue": f"Unverified universal performance claim: '{matched_phrase}'",
                "explanation": (
                    f"The claim '{matched_phrase}' asserts universal efficacy across all individuals. Cosmetic outcomes vary by "
                    "individual biology; this claim is labeled Unverified without verified broad-demographic panel evidence."
                ),
                "suggested_correction": (
                    "Soften to 'formulated for multiple skin types' or 'tested on a wide range of skin types'."
                ),
                "status_or_uncertainty_label": "Unverified claim",
                "status": "Unverified",
                "start_offset": match.start(),
                "end_offset": match.end()
            })

    return findings


# Backward-compatible helper aliases for direct engine testing
def check_prohibited_phrases(text: str) -> List[Dict[str, Any]]:
    return evaluate_dynamic_rules(text, [r for r in BRAND_RULES if r.get("rule_type") == "prohibited_phrase"])


def check_terminology(text: str) -> List[Dict[str, Any]]:
    return evaluate_dynamic_rules(text, [r for r in BRAND_RULES if r.get("rule_type") in ["preferred_terminology", "terminology"]])


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
    Deduplicates findings to avoid duplicate cards for identical spans.
    """
    if not text or not text.strip():
        return {
            "brand": BRAND_PROFILE["brand_name"],
            "total_findings": 0,
            "status": "CLEAN",
            "message": "No brand governance issues or contradictory claims detected.",
            "findings": []
        }

    rules_to_use = active_rules if active_rules is not None else BRAND_RULES
    facts_to_use = active_facts if active_facts is not None else APPROVED_FACTS

    rule_findings = evaluate_dynamic_rules(text, rules_to_use)
    fact_findings = evaluate_dynamic_facts(text, facts_to_use)
    unsupported_findings = check_unsupported_claims(text)

    # Pretrained semantic similarity & evidence candidate verification
    try:
        from .semantic_matcher import get_semantic_matcher
        semantic_findings = get_semantic_matcher().evaluate_semantic_claims(text, facts_to_use)
    except Exception:
        semantic_findings = []

    all_findings = rule_findings + fact_findings + unsupported_findings + semantic_findings

    severity_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    all_findings.sort(key=lambda x: severity_order.get(x.get("severity", "LOW"), 3))

    # Deduplication: remove redundant findings covering the exact same matched span or issue
    deduped_findings = []
    seen_spans = set()
    for f in all_findings:
        s = f.get("start_offset")
        e = f.get("end_offset")
        text_key = (f.get("flagged_text") or f.get("matched_text") or "").strip().lower()
        rule_key = f.get("rule_or_evidence_id", "")
        cat = f.get("category", "")

        is_duplicate = False
        if s is not None and e is not None:
            span_key = (s, e, text_key)
            if span_key in seen_spans:
                continue
            seen_spans.add(span_key)

            # Check for overlapping spans for the same category or rule evidence ID
            for existing in deduped_findings:
                es = existing.get("start_offset")
                ee = existing.get("end_offset")
                er = existing.get("rule_or_evidence_id")
                ec = existing.get("category")
                if es is not None and ee is not None:
                    # Spans overlap if s < ee and es < e
                    if s < ee and es < e:
                        if er == rule_key or (ec == cat and cat == "FACTUAL_CONTRADICTION"):
                            is_duplicate = True
                            # Enrich existing finding with semantic candidate info if available
                            if f.get("semantic_match_info") and not existing.get("semantic_match_info"):
                                existing["semantic_match_info"] = f["semantic_match_info"]
                            break
        else:
            doc_key = (cat, rule_key, text_key)
            if doc_key in seen_spans:
                continue
            seen_spans.add(doc_key)

        if not is_duplicate:
            deduped_findings.append(f)

    rule_v_count = sum(1 for f in deduped_findings if f.get("category") == "RULE_VIOLATION")
    fact_c_count = sum(1 for f in deduped_findings if f.get("category") == "FACTUAL_CONTRADICTION")
    unsup_c_count = sum(1 for f in deduped_findings if f.get("category") == "UNSUPPORTED_CLAIM")

    if len(deduped_findings) == 0:
        status = "CLEAN"
        message = "No brand governance issues or contradictory claims detected by current active rules. (Note: Always verify novel technical claims prior to publication)."
    else:
        status = "ACTION_REQUIRED"
        breakdown = []
        if rule_v_count:
            breakdown.append(f"{rule_v_count} guideline violation{'s' if rule_v_count > 1 else ''}")
        if fact_c_count:
            breakdown.append(f"{fact_c_count} potential factual contradiction{'s' if fact_c_count > 1 else ''}")
        if unsup_c_count:
            breakdown.append(f"{unsup_c_count} unverified claim{'s' if unsup_c_count > 1 else ''}")
        message = f"{len(deduped_findings)} issue{'s' if len(deduped_findings) > 1 else ''} detected ({', '.join(breakdown)})."

    summary_data = {
        "total_findings": len(deduped_findings),
        "rule_violations": rule_v_count,
        "factual_contradictions": fact_c_count,
        "unsupported_claims": unsup_c_count,
        "status": status,
        "summary_text": message
    }

    return {
        "brand": BRAND_PROFILE["brand_name"],
        "total_findings": len(deduped_findings),
        "status": status,
        "message": message,
        "summary": summary_data,
        "findings": deduped_findings
    }
