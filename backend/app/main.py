"""
BrandShield AI - FastAPI Application
Main entry point providing RESTful APIs for AetherGlow marketing text analysis,
brand rule governance, and human review decisions.
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
    ReviewRequest,
    ReviewResponse,
    FindingDetailSchema,
    CheckTextRequest,
    CheckTextResponse,
    AnalysisSummarySchema,
    ReviewDecisionCreate,
    ReviewRecordSchema,
    SubmissionDetailResponse,
    SubmissionListItemSchema
)
from .rules_data import BRAND_PROFILE, BRAND_RULES, APPROVED_FACTS, APPROVED_WHITELIST_CLAIMS
from .engine import analyze_marketing_text


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database tables on startup
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="BrandShield AI API",
    description="Pre-publication brand-governance & claim verification engine for AetherGlow",
    version="2.0.0",
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
    """Returns approved brand rules, verified facts, and official specs for AetherGlow."""
    return {
        "profile": BRAND_PROFILE,
        "rules": BRAND_RULES,
        "approved_facts": APPROVED_FACTS,
        "whitelisted_evidence": APPROVED_WHITELIST_CLAIMS
    }


@app.post("/review", response_model=ReviewResponse, status_code=status.HTTP_200_OK, tags=["Review"])
@app.post("/api/review", response_model=ReviewResponse, status_code=status.HTTP_200_OK, tags=["Review"])
def review_content(payload: ReviewRequest, db: Session = Depends(get_db)):
    """
    Core Task 2 Endpoint:
    Accepts marketing text, executes the brand rule engine, and returns explained findings.
    """
    analysis = analyze_marketing_text(payload.text)
    findings_data = analysis["findings"]

    # Persist in database for record keeping and human review
    submission = Submission(
        original_text=payload.text,
        current_text=payload.text,
        status="CLEAN" if len(findings_data) == 0 else "ACTION_REQUIRED",
        total_findings=len(findings_data),
        rule_violations_count=sum(1 for f in findings_data if f["category"] == "RULE_VIOLATION"),
        factual_contradictions_count=sum(1 for f in findings_data if f["category"] == "FACTUAL_CONTRADICTION"),
        unsupported_claims_count=sum(1 for f in findings_data if f["category"] == "UNSUPPORTED_CLAIM")
    )
    db.add(submission)
    db.flush()

    response_findings = []
    for f in findings_data:
        finding_id = str(uuid.uuid4())
        finding_record = FindingRecord(
            id=finding_id,
            submission_id=submission.id,
            category=f.get("category", "RULE_VIOLATION"),
            severity=f["severity"],
            rule_or_evidence_id=f.get("rule_or_evidence_id", "RULE"),
            rule_title=f.get("rule_title", f["finding_type"]),
            flagged_text=f.get("flagged_text", ""),
            issue=f.get("issue", f["finding_type"]),
            explanation=f["explanation"],
            suggested_correction=f["suggested_correction"]
        )
        db.add(finding_record)

        response_findings.append(FindingDetailSchema(
            id=finding_id,
            finding_type=f["finding_type"],
            severity=f["severity"],
            explanation=f["explanation"],
            matched_rule_or_source=f["matched_rule_or_source"],
            suggested_correction=f["suggested_correction"],
            status_or_uncertainty_label=f["status_or_uncertainty_label"],
            flagged_text=f.get("flagged_text"),
            category=f.get("category"),
            rule_or_evidence_id=f.get("rule_or_evidence_id"),
            issue=f.get("issue"),
            is_resolved=False
        ))

    db.commit()

    return ReviewResponse(
        brand=BRAND_PROFILE["brand_name"],
        total_findings=len(response_findings),
        status=analysis["status"],
        findings=response_findings,
        submission_id=submission.id
    )


@app.post("/api/check", response_model=CheckTextResponse, status_code=status.HTTP_201_CREATED, tags=["Verification"])
def check_text(payload: CheckTextRequest, db: Session = Depends(get_db)):
    """
    Full verification endpoint mapping to review logic for frontend compatibility.
    """
    review_res = review_content(payload, db)
    
    rule_v = sum(1 for f in review_res.findings if f.category == "RULE_VIOLATION")
    fact_c = sum(1 for f in review_res.findings if f.category == "FACTUAL_CONTRADICTION")
    unsup_c = sum(1 for f in review_res.findings if f.category == "UNSUPPORTED_CLAIM")

    return CheckTextResponse(
        submission_id=review_res.submission_id,
        summary=AnalysisSummarySchema(
            total_findings=review_res.total_findings,
            rule_violations=rule_v,
            factual_contradictions=fact_c,
            unsupported_claims=unsup_c,
            status=review_res.status
        ),
        findings=review_res.findings
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

    status_map = {
        "APPROVE": "APPROVED",
        "REJECT": "REJECTED",
        "REQUEST_CHANGES": "CHANGES_REQUESTED"
    }
    submission.status = status_map.get(payload.decision, submission.status)

    db.commit()
    db.refresh(review)

    return review
