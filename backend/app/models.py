"""
SQLAlchemy Database Models for BrandShield AI.
Tracks Submissions, Detailed Findings, and Human Review Decisions.
"""

from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from .database import Base


def utc_now():
    return datetime.now(timezone.utc)


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

    # Relationships
    findings = relationship("FindingRecord", back_populates="submission", cascade="all, delete-orphan")
    reviews = relationship("ReviewRecord", back_populates="submission", cascade="all, delete-orphan")


class FindingRecord(Base):
    __tablename__ = "findings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    submission_id = Column(String(36), ForeignKey("submissions.id"), nullable=False)
    category = Column(String(50), nullable=False) # RULE_VIOLATION | FACTUAL_CONTRADICTION | UNSUPPORTED_CLAIM
    severity = Column(String(20), nullable=False) # HIGH | MEDIUM | LOW
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
    decision = Column(String(50), nullable=False) # APPROVE | REJECT | REQUEST_CHANGES
    reviewer_name = Column(String(100), nullable=False)
    notes = Column(Text, nullable=True)
    decided_at = Column(DateTime(timezone=True), default=utc_now)

    submission = relationship("Submission", back_populates="reviews")
