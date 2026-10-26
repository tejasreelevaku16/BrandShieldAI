"""
BrandShield AI - FastAPI Application
Provides RESTful APIs for AetherGlow marketing text analysis,
persistent review storage, and human governance decisions.
"""

from contextlib import asynccontextmanager
from typing import List, Optional
import uuid
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .database import engine, Base, get_db
from .models import ContentReview, HumanReviewDecision, Submission, FindingRecord, ReviewRecord
from .schemas import (
    ReviewCreateRequest,
    ContentReviewResponse,
    ContentReviewListItem,
    HumanDecisionCreateRequest,
    HumanDecisionResponse,
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
    # Initialize SQLite database tables safely on startup (does not overwrite existing records)
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="BrandShield AI API",
    description="Pre-publication brand-governance, review persistence & human decision workflow for AetherGlow",
    version="3.0.0",
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


# Helper to convert a ContentReview ORM object to ContentReviewResponse schema
def format_content_review_response(review: ContentReview) -> ContentReviewResponse:
    latest_decision_record = review.decisions[0] if review.decisions else None
    human_decision = None
    if latest_decision_record:
        human_decision = HumanDecisionResponse(
            id=latest_decision_record.id,
            review_id=latest_decision_record.review_id,
            decision=latest_decision_record.decision,
            comment=latest_decision_record.comment,
            created_at=latest_decision_record.created_at
        )

    all_decisions = [
        HumanDecisionResponse(
            id=d.id,
            review_id=d.review_id,
            decision=d.decision,
            comment=d.comment,
            created_at=d.created_at
        ) for d in review.decisions
    ]

    findings_list = [
        FindingDetailSchema(
            id=f.get("id"),
            finding_type=f["finding_type"],
            severity=f["severity"],
            explanation=f["explanation"],
            matched_rule_or_source=f["matched_rule_or_source"],
            suggested_correction=f["suggested_correction"],
            status_or_uncertainty_label=f["status_or_uncertainty_label"],
            flagged_text=f.get("flagged_text"),
            category=f.get("category"),
            rule_or_evidence_id=f.get("rule_or_evidence_id"),
            rule_title=f.get("rule_title"),
            issue=f.get("issue"),
            is_resolved=f.get("is_resolved", False)
        ) for f in (review.findings or [])
    ]

    return ContentReviewResponse(
        id=review.id,
        content=review.content,
        status=review.status,
        total_findings=review.total_findings,
        created_at=review.created_at,
        findings=findings_list,
        human_decision=human_decision,
        decisions=all_decisions
    )


# ---------------- System & Governance Info ----------------
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


# ---------------- Task 3: Content Reviews & Human Governance Endpoints ----------------
@app.post("/reviews", response_model=ContentReviewResponse, status_code=status.HTTP_201_CREATED, tags=["Reviews"])
def create_review(payload: ReviewCreateRequest, db: Session = Depends(get_db)):
    """
    POST /reviews
    Runs the deterministic rule engine, saves the content and findings in the database,
    and returns the saved review record.
    """
    content = payload.content or payload.text
    analysis = analyze_marketing_text(content)
    findings_data = analysis["findings"]

    # Assign persistent IDs to findings
    for f in findings_data:
        if not f.get("id"):
            f["id"] = str(uuid.uuid4())

    new_review = ContentReview(
        id=str(uuid.uuid4()),
        content=content,
        findings=findings_data,
        status="clean" if len(findings_data) == 0 else "action_required",
        total_findings=len(findings_data)
    )
    db.add(new_review)
    db.commit()
    db.refresh(new_review)

    return format_content_review_response(new_review)


@app.get("/reviews", response_model=List[ContentReviewListItem], tags=["Reviews"])
def list_reviews(limit: int = 50, db: Session = Depends(get_db)):
    """
    GET /reviews
    Returns saved reviews ordered newest first.
    """
    reviews = db.query(ContentReview).order_by(ContentReview.created_at.desc()).limit(limit).all()
    results = []
    for r in reviews:
        latest_dec = r.decisions[0].decision if r.decisions else None
        results.append(ContentReviewListItem(
            id=r.id,
            content=r.content,
            status=r.status,
            total_findings=r.total_findings,
            created_at=r.created_at,
            latest_decision=latest_dec
        ))
    return results


@app.get("/reviews/{review_id}", response_model=ContentReviewResponse, tags=["Reviews"])
def get_review(review_id: str, db: Session = Depends(get_db)):
    """
    GET /reviews/{review_id}
    Returns one saved review, including its findings and any human decision.
    Returns 404 if review does not exist.
    """
    review = db.query(ContentReview).filter(ContentReview.id == review_id).first()
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Review '{review_id}' not found"
        )
    return format_content_review_response(review)


@app.post("/reviews/{review_id}/decision", response_model=ContentReviewResponse, status_code=status.HTTP_200_OK, tags=["Reviews"])
def save_human_decision(review_id: str, payload: HumanDecisionCreateRequest, db: Session = Depends(get_db)):
    """
    POST /reviews/{review_id}/decision
    Saves a human decision ('approved', 'rejected', or 'changes_requested') and optional comment.
    Preserves all original automated findings without modification.
    Returns 404 if review does not exist.
    """
    review = db.query(ContentReview).filter(ContentReview.id == review_id).first()
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Review '{review_id}' not found"
        )

    decision_record = HumanReviewDecision(
        id=str(uuid.uuid4()),
        review_id=review.id,
        decision=payload.decision,
        comment=payload.comment.strip() if payload.comment else None
    )
    db.add(decision_record)

    # Update overall review status to reflect human decision
    review.status = payload.decision
    db.commit()
    db.refresh(review)

    return format_content_review_response(review)


# ---------------- Backward Compatibility: Task 2 POST /review ----------------
@app.post("/review", response_model=ReviewResponse, status_code=status.HTTP_200_OK, tags=["Review (Task 2 Compatibility)"])
@app.post("/api/review", response_model=ReviewResponse, status_code=status.HTTP_200_OK, tags=["Review (Task 2 Compatibility)"])
def review_content(payload: ReviewRequest, db: Session = Depends(get_db)):
    """
    Task 2 endpoint maintained for backward compatibility.
    Runs rule engine and saves to database.
    """
    content = payload.text
    analysis = analyze_marketing_text(content)
    findings_data = analysis["findings"]

    for f in findings_data:
        if not f.get("id"):
            f["id"] = str(uuid.uuid4())

    new_review = ContentReview(
        id=str(uuid.uuid4()),
        content=content,
        findings=findings_data,
        status="clean" if len(findings_data) == 0 else "action_required",
        total_findings=len(findings_data)
    )
    db.add(new_review)
    db.commit()
    db.refresh(new_review)

    response_findings = [
        FindingDetailSchema(
            id=f["id"],
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
        ) for f in findings_data
    ]

    return ReviewResponse(
        brand=BRAND_PROFILE["brand_name"],
        total_findings=len(response_findings),
        status=analysis["status"],
        findings=response_findings,
        review_id=new_review.id,
        submission_id=new_review.id
    )


@app.post("/api/check", response_model=CheckTextResponse, status_code=status.HTTP_201_CREATED, tags=["Verification"])
def check_text(payload: CheckTextRequest, db: Session = Depends(get_db)):
    """
    Check endpoint mapping to review logic for frontend compatibility.
    """
    review_res = review_content(payload, db)
    rule_v = sum(1 for f in review_res.findings if f.category == "RULE_VIOLATION")
    fact_c = sum(1 for f in review_res.findings if f.category == "FACTUAL_CONTRADICTION")
    unsup_c = sum(1 for f in review_res.findings if f.category == "UNSUPPORTED_CLAIM")

    return CheckTextResponse(
        submission_id=review_res.review_id or "default",
        summary=AnalysisSummarySchema(
            total_findings=review_res.total_findings,
            rule_violations=rule_v,
            factual_contradictions=fact_c,
            unsupported_claims=unsup_c,
            status=review_res.status
        ),
        findings=review_res.findings
    )
