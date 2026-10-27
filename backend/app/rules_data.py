"""
Brand Knowledge Base for AetherGlow
Contains approved brand guidelines, verified ground-truth facts, and terminology rules.
"""

from typing import List, Dict, Any

BRAND_PROFILE: Dict[str, Any] = {
    "brand_name": "AetherGlow",
    "legal_entity": "AetherGlow Skincare & Wellness Inc.",
    "industry": "Clean Skincare & Sustainable Wellness",
    "tagline": "Every Claim. Clear Evidence. Confident Publishing.",
    "approved_facts": {
        "packaging": {
            "source_id": "FACT-PKG-01",
            "fact_title": "Sustainable Recycled Packaging",
            "statement": "AetherGlow products are made with 70% recycled packaging.",
            "approved_recycled_percentage": 70
        }
    }
}

# 1. Approved Brand Rules
BRAND_RULES: List[Dict[str, Any]] = [
    {
        "rule_id": "RULE-PROHIBITED-01",
        "name": "Prohibited Absolute Outcome Guarantee",
        "title": "Prohibited Absolute Outcome Guarantee",
        "rule_type": "prohibited_phrase",
        "finding_type": "Prohibited Phrase",
        "severity": "HIGH",
        "description": "Never use the phrase 'guaranteed 100% results' or promise unconditional outcomes.",
        "prohibited_phrase": "guaranteed 100% results",
        "prohibited_phrases": [
            "guaranteed 100% results",
            "guarantees 100% results",
            "guarantee 100% results",
            "100% guaranteed results",
            "guaranteed 100% result",
            "100% results guaranteed"
        ],
        "preferred_replacement": "formulated to deliver visible radiance and support healthy skin",
        "explanation": "AetherGlow strictly prohibits guaranteeing 100% results. Cosmetic and skincare outcomes vary by skin type and lifestyle, and absolute guarantees violate advertising standards.",
        "suggested_correction": "Replace with compliant benefit language such as 'formulated to deliver visible radiance and support healthy skin'.",
        "status_or_uncertainty_label": "Confirmed Violation",
        "is_active": True
    },
    {
        "rule_id": "RULE-TERM-01",
        "name": "Approved Audience Terminology",
        "title": "Approved Audience Terminology",
        "rule_type": "preferred_terminology",
        "finding_type": "Terminology Mismatch",
        "severity": "LOW",
        "description": "Always refer to our audience as 'customers', never as 'consumers'.",
        "prohibited_phrase": "consumers",
        "disallowed_terms": [
            "consumers",
            "consumer"
        ],
        "preferred_replacement": "customers",
        "required_term": "customers",
        "explanation": "AetherGlow brand voice guidelines mandate referring to our community as 'customers' rather than 'consumers' to foster personal relationships.",
        "suggested_correction": "Use 'customers' (or 'customer') instead of 'consumers'.",
        "status_or_uncertainty_label": "Confirmed Violation",
        "is_active": True
    }
]

# 2. Approved Ground-Truth Facts
APPROVED_FACTS: List[Dict[str, Any]] = [
    {
        "fact_id": "FACT-PKG-01",
        "title": "Recycled Packaging Content",
        "statement": "AetherGlow products are made with 70% recycled packaging.",
        "source_name": "AetherGlow sample brand facts",
        "approved_value": 70,
        "unit": "%",
        "explanation": "AetherGlow supply chain specifications certify exactly 70% post-consumer recycled content for primary packaging. Conflicting claims violate verified product specifications.",
        "suggested_correction": "Align packaging claims with verified specification: 'AetherGlow products are made with 70% recycled packaging.'",
        "status_or_uncertainty_label": "Factual Contradiction",
        "is_active": True
    },
    {
        "fact_id": "FACT-FND-01",
        "title": "Founding Year Specification",
        "statement": "AetherGlow was founded in 2020.",
        "source_name": "Corporate Registry Certificate (Delaware)",
        "approved_value": 2020,
        "unit": "year",
        "explanation": "Corporate charter records confirm AetherGlow was founded in 2020. Conflicting founding dates violate verified corporate history.",
        "suggested_correction": "Align founding statement with verified fact: 'AetherGlow was founded in 2020.'",
        "status_or_uncertainty_label": "Factual Contradiction",
        "is_active": True
    }
]

# 3. Approved Whitelisted Evidence (Claims registered with verified evidence)
APPROVED_WHITELIST_CLAIMS = [
    "70% recycled packaging",
    "dermatologist tested for sensitive skin",
    "cruelty-free certified by Leaping Bunny",
    "infused with botanical hyaluronic acid"
]
