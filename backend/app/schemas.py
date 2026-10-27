"""
Pydantic Schemas for Request Validation and Response Serialization.
Using Pydantic V2 standards.
"""

from datetime import datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict


# ---------------- Brand Rule Schemas (Task 4) ----------------
VALID_RULE_TYPES = [
    "prohibited_phrase",
    "prohibited",
    "preferred_terminology",
    "terminology",
    "required_phrase",
    "custom_text"
]
VALID_SEVERITIES = ["HIGH", "MEDIUM", "LOW"]

class BrandRuleCreate(BaseModel):
    rule_id: Optional[str] = Field(None, max_length=50, description="Unique human-readable rule ID")
    name: str = Field(..., min_length=2, max_length=200, description="Rule name")
    rule_type: str = Field(..., description="prohibited_phrase, preferred_terminology, required_phrase, or custom_text")
    description: str = Field(..., min_length=5, description="Rule description and rationale")
    severity: str = Field("MEDIUM", description="HIGH, MEDIUM, or LOW")
    prohibited_phrase: Optional[str] = Field(None, max_length=255, description="Phrase to detect/avoid")
    preferred_replacement: Optional[str] = Field(None, max_length=255, description="Preferred alternative or required text")
    is_active: bool = Field(True, description="Whether the rule is active")

    @field_validator("name", "description")
    def validate_non_empty_strings(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field cannot be empty or only whitespace.")
        return v.strip()

    @field_validator("rule_type")
    def validate_rule_type(cls, v: str) -> str:
        cleaned = v.strip().lower()
        if cleaned not in VALID_RULE_TYPES:
            raise ValueError(f"Invalid rule type '{v}'. Allowed types are: {', '.join(VALID_RULE_TYPES)}")
        return cleaned

    @field_validator("severity")
    def validate_severity(cls, v: str) -> str:
        cleaned = v.strip().upper()
        if cleaned not in VALID_SEVERITIES:
            raise ValueError(f"Invalid severity '{v}'. Allowed values are: {', '.join(VALID_SEVERITIES)}")
        return cleaned


class BrandRuleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    rule_type: Optional[str] = None
    description: Optional[str] = Field(None, min_length=5)
    severity: Optional[str] = None
    prohibited_phrase: Optional[str] = None
    preferred_replacement: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("name", "description")
    def validate_non_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("Field cannot be empty or only whitespace.")
        return v.strip() if v else v

    @field_validator("rule_type")
    def validate_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            cleaned = v.strip().lower()
            if cleaned not in VALID_RULE_TYPES:
                raise ValueError(f"Invalid rule type '{v}'. Allowed types are: {', '.join(VALID_RULE_TYPES)}")
            return cleaned
        return v

    @field_validator("severity")
    def validate_sev(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            cleaned = v.strip().upper()
            if cleaned not in VALID_SEVERITIES:
                raise ValueError(f"Invalid severity '{v}'. Allowed values are: {', '.join(VALID_SEVERITIES)}")
            return cleaned
        return v


class BrandRuleResponse(BaseModel):
    id: str
    rule_id: str
    name: str
    rule_type: str
    description: str
    severity: str
    prohibited_phrase: Optional[str] = None
    preferred_replacement: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------- Approved Fact Schemas (Task 4) ----------------
class ApprovedFactCreate(BaseModel):
    fact_id: Optional[str] = Field(None, max_length=50, description="Unique fact ID")
    statement: str = Field(..., min_length=5, description="Approved company fact statement")
    source_name: str = Field(..., min_length=2, max_length=255, description="Reference name / document title")
    source_url: Optional[str] = Field(None, max_length=500, description="Optional supporting reference URL")
    verification_status: str = Field("verified_sample", description="Status e.g. verified_sample, pending")
    is_active: bool = Field(True, description="Whether the fact is active")

    @field_validator("statement", "source_name")
    def validate_non_empty_strings(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field cannot be empty or only whitespace.")
        return v.strip()


class ApprovedFactUpdate(BaseModel):
    statement: Optional[str] = Field(None, min_length=5)
    source_name: Optional[str] = Field(None, min_length=2, max_length=255)
    source_url: Optional[str] = None
    verification_status: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("statement", "source_name")
    def validate_non_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("Field cannot be empty or only whitespace.")
        return v.strip() if v else v


class ApprovedFactResponse(BaseModel):
    id: str
    fact_id: str
    statement: str
    source_name: str
    source_url: Optional[str] = None
    verification_status: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------- Review Findings Schemas ----------------
class FindingDetailSchema(BaseModel):
    id: Optional[str] = None
    finding_type: str = Field(..., description="Prohibited Phrase, Terminology Mismatch, Factual Contradiction, or Unsupported Claim")
    type: Optional[str] = None
    severity: str = Field(..., description="HIGH, MEDIUM, or LOW")
    explanation: str = Field(..., description="Clear explanation of the issue and why it matters")
    matched_rule_or_source: str = Field(..., description="ID and title of the matched brand rule or approved source fact")
    source: Optional[str] = None
    suggested_correction: str = Field(..., description="Actionable recommended fix")
    status_or_uncertainty_label: str = Field(..., description="Confirmed Violation, Confirmed Contradiction, or Unverified claim")
    status: Optional[str] = None
    flagged_text: Optional[str] = Field(None, description="The specific text snippet flagged")
    matched_text: Optional[str] = None
    start_offset: Optional[int] = None
    end_offset: Optional[int] = None

    # Compatibility fields
    category: Optional[str] = None
    rule_or_evidence_id: Optional[str] = None
    rule_title: Optional[str] = None
    issue: Optional[str] = None
    is_resolved: Optional[bool] = False

    model_config = ConfigDict(from_attributes=True)


# ---------------- Human Decision Schemas ----------------
VALID_DECISIONS = ["approved", "rejected", "changes_requested"]

class HumanDecisionCreateRequest(BaseModel):
    decision: str = Field(..., description="Must be 'approved', 'rejected', or 'changes_requested'")
    comment: Optional[str] = Field(None, max_length=2000, description="Optional reviewer comment or instructions")

    @field_validator("decision")
    def validate_decision(cls, v: str) -> str:
        if not v or not isinstance(v, str):
            raise ValueError(f"Decision is required. Must be one of: {', '.join(VALID_DECISIONS)}")
        
        cleaned = v.strip().lower().replace(" ", "_").replace("-", "_")
        aliases = {
            "approved": "approved",
            "approve": "approved",
            "rejected": "rejected",
            "reject": "rejected",
            "changes_requested": "changes_requested",
            "request_changes": "changes_requested",
            "changesrequested": "changes_requested"
        }
        if cleaned not in aliases:
            raise ValueError(f"Invalid decision '{v}'. Allowed values are: {', '.join(VALID_DECISIONS)}")
        return aliases[cleaned]


class HumanDecisionResponse(BaseModel):
    id: str
    review_id: str
    decision: str
    comment: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------- Content Review Schemas ----------------
class ReviewCreateRequest(BaseModel):
    content: Optional[str] = None
    text: Optional[str] = None

    @model_validator(mode="before")
    def validate_content_or_text(cls, values: Any) -> Any:
        if isinstance(values, dict):
            val = values.get("content") or values.get("text")
            if not val or not str(val).strip():
                raise ValueError("Marketing content cannot be empty or solely whitespace.")
            values["content"] = str(val).strip()
            values["text"] = str(val).strip()
        return values


class ContentReviewResponse(BaseModel):
    id: str
    content: str
    status: str
    total_findings: int
    created_at: datetime
    findings: List[FindingDetailSchema]
    guidelines_snapshot: Optional[Dict[str, Any]] = None
    human_decision: Optional[HumanDecisionResponse] = None
    decisions: List[HumanDecisionResponse] = []
    summary_message: Optional[str] = None
    summary_breakdown: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


class ContentReviewListItem(BaseModel):
    id: str
    content: str
    status: str
    total_findings: int
    created_at: datetime
    latest_decision: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ---------------- Governance Analytics Schemas (Priority 6) ----------------
class TopGuidelineItem(BaseModel):
    guideline: str
    count: int


class AnalyticsSummaryResponse(BaseModel):
    total_reviews: int
    awaiting_review: int
    approved: int
    rejected: int
    changes_requested: int
    clean_reviews: int
    reviews_with_issues: int
    top_triggered_guidelines: List[TopGuidelineItem] = []

    model_config = ConfigDict(from_attributes=True)


# ---------------- Task 2 Backward Compatibility ----------------
class ReviewRequest(BaseModel):
    text: str = Field(..., description="Marketing copy to be checked against brand rules and facts")

    @field_validator("text")
    def text_must_not_be_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Marketing content cannot be empty or solely whitespace.")
        return v.strip()


class ReviewResponse(BaseModel):
    brand: str
    total_findings: int
    status: str
    findings: List[FindingDetailSchema]
    submission_id: Optional[str] = None
    review_id: Optional[str] = None


class CheckTextRequest(ReviewRequest):
    pass


class AnalysisSummarySchema(BaseModel):
    total_findings: int
    rule_violations: int
    factual_contradictions: int
    unsupported_claims: int
    status: str


class CheckTextResponse(BaseModel):
    submission_id: str
    summary: AnalysisSummarySchema
    findings: List[FindingDetailSchema]


class ReviewDecisionCreate(BaseModel):
    decision: str = Field(..., description="APPROVE, REJECT, or REQUEST_CHANGES")
    reviewer_name: str = Field(..., min_length=2, max_length=100)
    notes: Optional[str] = Field(None, max_length=1000)

    @field_validator("decision")
    def validate_decision_enum(cls, v: str) -> str:
        valid_decisions = ["APPROVE", "REJECT", "REQUEST_CHANGES", "approved", "rejected", "changes_requested"]
        v_upper = v.upper()
        if v_upper not in ["APPROVE", "REJECT", "REQUEST_CHANGES"]:
            raise ValueError(f"Invalid decision '{v}'.")
        return v_upper


class ReviewRecordSchema(BaseModel):
    id: str
    submission_id: str
    decision: str
    reviewer_name: str
    notes: Optional[str]
    decided_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SubmissionListItemSchema(BaseModel):
    id: str
    created_at: datetime
    status: str
    total_findings: int
    preview: str

    model_config = ConfigDict(from_attributes=True)


class SubmissionDetailResponse(BaseModel):
    id: str
    original_text: str
    current_text: str
    status: str
    total_findings: int
    rule_violations_count: int
    factual_contradictions_count: int
    unsupported_claims_count: int
    created_at: datetime
    updated_at: datetime
    findings: List[FindingDetailSchema]
    reviews: List[ReviewRecordSchema]

    model_config = ConfigDict(from_attributes=True)
