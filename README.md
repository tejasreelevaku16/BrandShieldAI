# BrandShield AI 🛡️
> **Every Claim. Clear Evidence. Confident Publishing.**  
> Built for CodeStar 30 Round 2 Hackathon | **Team: AETHORA**

BrandShield AI is a pre-publication brand-governance web application designed to help marketing, legal, and compliance teams audit marketing copy before publishing. It checks text against approved brand rules and verified evidence, explains detected issues with actionable corrections, allows interactive editing, and records human review decisions with an audit trail in an SQLite database.

---

## 🏛️ Architecture & Core Components

- **Deterministic Verification Engine (`backend/app/engine.py`)**:
  - **Rule Violations**: Detects absolute cure claims, missing mandatory FDA disclaimers, trademark misspellings, and unauthorized return guarantee durations.
  - **Factual Contradictions**: Confirms conflicts against physical engineering and clinical ground truth (e.g. battery life exceeding 7 days, water resistance exceeding 50m, 100% sensor precision claims).
  - **Unsupported Claims**: Flags specific quantitative or endorsement metrics lacking registered evidence (e.g., cortisol reductions, doctor recommendations). **CRITICAL**: Unsupported claims are never labeled as false—they are flagged for substantiation.
- **FastAPI REST API (`backend/app/main.py`)**: Provides endpoints for real-time text analysis, submission tracking, and human review decisions.
- **SQLite Database (`backend/app/models.py`)**: Persists submissions, granular findings, and reviewer signatures (`APPROVE`, `REJECT`, `REQUEST_CHANGES`).
- **React + Tailwind Frontend (`frontend/src/App.jsx`)**: Responsive, judge-friendly UI with quick test-case presets, live inline corrections, and human review controls.

---

## 🚀 Quick Start Guide

### 1. Start the Backend API (FastAPI)

In your first terminal:
```powershell
# Navigate to the workspace root
cd D:\BrandShieldAI

# Start FastAPI server on port 8000
.\backend\.venv\Scripts\uvicorn.exe backend.app.main:app --reload --port 8000
```
- API Documentation (Swagger UI): `http://127.0.0.1:8000/docs`
- Health Check: `http://127.0.0.1:8000/api/health`

### 2. Start the Frontend (React + Vite)

In your second terminal:
```powershell
cd D:\BrandShieldAI\frontend
npm run dev
```
- Web Application: `http://localhost:5173`

---

## 🧪 Running Automated Tests

Run all 15 unit and API integration tests:
```powershell
cd D:\BrandShieldAI
$env:PYTHONPATH="backend"
.\backend\.venv\Scripts\pytest.exe backend\tests -v
```
