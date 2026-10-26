"""
Pydantic Schemas for Request Validation and Response Serialization.
Using Pydantic V2 standards.
"""

from datetime import datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict


# ---------------- Review Findings Schemas ----------------
class FindingDetailSchema(BaseModel):
    id: Optional[str] = None
    finding_type: str = Field(..., description="Prohibited Phrase, Terminology Mismatch, Factual Contradiction, or Unsupported Claim")
    severity: str = Field(..., description="HIGH, MEDIUM, or LOW")
    explanation: str = Field(..., description="Clear explanation of the issue and why it matters")
    matched_rule_or_source: str = Field(..., description="ID and title of the matched brand rule or approved source fact")
    suggested_correction: str = Field(..., description="Actionable recommended fix")
    status_or_uncertainty_label: str = Field(..., description="Confirmed Violation, Confirmed Contradiction, or Unverified claim")
    flagged_text: Optional[str] = Field(None, description="The specific text snippet flagged")

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
        
        # Normalize: 'Approved' -> 'approved', 'Request Changes' -> 'changes_requested'
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
            # Accept either 'content' or 'text'
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
    human_decision: Optional[HumanDecisionResponse] = None
    decisions: List[HumanDecisionResponse] = []

    model_config = ConfigDict(from_attributes=True)


class ContentReviewListItem(BaseModel):
    id: str
    content: str
    status: str
    total_findings: int
    created_at: datetime
    latest_decision: Optional[str] = None

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
