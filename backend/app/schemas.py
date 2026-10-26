"""
Pydantic Schemas for Request Validation and Response Serialization.
Using Pydantic V2 standards.
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, ConfigDict


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


# ---------------- Legacy / Check Aliases ----------------
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


# ---------------- Human Review Decisions ----------------
class ReviewDecisionCreate(BaseModel):
    decision: str = Field(..., description="APPROVE, REJECT, or REQUEST_CHANGES")
    reviewer_name: str = Field(..., min_length=2, max_length=100, description="Name of the human reviewer")
    notes: Optional[str] = Field(None, max_length=1000, description="Optional feedback or rejection notes")

    @field_validator("decision")
    def validate_decision_enum(cls, v: str) -> str:
        valid_decisions = ["APPROVE", "REJECT", "REQUEST_CHANGES"]
        v_upper = v.upper()
        if v_upper not in valid_decisions:
            raise ValueError(f"Invalid decision '{v}'. Must be one of: {', '.join(valid_decisions)}")
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
