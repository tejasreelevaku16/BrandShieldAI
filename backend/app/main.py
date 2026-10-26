"""
BrandShield AI - FastAPI Application
Main entry point providing RESTful APIs for marketing text analysis,
brand rule management, and human pre-publication governance decisions.
"""

from contextlib import asynccontextmanager
from typing import List
import uuid
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .database import engine, Base, get_db
from .models import Submission, FindingRecord, ReviewRecord
from .schemas import (
    CheckTextRequest,
    CheckTextResponse,
    AnalysisSummarySchema,
    FindingSchema,
    ReviewDecisionCreate,
    ReviewRecordSchema,
    SubmissionDetailResponse,
    SubmissionListItemSchema
)
from .rules_data import BRAND_PROFILE, BRAND_RULES, VERIFIED_FACTS, VERIFIED_CLAIM_EVIDENCE
from .engine import analyze_marketing_text


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables on startup
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="BrandShield AI API",
    description="Pre-publication brand-governance & claim verification engine",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["System"])
def health_check():
    """System health check and brand identity endpoint."""
    return {
        "status": "healthy",
        "service": "BrandShield AI",
        "team": "AETHORA",
        "tagline": "Every Claim. Clear Evidence. Confident Publishing.",
        "brand_context": BRAND_PROFILE["brand_name"]
    }


@app.get("/api/brand-guidelines", tags=["Governance"])
def get_brand_guidelines():
    """Returns approved brand rules, verified facts, and official specs."""
    return {
        "profile": BRAND_PROFILE,
        "rules": BRAND_RULES,
        "verified_facts": VERIFIED_FACTS,
        "whitelisted_evidence": VERIFIED_CLAIM_EVIDENCE
    }


@app.post("/api/check", response_model=CheckTextResponse, status_code=status.HTTP_201_CREATED, tags=["Verification"])
def check_text(payload: CheckTextRequest, db: Session = Depends(get_db)):
    """
    Submits marketing text to the deterministic verification engine,
    persists submission and detected findings in SQLite, and returns detailed report.
    """
    analysis = analyze_marketing_text(payload.text)
    summary_data = analysis["summary"]
    findings_data = analysis["findings"]

    # Create submission record
    submission = Submission(
        original_text=payload.text,
        current_text=payload.text,
        status="CLEAN" if summary_data["total_findings"] == 0 else "ACTION_REQUIRED",
        total_findings=summary_data["total_findings"],
        rule_violations_count=summary_data["rule_violations"],
        factual_contradictions_count=summary_data["factual_contradictions"],
        unsupported_claims_count=summary_data["unsupported_claims"]
    )
    db.add(submission)
    db.flush() # Populate submission.id

    # Persist all detected findings
    created_findings = []
    for f in findings_data:
        finding_id = str(uuid.uuid4())
        finding_record = FindingRecord(
            id=finding_id,
            submission_id=submission.id,
            category=f["category"],
            severity=f["severity"],
            rule_or_evidence_id=f["rule_or_evidence_id"],
            rule_title=f["rule_title"],
            flagged_text=f["flagged_text"],
            issue=f["issue"],
            explanation=f["explanation"],
            suggested_correction=f["suggested_correction"]
        )
        db.add(finding_record)
        created_findings.append(FindingSchema(
            id=finding_id,
            category=f["category"],
            severity=f["severity"],
            rule_or_evidence_id=f["rule_or_evidence_id"],
            rule_title=f["rule_title"],
            flagged_text=f["flagged_text"],
            issue=f["issue"],
            explanation=f["explanation"],
            suggested_correction=f["suggested_correction"],
            is_resolved=False
        ))

    db.commit()

    return CheckTextResponse(
        submission_id=submission.id,
        summary=AnalysisSummarySchema(**summary_data),
        findings=created_findings
    )


@app.put("/api/submissions/{submission_id}/recheck", response_model=CheckTextResponse, tags=["Verification"])
def recheck_text(submission_id: str, payload: CheckTextRequest, db: Session = Depends(get_db)):
    """
    Re-analyzes edited marketing text for an existing submission.
    Updates the text, purges old findings, and stores new findings.
    """
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found.")

    analysis = analyze_marketing_text(payload.text)
    summary_data = analysis["summary"]
    findings_data = analysis["findings"]

    # Remove existing findings
    db.query(FindingRecord).filter(FindingRecord.submission_id == submission_id).delete()

    # Update submission text and summary
    submission.current_text = payload.text
    submission.status = "CLEAN" if summary_data["total_findings"] == 0 else "ACTION_REQUIRED"
    submission.total_findings = summary_data["total_findings"]
    submission.rule_violations_count = summary_data["rule_violations"]
    submission.factual_contradictions_count = summary_data["factual_contradictions"]
    submission.unsupported_claims_count = summary_data["unsupported_claims"]

    # Re-create findings
    created_findings = []
    for f in findings_data:
        finding_id = str(uuid.uuid4())
        finding_record = FindingRecord(
            id=finding_id,
            submission_id=submission.id,
            category=f["category"],
            severity=f["severity"],
            rule_or_evidence_id=f["rule_or_evidence_id"],
            rule_title=f["rule_title"],
            flagged_text=f["flagged_text"],
            issue=f["issue"],
            explanation=f["explanation"],
            suggested_correction=f["suggested_correction"]
        )
        db.add(finding_record)
        created_findings.append(FindingSchema(
            id=finding_id,
            category=f["category"],
            severity=f["severity"],
            rule_or_evidence_id=f["rule_or_evidence_id"],
            rule_title=f["rule_title"],
            flagged_text=f["flagged_text"],
            issue=f["issue"],
            explanation=f["explanation"],
            suggested_correction=f["suggested_correction"],
            is_resolved=False
        ))

    db.commit()

    return CheckTextResponse(
        submission_id=submission.id,
        summary=AnalysisSummarySchema(**summary_data),
        findings=created_findings
    )


@app.get("/api/submissions", response_model=List[SubmissionListItemSchema], tags=["Submissions"])
def list_submissions(limit: int = 20, db: Session = Depends(get_db)):
    """Lists past submissions sorted by newest first."""
    records = db.query(Submission).order_by(Submission.created_at.desc()).limit(limit).all()
    results = []
    for r in records:
        preview = (r.current_text[:75] + "...") if len(r.current_text) > 75 else r.current_text
        results.append(SubmissionListItemSchema(
            id=r.id,
            created_at=r.created_at,
            status=r.status,
            total_findings=r.total_findings,
            preview=preview
        ))
    return results


@app.get("/api/submissions/{submission_id}", response_model=SubmissionDetailResponse, tags=["Submissions"])
def get_submission_detail(submission_id: str, db: Session = Depends(get_db)):
    """Retrieves full details of a submission, including findings and human review decisions."""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found.")
    return submission


@app.post("/api/submissions/{submission_id}/decision", response_model=ReviewRecordSchema, status_code=status.HTTP_201_CREATED, tags=["Human Governance"])
def record_review_decision(submission_id: str, payload: ReviewDecisionCreate, db: Session = Depends(get_db)):
    """
    Records a human review decision (APPROVE, REJECT, REQUEST_CHANGES).
    Saves reviewer name, notes, and updates the overall submission governance status.
    """
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found.")

    review = ReviewRecord(
        submission_id=submission.id,
        decision=payload.decision,
        reviewer_name=payload.reviewer_name.strip(),
        notes=payload.notes.strip() if payload.notes else None
    )
    db.add(review)

    # Update submission status according to human decision
    status_map = {
        "APPROVE": "APPROVED",
        "REJECT": "REJECTED",
        "REQUEST_CHANGES": "CHANGES_REQUESTED"
    }
    submission.status = status_map.get(payload.decision, submission.status)

    db.commit()
    db.refresh(review)

    return review
