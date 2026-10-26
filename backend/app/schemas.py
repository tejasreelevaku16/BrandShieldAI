"""
Pydantic Schemas for Request Validation and Response Serialization.
Using Pydantic V2 standards.
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, ConfigDict


# ---------------- Findings Schemas ----------------
class FindingSchema(BaseModel):
    id: str
    category: str
    severity: str
    rule_or_evidence_id: str
    rule_title: str
    flagged_text: str
    issue: str
    explanation: str
    suggested_correction: str
    is_resolved: Optional[bool] = False

    model_config = ConfigDict(from_attributes=True)


class AnalysisSummarySchema(BaseModel):
    total_findings: int
    rule_violations: int
    factual_contradictions: int
    unsupported_claims: int
    status: str


# ---------------- Check Request / Response ----------------
class CheckTextRequest(BaseModel):
    text: str = Field(..., description="Marketing copy to evaluate")

    @field_validator("text")
    def text_must_not_be_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Marketing copy cannot be empty or only whitespace.")
        if len(v.strip()) < 5:
            raise ValueError("Marketing copy is too short to evaluate (minimum 5 characters).")
        return v.strip()


class CheckTextResponse(BaseModel):
    submission_id: str
    summary: AnalysisSummarySchema
    findings: List[FindingSchema]


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


# ---------------- Submission Schemas ----------------
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
    findings: List[FindingSchema]
    reviews: List[ReviewRecordSchema]

    model_config = ConfigDict(from_attributes=True)
