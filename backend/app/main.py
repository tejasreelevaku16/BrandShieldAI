"""
BrandShield AI - FastAPI Application
Provides RESTful APIs for AetherGlow marketing text analysis,
brand guidelines management (rules & approved facts), persistent review storage,
and human governance decisions.
"""

from contextlib import asynccontextmanager
from typing import List, Optional
import os
import uuid
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .database import engine, Base, SessionLocal, get_db
from .models import (
    BrandRule,
    ApprovedFact,
    ContentReview,
    HumanReviewDecision,
    Submission,
    FindingRecord,
    ReviewRecord
)
from .schemas import (
    BrandRuleCreate,
    BrandRuleUpdate,
    BrandRuleResponse,
    ApprovedFactCreate,
    ApprovedFactUpdate,
    ApprovedFactResponse,
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
    SubmissionListItemSchema,
    AnalyticsSummaryResponse,
    TopGuidelineItem
)
from .rules_data import BRAND_PROFILE, BRAND_RULES, APPROVED_FACTS, APPROVED_WHITELIST_CLAIMS
from .engine import analyze_marketing_text


def seed_default_guidelines_if_empty(db: Session):
    """
    Safely seeds initial AetherGlow brand rules and approved facts if tables are empty.
    Never overwrites or deletes existing records on restart.
    """
    if db.query(BrandRule).count() == 0:
        default_rules = [
            BrandRule(
                id=str(uuid.uuid4()),
                rule_id="RULE-PROHIBITED-01",
                name="Prohibited Absolute Outcome Guarantee",
                rule_type="prohibited_phrase",
                description="Never use the phrase 'guaranteed 100% results' or promise unconditional outcomes.",
                severity="HIGH",
                prohibited_phrase="guaranteed 100% results",
                preferred_replacement="formulated to deliver visible radiance and support healthy skin",
                is_active=True
            ),
            BrandRule(
                id=str(uuid.uuid4()),
                rule_id="RULE-TERM-01",
                name="Approved Audience Terminology",
                rule_type="preferred_terminology",
                description="Always refer to our audience as 'customers', never as 'consumers'.",
                severity="LOW",
                prohibited_phrase="consumers",
                preferred_replacement="customers",
                is_active=True
            )
        ]
        db.add_all(default_rules)
        db.commit()

    if db.query(ApprovedFact).count() == 0:
        default_facts = [
            ApprovedFact(
                id=str(uuid.uuid4()),
                fact_id="FACT-PKG-01",
                statement="AetherGlow products are made with 70% recycled packaging.",
                source_name="AetherGlow sample brand facts",
                source_url="https://aetherglow.example.com/sustainability-2025",
                verification_status="verified_sample",
                is_active=True
            ),
            ApprovedFact(
                id=str(uuid.uuid4()),
                fact_id="FACT-FND-01",
                statement="AetherGlow was founded in 2020.",
                source_name="Corporate Registry Certificate (Delaware)",
                source_url="https://aetherglow.example.com/corporate-charter",
                verification_status="verified_sample",
                is_active=True
            )
        ]
        db.add_all(default_facts)
        db.commit()


def ensure_db_schema_migrated():
    """
    Ensures database schema has all columns expected by SQLAlchemy models.
    Safely adds guidelines_snapshot column to content_reviews if it doesn't already exist.
    """
    try:
        from sqlalchemy import inspect, text
        inspector = inspect(engine)
        if "content_reviews" in inspector.get_table_names():
            columns = [c["name"] for c in inspector.get_columns("content_reviews")]
            if "guidelines_snapshot" not in columns:
                with engine.connect() as conn:
                    conn.execute(text("ALTER TABLE content_reviews ADD COLUMN guidelines_snapshot JSON"))
                    conn.commit()
    except Exception as e:
        print(f"[Database Schema Migration] Notice: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database tables safely on startup
    Base.metadata.create_all(bind=engine)
    ensure_db_schema_migrated()
    db = SessionLocal()
    try:
        seed_default_guidelines_if_empty(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="BrandShield AI API",
    description="Pre-publication brand-governance, guidelines management & review workflow for AetherGlow",
    version="4.0.0",
    lifespan=lifespan
)

# Configurable CORS origins via environment variable (comma-separated list), e.g. "https://brandshield.vercel.app,http://localhost:5173"
# If CORS_ORIGINS is not set or set to "*", all origins are allowed.
cors_origins_env = os.getenv("CORS_ORIGINS", "*").strip()
if cors_origins_env == "*" or not cors_origins_env:
    allowed_origins = ["*"]
    allow_credentials = False
else:
    allowed_origins = [orig.strip() for orig in cors_origins_env.split(",") if orig.strip()]
    allow_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
            finding_type=f.get("finding_type") or f.get("type", "Brand Rule Violation"),
            type=f.get("type") or f.get("finding_type", "Brand Rule Violation"),
            severity=f.get("severity", "MEDIUM"),
            explanation=f.get("explanation", ""),
            matched_rule_or_source=f.get("matched_rule_or_source") or f.get("source", ""),
            source=f.get("source") or f.get("matched_rule_or_source", ""),
            suggested_correction=f.get("suggested_correction", ""),
            status_or_uncertainty_label=f.get("status_or_uncertainty_label") or f.get("status", "Confirmed Violation"),
            status=f.get("status") or f.get("status_or_uncertainty_label", "Confirmed Violation"),
            flagged_text=f.get("flagged_text") or f.get("matched_text"),
            matched_text=f.get("matched_text") or f.get("flagged_text"),
            start_offset=f.get("start_offset"),
            end_offset=f.get("end_offset"),
            category=f.get("category"),
            rule_or_evidence_id=f.get("rule_or_evidence_id"),
            rule_title=f.get("rule_title"),
            issue=f.get("issue"),
            is_resolved=f.get("is_resolved", False)
        ) for f in (review.findings or [])
    ]

    rule_v = sum(1 for f in findings_list if f.category == "RULE_VIOLATION")
    fact_c = sum(1 for f in findings_list if f.category == "FACTUAL_CONTRADICTION")
    unsup_c = sum(1 for f in findings_list if f.category == "UNSUPPORTED_CLAIM")

    if review.total_findings == 0:
        summary_msg = "No brand governance issues or contradictory claims detected by current active rules. (Note: Always verify novel technical claims prior to publication)."
    else:
        breakdown = []
        if rule_v:
            breakdown.append(f"{rule_v} guideline violation{'s' if rule_v > 1 else ''}")
        if fact_c:
            breakdown.append(f"{fact_c} potential factual contradiction{'s' if fact_c > 1 else ''}")
        if unsup_c:
            breakdown.append(f"{unsup_c} unverified claim{'s' if unsup_c > 1 else ''}")
        summary_msg = f"{review.total_findings} issue{'s' if review.total_findings > 1 else ''} detected ({', '.join(breakdown)})."

    summary_bd = {
        "rule_violations": rule_v,
        "factual_contradictions": fact_c,
        "unsupported_claims": unsup_c,
        "total": review.total_findings
    }

    return ContentReviewResponse(
        id=review.id,
        content=review.content,
        status=review.status,
        total_findings=review.total_findings,
        created_at=review.created_at,
        findings=findings_list,
        guidelines_snapshot=review.guidelines_snapshot,
        human_decision=human_decision,
        decisions=all_decisions,
        summary_message=summary_msg,
        summary_breakdown=summary_bd
    )


# ---------------- System & Guidelines Summary Endpoints ----------------
@app.get("/", tags=["System"])
@app.get("/health", tags=["System"])
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


@app.get("/semantic-status", tags=["System"])
@app.get("/api/semantic-status", tags=["System"])
def get_semantic_engine_status():
    """Provides diagnostic runtime status of the NLP semantic similarity candidate matcher."""
    from .semantic_matcher import get_semantic_matcher
    return get_semantic_matcher().get_runtime_status()


@app.get("/brand-guidelines", tags=["Governance"])
@app.get("/api/brand-guidelines", tags=["Governance"])
def get_brand_guidelines(db: Session = Depends(get_db)):
    """Returns active brand rules and approved facts from database."""
    rules = db.query(BrandRule).filter(BrandRule.is_active == True).all()
    facts = db.query(ApprovedFact).filter(ApprovedFact.is_active == True).all()
    return {
        "profile": BRAND_PROFILE,
        "rules": rules,
        "approved_facts": facts,
        "whitelisted_evidence": APPROVED_WHITELIST_CLAIMS
    }


# ---------------- Task 4: Brand Guidelines Management Endpoints ----------------
@app.get("/rules", response_model=List[BrandRuleResponse], tags=["Brand Rules"])
@app.get("/api/rules", response_model=List[BrandRuleResponse], tags=["Brand Rules"])
def list_rules(db: Session = Depends(get_db)):
    """Lists all brand rules in the database."""
    return db.query(BrandRule).order_by(BrandRule.created_at.asc()).all()


@app.post("/rules", response_model=BrandRuleResponse, status_code=status.HTTP_201_CREATED, tags=["Brand Rules"])
@app.post("/api/rules", response_model=BrandRuleResponse, status_code=status.HTTP_201_CREATED, tags=["Brand Rules"])
def create_rule(payload: BrandRuleCreate, db: Session = Depends(get_db)):
    """Creates a new brand rule with validation."""
    rule_id = payload.rule_id
    if not rule_id or not rule_id.strip():
        rule_id = f"RULE-{str(uuid.uuid4())[:8].upper()}"
    else:
        rule_id = rule_id.strip().upper()
        # Check for duplicate rule_id
        existing = db.query(BrandRule).filter(BrandRule.rule_id == rule_id).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Rule with ID '{rule_id}' already exists.")

    new_rule = BrandRule(
        id=str(uuid.uuid4()),
        rule_id=rule_id,
        name=payload.name,
        rule_type=payload.rule_type,
        description=payload.description,
        severity=payload.severity,
        prohibited_phrase=payload.prohibited_phrase.strip() if payload.prohibited_phrase else None,
        preferred_replacement=payload.preferred_replacement.strip() if payload.preferred_replacement else None,
        is_active=payload.is_active
    )
    db.add(new_rule)
    db.commit()
    db.refresh(new_rule)
    return new_rule


@app.get("/rules/{rule_identifier}", response_model=BrandRuleResponse, tags=["Brand Rules"])
@app.get("/api/rules/{rule_identifier}", response_model=BrandRuleResponse, tags=["Brand Rules"])
def get_rule(rule_identifier: str, db: Session = Depends(get_db)):
    """Retrieves a single rule by ID or rule_id."""
    rule = db.query(BrandRule).filter(
        (BrandRule.id == rule_identifier) | (BrandRule.rule_id == rule_identifier)
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail=f"Rule '{rule_identifier}' not found.")
    return rule


@app.put("/rules/{rule_identifier}", response_model=BrandRuleResponse, tags=["Brand Rules"])
@app.put("/api/rules/{rule_identifier}", response_model=BrandRuleResponse, tags=["Brand Rules"])
def update_rule(rule_identifier: str, payload: BrandRuleUpdate, db: Session = Depends(get_db)):
    """Updates an existing brand rule."""
    rule = db.query(BrandRule).filter(
        (BrandRule.id == rule_identifier) | (BrandRule.rule_id == rule_identifier)
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail=f"Rule '{rule_identifier}' not found.")

    if payload.name is not None:
        rule.name = payload.name
    if payload.rule_type is not None:
        rule.rule_type = payload.rule_type
    if payload.description is not None:
        rule.description = payload.description
    if payload.severity is not None:
        rule.severity = payload.severity
    if payload.prohibited_phrase is not None:
        rule.prohibited_phrase = payload.prohibited_phrase.strip() if payload.prohibited_phrase else None
    if payload.preferred_replacement is not None:
        rule.preferred_replacement = payload.preferred_replacement.strip() if payload.preferred_replacement else None
    if payload.is_active is not None:
        rule.is_active = payload.is_active

    db.commit()
    db.refresh(rule)
    return rule


@app.patch("/rules/{rule_identifier}/toggle", response_model=BrandRuleResponse, tags=["Brand Rules"])
@app.patch("/api/rules/{rule_identifier}/toggle", response_model=BrandRuleResponse, tags=["Brand Rules"])
def toggle_rule_active(rule_identifier: str, db: Session = Depends(get_db)):
    """Toggles active/inactive status of a brand rule."""
    rule = db.query(BrandRule).filter(
        (BrandRule.id == rule_identifier) | (BrandRule.rule_id == rule_identifier)
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail=f"Rule '{rule_identifier}' not found.")

    rule.is_active = not rule.is_active
    db.commit()
    db.refresh(rule)
    return rule


@app.delete("/rules/{rule_identifier}", status_code=status.HTTP_200_OK, tags=["Brand Rules"])
@app.delete("/api/rules/{rule_identifier}", status_code=status.HTTP_200_OK, tags=["Brand Rules"])
def delete_rule(rule_identifier: str, db: Session = Depends(get_db)):
    """Deletes a rule after confirmation."""
    rule = db.query(BrandRule).filter(
        (BrandRule.id == rule_identifier) | (BrandRule.rule_id == rule_identifier)
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail=f"Rule '{rule_identifier}' not found.")

    db.delete(rule)
    db.commit()
    return {"message": f"Rule '{rule.rule_id}' ({rule.name}) deleted successfully."}


# ---------------- Task 4: Approved Fact Sources Endpoints ----------------
@app.get("/facts", response_model=List[ApprovedFactResponse], tags=["Approved Facts"])
@app.get("/api/facts", response_model=List[ApprovedFactResponse], tags=["Approved Facts"])
def list_facts(db: Session = Depends(get_db)):
    """Lists all approved fact sources in the database."""
    return db.query(ApprovedFact).order_by(ApprovedFact.created_at.asc()).all()


@app.post("/facts", response_model=ApprovedFactResponse, status_code=status.HTTP_201_CREATED, tags=["Approved Facts"])
@app.post("/api/facts", response_model=ApprovedFactResponse, status_code=status.HTTP_201_CREATED, tags=["Approved Facts"])
def create_fact(payload: ApprovedFactCreate, db: Session = Depends(get_db)):
    """Creates a new approved fact source."""
    fact_id = payload.fact_id
    if not fact_id or not fact_id.strip():
        fact_id = f"FACT-{str(uuid.uuid4())[:8].upper()}"
    else:
        fact_id = fact_id.strip().upper()
        existing = db.query(ApprovedFact).filter(ApprovedFact.fact_id == fact_id).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Fact with ID '{fact_id}' already exists.")

    new_fact = ApprovedFact(
        id=str(uuid.uuid4()),
        fact_id=fact_id,
        statement=payload.statement,
        source_name=payload.source_name,
        source_url=payload.source_url.strip() if payload.source_url else None,
        verification_status=payload.verification_status,
        is_active=payload.is_active
    )
    db.add(new_fact)
    db.commit()
    db.refresh(new_fact)
    return new_fact


@app.get("/facts/{fact_identifier}", response_model=ApprovedFactResponse, tags=["Approved Facts"])
@app.get("/api/facts/{fact_identifier}", response_model=ApprovedFactResponse, tags=["Approved Facts"])
def get_fact(fact_identifier: str, db: Session = Depends(get_db)):
    """Retrieves an approved fact by ID or fact_id."""
    fact = db.query(ApprovedFact).filter(
        (ApprovedFact.id == fact_identifier) | (ApprovedFact.fact_id == fact_identifier)
    ).first()
    if not fact:
        raise HTTPException(status_code=404, detail=f"Fact '{fact_identifier}' not found.")
    return fact


@app.put("/facts/{fact_identifier}", response_model=ApprovedFactResponse, tags=["Approved Facts"])
@app.put("/api/facts/{fact_identifier}", response_model=ApprovedFactResponse, tags=["Approved Facts"])
def update_fact(fact_identifier: str, payload: ApprovedFactUpdate, db: Session = Depends(get_db)):
    """Updates an approved fact source."""
    fact = db.query(ApprovedFact).filter(
        (ApprovedFact.id == fact_identifier) | (ApprovedFact.fact_id == fact_identifier)
    ).first()
    if not fact:
        raise HTTPException(status_code=404, detail=f"Fact '{fact_identifier}' not found.")

    if payload.statement is not None:
        fact.statement = payload.statement
    if payload.source_name is not None:
        fact.source_name = payload.source_name
    if payload.source_url is not None:
        fact.source_url = payload.source_url.strip() if payload.source_url else None
    if payload.verification_status is not None:
        fact.verification_status = payload.verification_status
    if payload.is_active is not None:
        fact.is_active = payload.is_active

    db.commit()
    db.refresh(fact)
    return fact


@app.patch("/facts/{fact_identifier}/toggle", response_model=ApprovedFactResponse, tags=["Approved Facts"])
@app.patch("/api/facts/{fact_identifier}/toggle", response_model=ApprovedFactResponse, tags=["Approved Facts"])
def toggle_fact_active(fact_identifier: str, db: Session = Depends(get_db)):
    """Toggles active/inactive status of an approved fact."""
    fact = db.query(ApprovedFact).filter(
        (ApprovedFact.id == fact_identifier) | (ApprovedFact.fact_id == fact_identifier)
    ).first()
    if not fact:
        raise HTTPException(status_code=404, detail=f"Fact '{fact_identifier}' not found.")

    fact.is_active = not fact.is_active
    db.commit()
    db.refresh(fact)
    return fact


@app.delete("/facts/{fact_identifier}", status_code=status.HTTP_200_OK, tags=["Approved Facts"])
@app.delete("/api/facts/{fact_identifier}", status_code=status.HTTP_200_OK, tags=["Approved Facts"])
def delete_fact(fact_identifier: str, db: Session = Depends(get_db)):
    """Deletes an approved fact source after confirmation."""
    fact = db.query(ApprovedFact).filter(
        (ApprovedFact.id == fact_identifier) | (ApprovedFact.fact_id == fact_identifier)
    ).first()
    if not fact:
        raise HTTPException(status_code=404, detail=f"Fact '{fact_identifier}' not found.")

    db.delete(fact)
    db.commit()
    return {"message": f"Fact '{fact.fact_id}' deleted successfully."}


# ---------------- Content Reviews & Human Governance Endpoints ----------------
@app.post("/reviews", response_model=ContentReviewResponse, status_code=status.HTTP_201_CREATED, tags=["Reviews"])
@app.post("/api/reviews", response_model=ContentReviewResponse, status_code=status.HTTP_201_CREATED, tags=["Reviews"])
def create_review(payload: ReviewCreateRequest, db: Session = Depends(get_db)):
    """
    POST /reviews
    Loads active rules and approved facts from the database, executes the rule engine,
    saves the content, findings, and guidelines snapshot to SQLite, and returns the saved review.
    """
    content = payload.content or payload.text
    
    # Load dynamic active rules and active facts from database
    active_rules = db.query(BrandRule).filter(BrandRule.is_active == True).all()
    if not active_rules and db.query(BrandRule).count() == 0:
        seed_default_guidelines_if_empty(db)
        active_rules = db.query(BrandRule).filter(BrandRule.is_active == True).all()

    active_facts = db.query(ApprovedFact).filter(ApprovedFact.is_active == True).all()
    if not active_facts and db.query(ApprovedFact).count() == 0:
        seed_default_guidelines_if_empty(db)
        active_facts = db.query(ApprovedFact).filter(ApprovedFact.is_active == True).all()

    analysis = analyze_marketing_text(content, active_rules=active_rules, active_facts=active_facts)
    findings_data = analysis["findings"]

    for f in findings_data:
        if not f.get("id"):
            f["id"] = str(uuid.uuid4())

    # Snapshot of active rules and facts used for this review
    guidelines_snapshot = {
        "rules_applied": [{"rule_id": r.rule_id, "name": r.name, "rule_type": r.rule_type} for r in active_rules],
        "facts_applied": [{"fact_id": f.fact_id, "statement": f.statement, "source": f.source_name} for f in active_facts]
    }

    new_review = ContentReview(
        id=str(uuid.uuid4()),
        content=content,
        findings=findings_data,
        status="clean" if len(findings_data) == 0 else "action_required",
        total_findings=len(findings_data),
        guidelines_snapshot=guidelines_snapshot
    )
    db.add(new_review)
    db.commit()
    db.refresh(new_review)

    return format_content_review_response(new_review)


@app.get("/reviews", response_model=List[ContentReviewListItem], tags=["Reviews"])
@app.get("/api/reviews", response_model=List[ContentReviewListItem], tags=["Reviews"])
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


# ---------------- Priority 6: Governance Analytics Endpoint ----------------
@app.get("/reviews/analytics", response_model=AnalyticsSummaryResponse, tags=["Analytics"])
@app.get("/api/analytics", response_model=AnalyticsSummaryResponse, tags=["Analytics"])
def get_governance_analytics(db: Session = Depends(get_db)):
    """
    Computes real-time governance metrics strictly from actual database records:
    - Total reviews
    - Reviews awaiting human review
    - Counts of approved, rejected, changes_requested
    - Clean reviews vs reviews with findings
    - Most frequently triggered guidelines
    """
    reviews = db.query(ContentReview).all()
    total_reviews = len(reviews)

    approved_count = 0
    rejected_count = 0
    changes_requested_count = 0
    awaiting_review_count = 0
    clean_count = 0

    rule_counts = {}

    for r in reviews:
        latest_dec = r.decisions[0].decision.lower() if r.decisions else None
        if latest_dec == "approved":
            approved_count += 1
        elif latest_dec == "rejected":
            rejected_count += 1
        elif latest_dec in ["changes_requested", "request_changes"]:
            changes_requested_count += 1
        else:
            if r.total_findings > 0:
                awaiting_review_count += 1

        if r.total_findings == 0:
            clean_count += 1

        for f in (r.findings or []):
            rule_id = f.get("rule_or_evidence_id") or f.get("matched_rule_or_source") or "Rule"
            rule_title = f.get("rule_title") or f.get("source") or rule_id
            label = f"{rule_id}: {rule_title}"
            rule_counts[label] = rule_counts.get(label, 0) + 1

    top_guidelines = [
        TopGuidelineItem(guideline=k, count=v)
        for k, v in sorted(rule_counts.items(), key=lambda item: item[1], reverse=True)[:5]
    ]

    return AnalyticsSummaryResponse(
        total_reviews=total_reviews,
        awaiting_review=awaiting_review_count,
        approved=approved_count,
        rejected=rejected_count,
        changes_requested=changes_requested_count,
        clean_reviews=clean_count,
        reviews_with_issues=total_reviews - clean_count,
        top_triggered_guidelines=top_guidelines
    )


@app.get("/reviews/{review_id}", response_model=ContentReviewResponse, tags=["Reviews"])
@app.get("/api/reviews/{review_id}", response_model=ContentReviewResponse, tags=["Reviews"])
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
@app.post("/api/reviews/{review_id}/decision", response_model=ContentReviewResponse, status_code=status.HTTP_200_OK, tags=["Reviews"])
def save_human_decision(review_id: str, payload: HumanDecisionCreateRequest, db: Session = Depends(get_db)):
    """
    POST /reviews/{review_id}/decision
    Saves a human decision ('approved', 'rejected', or 'changes_requested') and optional comment.
    Preserves all original automated findings without modification.
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
    Loads active guidelines from DB and evaluates text.
    """
    content = payload.text
    active_rules = db.query(BrandRule).filter(BrandRule.is_active == True).all()
    if not active_rules and db.query(BrandRule).count() == 0:
        seed_default_guidelines_if_empty(db)
        active_rules = db.query(BrandRule).filter(BrandRule.is_active == True).all()

    active_facts = db.query(ApprovedFact).filter(ApprovedFact.is_active == True).all()
    if not active_facts and db.query(ApprovedFact).count() == 0:
        seed_default_guidelines_if_empty(db)
        active_facts = db.query(ApprovedFact).filter(ApprovedFact.is_active == True).all()

    analysis = analyze_marketing_text(content, active_rules=active_rules, active_facts=active_facts)
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
            finding_type=f.get("finding_type") or f.get("type", "Brand Rule Violation"),
            type=f.get("type") or f.get("finding_type", "Brand Rule Violation"),
            severity=f.get("severity", "MEDIUM"),
            explanation=f.get("explanation", ""),
            matched_rule_or_source=f.get("matched_rule_or_source") or f.get("source", ""),
            source=f.get("source") or f.get("matched_rule_or_source", ""),
            suggested_correction=f.get("suggested_correction", ""),
            status_or_uncertainty_label=f.get("status_or_uncertainty_label") or f.get("status", "Confirmed Violation"),
            status=f.get("status") or f.get("status_or_uncertainty_label", "Confirmed Violation"),
            flagged_text=f.get("flagged_text") or f.get("matched_text"),
            matched_text=f.get("matched_text") or f.get("flagged_text"),
            start_offset=f.get("start_offset"),
            end_offset=f.get("end_offset"),
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


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run("app.main:app", host=host, port=port, reload=False)
