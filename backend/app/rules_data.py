"""
Brand Knowledge Base for NovaPulse Health Technologies
Contains approved brand guidelines, verified ground-truth facts, and regulatory constraints.
"""

from typing import List, Dict, Any

BRAND_PROFILE = {
    "brand_name": "NovaPulse",
    "legal_entity": "NovaPulse Health Technologies Inc.",
    "industry": "Consumer Health-Tech & Wearables",
    "tagline": "Precision Wellness & Continuous Vital Monitoring",
    "official_specs": {
        "battery_life_days": 7,
        "water_resistance_meters": 50,
        "ecg_correlation_accuracy": 98.2,
        "verified_active_members": 250000,
        "refund_policy_days": 30
    }
}

# 1. Official Brand Governance Rules
BRAND_RULES: List[Dict[str, Any]] = [
    {
        "rule_id": "RULE-001",
        "title": "Prohibited Absolute Medical & Cure Claims",
        "category": "RULE_VIOLATION",
        "severity": "HIGH",
        "description": "Never claim the device cures, eliminates, or guarantees 100% prevention of any medical condition.",
        "forbidden_terms": [
            "100% cure",
            "cures insomnia",
            "cures anxiety",
            "miracle device",
            "miracle cure",
            "guarantees you will never get sick",
            "eliminates heart disease",
            "100% disease prevention"
        ],
        "explanation": "Absolute medical claims violate FTC/FDA health marketing regulations and brand trust guidelines.",
        "suggested_correction": "Replace absolute cure language with supportive lifestyle language such as 'supports healthy sleep habits' or 'helps track key cardiovascular trends'."
    },
    {
        "rule_id": "RULE-002",
        "title": "Mandatory Health Disclaimer Requirement",
        "category": "RULE_VIOLATION",
        "severity": "HIGH",
        "description": "Any copy discussing symptoms, diagnostic tracking, or clinical vitals must include the approved regulatory disclaimer.",
        "trigger_keywords": ["diagnose", "treatment", "disease", "clinical symptom", "heart condition"],
        "required_disclaimer": "These statements have not been evaluated by the FDA. This product is not intended to diagnose, treat, cure, or prevent any disease.",
        "explanation": "Consumer wellness devices are not prescription medical devices without specific cleared indications.",
        "suggested_correction": "Append the approved mandatory disclaimer: 'These statements have not been evaluated by the FDA. This product is not intended to diagnose, treat, cure, or prevent any disease.'"
    },
    {
        "rule_id": "RULE-003",
        "title": "Exact Brand Spelling & Capitalization",
        "category": "RULE_VIOLATION",
        "severity": "LOW",
        "description": "The brand name must strictly be formatted as 'NovaPulse' (one single word, CamelCase).",
        "forbidden_variants": ["Nova Pulse", "nova pulse", "novapulse", "NOVA PULSE", "Nova-Pulse", "Nova pulse", "novapulse"],
        "explanation": "Consistent trademark capitalization preserves brand identity and legal trademark distinctiveness.",
        "suggested_correction": "Change spelling to 'NovaPulse'."
    },
    {
        "rule_id": "RULE-004",
        "title": "Approved Return & Guarantee Window",
        "category": "RULE_VIOLATION",
        "severity": "MEDIUM",
        "description": "NovaPulse offers a 30-day money-back guarantee. Extensions like 60, 90, or lifetime guarantees violate brand finance policies.",
        "forbidden_terms": [
            "60-day money-back",
            "60 day money back",
            "90-day money-back",
            "90 day money back",
            "lifetime guarantee",
            "lifetime refund",
            "100-day trial"
        ],
        "explanation": "Unauthorized guarantee durations create customer support liability and violate commercial return policies.",
        "suggested_correction": "State the official approved policy: '30-day risk-free money-back guarantee'."
    }
]

# 2. Verified Ground-Truth Evidence / Specifications
VERIFIED_FACTS: List[Dict[str, Any]] = [
    {
        "fact_id": "FACT-001",
        "topic": "Battery Life",
        "ground_truth": "NovaPulse Band battery lasts up to 7 days on standard usage (ISO-9001 lab certified).",
        "verified_value": 7,
        "unit": "days",
        "explanation": "Engineering benchmark tests show maximum 7-day runtime. Claims exceeding 7 days contradict physical testing.",
        "suggested_correction": "Update battery claim to 'up to 7 days of battery life on a single charge'."
    },
    {
        "fact_id": "FACT-002",
        "topic": "Water Resistance Rating",
        "ground_truth": "NovaPulse Band is water-resistant up to 50 meters (5 ATM). Suitable for pool swimming, not deep-sea diving.",
        "verified_value": 50,
        "unit": "meters",
        "explanation": "Hardware gaskets are certified to 5 ATM (50m). Asserting higher ratings (e.g. 100m, 200m, or deep scuba) contradicts certified specifications.",
        "suggested_correction": "State water resistance accurately as 'water resistant up to 50 meters (5 ATM)'."
    },
    {
        "fact_id": "FACT-003",
        "topic": "ECG Sensor Accuracy",
        "ground_truth": "Clinical trial NP-2025 demonstrated 98.2% correlation with hospital-grade 12-lead ECG, not 100% or error-free.",
        "verified_value": 98.2,
        "unit": "percent",
        "explanation": "No optical photoplethysmography/wearable sensor achieves 100% clinical perfection. Claiming 100% accuracy contradicts verified clinical study results.",
        "suggested_correction": "Describe accuracy with verified evidence: 'validated 98.2% correlation with clinical ECG standards'."
    },
    {
        "fact_id": "FACT-004",
        "topic": "Active Customer Community",
        "ground_truth": "As of Q3 2026, NovaPulse has over 250,000 verified active subscribers globally.",
        "verified_value": 250000,
        "unit": "users",
        "explanation": "Claiming millions of users (e.g., '10 million users', '5 million happy customers') contradicts verified platform audit logs.",
        "suggested_correction": "Quote audited community size: 'joined by over 250,000 active NovaPulse members worldwide'."
    }
]

# 3. Known Verified Clinical & Technical Claims (Whitelisted evidence)
VERIFIED_CLAIM_EVIDENCE = [
    "98.2% correlation with clinical ECG",
    "tracks 14 vital biometric metrics",
    "syncs with Apple Health and Google Health Connect",
    "sleep staging validated by SleepLab Sweden",
    "over 250,000 active members"
]
