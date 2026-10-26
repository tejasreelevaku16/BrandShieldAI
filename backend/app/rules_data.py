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
        "title": "Prohibited Absolute Outcome Guarantee",
        "finding_type": "Prohibited Phrase",
        "severity": "HIGH",
        "description": "Never use the phrase 'guaranteed 100% results' or promise unconditional outcomes.",
        "prohibited_phrases": [
            "guaranteed 100% results",
            "guarantees 100% results",
            "guarantee 100% results",
            "100% guaranteed results",
            "guaranteed 100% result",
            "100% results guaranteed"
        ],
        "explanation": "AetherGlow strictly prohibits guaranteeing 100% results. Cosmetic and skincare outcomes vary by skin type and lifestyle, and absolute guarantees violate advertising standards.",
        "suggested_correction": "Replace with compliant benefit language such as 'formulated to deliver visible radiance and support healthy skin'.",
        "status_or_uncertainty_label": "Confirmed Violation"
    },
    {
        "rule_id": "RULE-TERM-01",
        "title": "Approved Audience Terminology",
        "finding_type": "Terminology Mismatch",
        "severity": "LOW",
        "description": "Always refer to our audience as 'customers', never as 'consumers'.",
        "disallowed_terms": [
            "consumers",
            "consumer"
        ],
        "required_term": "customers",
        "explanation": "AetherGlow brand voice guidelines mandate referring to our community as 'customers' rather than 'consumers' to foster personal relationships.",
        "suggested_correction": "Use 'customers' (or 'customer') instead of 'consumers'.",
        "status_or_uncertainty_label": "Confirmed Violation"
    }
]

# 2. Approved Ground-Truth Facts
APPROVED_FACTS: List[Dict[str, Any]] = [
    {
        "fact_id": "FACT-PKG-01",
        "title": "Recycled Packaging Content",
        "statement": "AetherGlow products are made with 70% recycled packaging.",
        "approved_value": 70,
        "unit": "%",
        "explanation": "AetherGlow supply chain specifications certify exactly 70% post-consumer recycled content for primary packaging. Conflicting claims violate verified product specifications.",
        "suggested_correction": "Align packaging claims with verified specification: 'AetherGlow products are made with 70% recycled packaging.'",
        "status_or_uncertainty_label": "Factual Contradiction"
    }
]

# 3. Approved Whitelisted Evidence (Claims registered with evidence)
APPROVED_WHITELIST_CLAIMS = [
    "70% recycled packaging",
    "dermatologist tested for sensitive skin",
    "cruelty-free certified by Leaping Bunny",
    "infused with botanical hyaluronic acid"
]
