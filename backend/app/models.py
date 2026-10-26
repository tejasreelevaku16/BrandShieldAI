"""
SQLAlchemy Database Models for BrandShield AI.
Tracks Content Reviews, Automated Findings, Human Review Decisions,
Editable Brand Rules, and Approved Fact Sources.
"""

from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from .database import Base


def utc_now():
    return datetime.now(timezone.utc)


class BrandRule(Base):
    """
    Editable brand compliance guidelines and language standards.
    Supports prohibited phrases, preferred terminology, required phrases, and custom text rules.
    """
    __tablename__ = "brand_rules"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    rule_id = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    rule_type = Column(String(50), nullable=False)  # 'prohibited_phrase', 'preferred_terminology', 'required_phrase', 'custom_text'
    description = Column(Text, nullable=False)
    severity = Column(String(20), nullable=False, default="MEDIUM")  # 'HIGH', 'MEDIUM', 'LOW'
    prohibited_phrase = Column(String(255), nullable=True)  # Term or phrase to detect/avoid
    preferred_replacement = Column(String(255), nullable=True)  # Approved replacement
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class ApprovedFact(Base):
    """
    Approved company facts and certified specifications for demonstration brand AetherGlow.
    Source URLs serve as supporting references, not absolute real-world truth.
    """
    __tablename__ = "approved_facts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    fact_id = Column(String(50), unique=True, nullable=False, index=True)
    statement = Column(Text, nullable=False)
    source_name = Column(String(255), nullable=False)
    source_url = Column(String(500), nullable=True)
    verification_status = Column(String(50), nullable=False, default="verified_sample")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class ContentReview(Base):
    """
    Stores submitted marketing content, automated rule findings (as structured JSON),
    guidelines snapshot, and current review status.
    """
    __tablename__ = "content_reviews"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    content = Column(Text, nullable=False)
    findings = Column(JSON, nullable=False, default=list)
    status = Column(String(50), nullable=False, default="action_required")
    total_findings = Column(Integer, default=0)
    guidelines_snapshot = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    decisions = relationship(
        "HumanReviewDecision",
        back_populates="review",
        cascade="all, delete-orphan",
        order_by="desc(HumanReviewDecision.created_at)"
    )


class HumanReviewDecision(Base):
    """
    Stores authoritative human governance decisions (approved, rejected, changes_requested)
    and optional reviewer comments.
    """
    __tablename__ = "human_review_decisions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    review_id = Column(String(36), ForeignKey("content_reviews.id"), nullable=False, index=True)
    decision = Column(String(50), nullable=False)  # 'approved', 'rejected', or 'changes_requested'
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    review = relationship("ContentReview", back_populates="decisions")


# Backward-compatibility models for earlier endpoints
class Submission(Base):
    __tablename__ = "submissions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    original_text = Column(Text, nullable=False)
    current_text = Column(Text, nullable=False)
    status = Column(String(50), nullable=False, default="PENDING_REVIEW")
    total_findings = Column(Integer, default=0)
    rule_violations_count = Column(Integer, default=0)
    factual_contradictions_count = Column(Integer, default=0)
    unsupported_claims_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    findings = relationship("FindingRecord", back_populates="submission", cascade="all, delete-orphan")
    reviews = relationship("ReviewRecord", back_populates="submission", cascade="all, delete-orphan")


class FindingRecord(Base):
    __tablename__ = "findings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    submission_id = Column(String(36), ForeignKey("submissions.id"), nullable=False)
    category = Column(String(50), nullable=False)
    severity = Column(String(20), nullable=False)
    rule_or_evidence_id = Column(String(50), nullable=False)
    rule_title = Column(String(255), nullable=False)
    flagged_text = Column(Text, nullable=False)
    issue = Column(Text, nullable=False)
    explanation = Column(Text, nullable=False)
    suggested_correction = Column(Text, nullable=False)
    is_resolved = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    submission = relationship("Submission", back_populates="findings")


class ReviewRecord(Base):
    __tablename__ = "reviews"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    submission_id = Column(String(36), ForeignKey("submissions.id"), nullable=False)
    decision = Column(String(50), nullable=False)
    reviewer_name = Column(String(100), nullable=False)
    notes = Column(Text, nullable=True)
    decided_at = Column(DateTime(timezone=True), default=utc_now)

    submission = relationship("Submission", back_populates="reviews")
