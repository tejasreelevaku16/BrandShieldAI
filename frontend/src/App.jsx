import React, { useState, useEffect } from 'react';

const PRESETS = [
  {
    label: "High Violations Sample",
    text: "Nova Pulse is a miracle cure for insomnia! With our revolutionary tracker featuring 14 days of battery life and 100% accurate ECG readings, it reduces stress cortisol by 45% within two weeks. Recommended by 9 out of 10 doctors. Enjoy our 60-day money-back guarantee."
  },
  {
    label: "Factual Contradictions Sample",
    text: "NovaPulse is certified waterproof up to 100 meters for deep-sea diving, trusted by over 10 million users worldwide. Get yours today with our official 30-day risk-free money-back guarantee."
  },
  {
    label: "Fully Compliant Sample",
    text: "NovaPulse Band is engineered to support your daily wellness journey. Featuring up to 7 days of battery life and 50 meters of water resistance, it tracks your vital metrics with validated 98.2% correlation with clinical ECG standards. Joined by over 250,000 active members. Backed by our 30-day risk-free money-back guarantee.\n\nThese statements have not been evaluated by the FDA. This product is not intended to diagnose, treat, cure, or prevent any disease."
  }
];

export default function App() {
  const [copyText, setCopyText] = useState(PRESETS[0].text);
  const [loading, setLoading] = useState(false);
  const [submissionId, setSubmissionId] = useState(null);
  const [analysisSummary, setAnalysisSummary] = useState(null);
  const [findings, setFindings] = useState([]);
  const [reviewDecision, setReviewDecision] = useState(null);
  const [reviewerName, setReviewerName] = useState('Compliance Lead');
  const [reviewNotes, setReviewNotes] = useState('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [guidelinesData, setGuidelinesData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Fetch brand rules and verified facts on mount
  useEffect(() => {
    fetch('/api/brand-guidelines')
      .then(res => res.json())
      .then(data => setGuidelinesData(data))
      .catch(err => console.error("Error loading brand guidelines:", err));
  }, []);

  const handleRunCheck = async () => {
    if (!copyText.trim()) {
      setErrorMessage("Please enter or select marketing text before analyzing.");
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    setReviewDecision(null);

    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: copyText })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail?.[0]?.msg || errorData.detail || "Verification failed");
      }

      const data = await res.json();
      setSubmissionId(data.submission_id);
      setAnalysisSummary(data.summary);
      setFindings(data.findings);
      setSuccessMessage("Verification check completed successfully.");
    } catch (err) {
      setErrorMessage(err.message || "Failed to connect to verification backend. Make sure FastAPI server is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCorrection = (finding) => {
    if (!finding.suggested_correction) return;
    
    // Quick inline replacement if specific flagged text is present
    if (finding.flagged_text && finding.flagged_text !== "(Document Scope)" && copyText.includes(finding.flagged_text)) {
      let replacement = finding.suggested_correction;
      // Extract quoted replacement if available (e.g. 'NovaPulse')
      const quoteMatch = finding.suggested_correction.match(/'([^']+)'/);
      if (quoteMatch) {
        replacement = quoteMatch[1];
      }
      setCopyText(prev => prev.replace(finding.flagged_text, replacement));
      setSuccessMessage(`Applied suggested correction for: "${finding.flagged_text}"`);
    } else if (finding.rule_or_evidence_id === "RULE-002") {
      // Append required FDA disclaimer
      const disclaimer = "\n\nThese statements have not been evaluated by the FDA. This product is not intended to diagnose, treat, cure, or prevent any disease.";
      if (!copyText.includes(disclaimer.trim())) {
        setCopyText(prev => prev.trim() + disclaimer);
        setSuccessMessage("Appended mandatory FDA regulatory disclaimer.");
      }
    } else {
      setSuccessMessage(`Note suggested fix: ${finding.suggested_correction}`);
    }
  };

  const handleSubmitDecision = async (decision) => {
    if (!submissionId) {
      setErrorMessage("Run an analysis check before submitting a governance decision.");
      return;
    }
    if (!reviewerName.trim()) {
      setErrorMessage("Please provide a reviewer name before submitting decision.");
      return;
    }

    setIsSubmittingDecision(true);
    setErrorMessage('');

    try {
      const res = await fetch(`/api/submissions/${submissionId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          reviewer_name: reviewerName,
          notes: reviewNotes || undefined
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to record decision.");
      }

      const reviewData = await res.json();
      setReviewDecision(reviewData);
      setSuccessMessage(`Decision "${decision}" recorded in database by ${reviewerName}.`);
    } catch (err) {
      setErrorMessage(err.message || "Failed to submit decision.");
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const getCategoryBadge = (category) => {
    switch (category) {
      case 'RULE_VIOLATION':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            🛑 Rule Violation
          </span>
        );
      case 'FACTUAL_CONTRADICTION':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            ⚠️ Factual Contradiction
          </span>
        );
      case 'UNSUPPORTED_CLAIM':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300">
            🔍 Unsupported Claim
          </span>
        );
      default:
        return null;
    }
  };

  const getSeverityBadge = (severity) => {
    const colors = {
      HIGH: "bg-red-600 text-white",
      MEDIUM: "bg-amber-500 text-white",
      LOW: "bg-blue-600 text-white"
    };
    return (
      <span className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-wider ${colors[severity] || 'bg-slate-600 text-white'}`}>
        {severity}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🛡️</span>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-xl tracking-tight text-white">BrandShield AI</span>
                <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded font-mono">
                  Team AETHORA
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Every Claim. Clear Evidence. Confident Publishing.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="text-right hidden md:block">
              <span className="text-xs text-slate-400 block">Fictional Brand Context</span>
              <span className="text-xs font-semibold text-emerald-400">NovaPulse Health Technologies</span>
            </div>
            <button
              onClick={() => setShowGuidelines(!showGuidelines)}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              📖 {showGuidelines ? 'Hide Brand Rules' : 'Inspect Brand Rules & Facts'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        
        {/* Alerts / Feedback Banner */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-300 text-rose-800 px-4 py-3 rounded-lg text-sm flex items-center justify-between shadow-sm">
            <span><strong>Error:</strong> {errorMessage}</span>
            <button onClick={() => setErrorMessage('')} className="font-bold ml-4">✕</button>
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-lg text-sm flex items-center justify-between shadow-sm">
            <span><strong>Success:</strong> {successMessage}</span>
            <button onClick={() => setSuccessMessage('')} className="font-bold ml-4">✕</button>
          </div>
        )}

        {/* Collapsible Brand Guidelines & Ground Truth Panel */}
        {showGuidelines && guidelinesData && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>📚 Approved Brand Rules & Verified Hardware Specifications</span>
              </h2>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded font-mono">
                {guidelinesData.profile.legal_entity}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              {/* Brand Rules */}
              <div>
                <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  Active Compliance Rules ({guidelinesData.rules.length})
                </h3>
                <div className="space-y-2">
                  {guidelinesData.rules.map(rule => (
                    <div key={rule.rule_id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-900">{rule.rule_id}: {rule.title}</span>
                        {getSeverityBadge(rule.severity)}
                      </div>
                      <p className="text-xs text-slate-600">{rule.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Verified Specs / Ground Truth */}
              <div>
                <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Verified Ground Truth Specifications ({guidelinesData.verified_facts.length})
                </h3>
                <div className="space-y-2">
                  {guidelinesData.verified_facts.map(fact => (
                    <div key={fact.fact_id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-900">{fact.fact_id}: {fact.topic}</span>
                        <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Verified: {fact.verified_value} {fact.unit}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{fact.ground_truth}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2-Column Workflow Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Editor & Submission (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">1. Draft Marketing Copy</h2>
                  <p className="text-xs text-slate-500">Edit or select a sample copy to verify claims against brand governance.</p>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {copyText.trim().split(/\s+/).filter(Boolean).length} words | {copyText.length} chars
                </span>
              </div>

              {/* Quick Preset Selector */}
              <div className="flex flex-wrap gap-2 items-center bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-xs font-semibold text-slate-600">Quick Test Cases:</span>
                {PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setCopyText(preset.text);
                      setFindings([]);
                      setAnalysisSummary(null);
                      setSubmissionId(null);
                      setReviewDecision(null);
                    }}
                    className="text-xs bg-white hover:bg-slate-100 text-slate-700 px-2.5 py-1 rounded border border-slate-300 font-medium transition"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Text Area */}
              <div>
                <textarea
                  rows={8}
                  value={copyText}
                  onChange={(e) => setCopyText(e.target.value)}
                  placeholder="Paste marketing copy, press release, or ad copy here..."
                  className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-sans leading-relaxed transition"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setCopyText('')}
                  className="text-xs text-slate-500 hover:text-slate-800 transition"
                >
                  Clear Editor
                </button>
                <button
                  onClick={handleRunCheck}
                  disabled={loading}
                  className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      Analyzing Claims...
                    </>
                  ) : (
                    <>
                      <span>🔍 Run Pre-Publication Verification</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Human Governance Review Decision Box */}
            {submissionId && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="border-b pb-3">
                  <h2 className="text-base font-bold text-slate-900 flex items-center justify-between">
                    <span>2. Human Governance Decision</span>
                    {reviewDecision && (
                      <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase ${
                        reviewDecision.decision === 'APPROVE' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                        reviewDecision.decision === 'REJECT' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                        'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}>
                        Decision Recorded: {reviewDecision.decision}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-500">
                    A human must review all explained findings and record an authoritative publishing verdict in the database.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Reviewer Name</label>
                    <input
                      type="text"
                      value={reviewerName}
                      onChange={(e) => setReviewerName(e.target.value)}
                      placeholder="e.g. Compliance Officer Jane"
                      className="w-full text-xs rounded border border-slate-300 p-2 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Review Notes / Reasoning</label>
                    <input
                      type="text"
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="e.g. Requires removal of cortisol claim prior to publish"
                      className="w-full text-xs rounded border border-slate-300 p-2 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Decision Buttons */}
                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    onClick={() => handleSubmitDecision('APPROVE')}
                    disabled={isSubmittingDecision}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-2.5 px-3 rounded-lg shadow-sm transition disabled:opacity-50"
                  >
                    ✅ Approve for Publishing
                  </button>
                  <button
                    onClick={() => handleSubmitDecision('REQUEST_CHANGES')}
                    disabled={isSubmittingDecision}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs py-2.5 px-3 rounded-lg shadow-sm transition disabled:opacity-50"
                  >
                    🔄 Request Changes
                  </button>
                  <button
                    onClick={() => handleSubmitDecision('REJECT')}
                    disabled={isSubmittingDecision}
                    className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs py-2.5 px-3 rounded-lg shadow-sm transition disabled:opacity-50"
                  >
                    ❌ Reject Publication
                  </button>
                </div>

                {reviewDecision && (
                  <div className="p-3 bg-slate-50 rounded border border-slate-200 text-xs text-slate-600 space-y-1">
                    <div><strong>Signed By:</strong> {reviewDecision.reviewer_name}</div>
                    {reviewDecision.notes && <div><strong>Notes:</strong> {reviewDecision.notes}</div>}
                    <div className="text-[11px] text-slate-400"><strong>Audit Timestamp:</strong> {new Date(reviewDecision.decided_at).toLocaleString()}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Explained Findings Inspector (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Status Summary Banner */}
            {analysisSummary ? (
              <div className={`p-4 rounded-xl border shadow-sm ${
                analysisSummary.status === 'CLEAN' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
                analysisSummary.status === 'ACTION_REQUIRED' ? 'bg-rose-50 border-rose-200 text-rose-900' :
                'bg-amber-50 border-amber-200 text-amber-900'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    {analysisSummary.status === 'CLEAN' ? '✅ All Brand Checks Passed' :
                     analysisSummary.status === 'ACTION_REQUIRED' ? '🚨 Action Required' : '⚠️ Governance Warnings'}
                  </h3>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white/70">
                    {analysisSummary.total_findings} Finding{analysisSummary.total_findings === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs mt-3">
                  <div className="bg-white/80 p-2 rounded border border-slate-200/50">
                    <span className="block font-bold text-rose-700">{analysisSummary.rule_violations}</span>
                    <span className="text-[11px] text-slate-600">Rule Violations</span>
                  </div>
                  <div className="bg-white/80 p-2 rounded border border-slate-200/50">
                    <span className="block font-bold text-amber-700">{analysisSummary.factual_contradictions}</span>
                    <span className="text-[11px] text-slate-600">Contradictions</span>
                  </div>
                  <div className="bg-white/80 p-2 rounded border border-slate-200/50">
                    <span className="block font-bold text-purple-700">{analysisSummary.unsupported_claims}</span>
                    <span className="text-[11px] text-slate-600">Unsupported</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-white rounded-xl border border-dashed border-slate-300 text-center text-slate-400 space-y-2">
                <span className="text-3xl block">📋</span>
                <p className="text-xs">No analysis run yet. Click "Run Pre-Publication Verification" to inspect findings.</p>
              </div>
            )}

            {/* Findings List */}
            {findings.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-slate-900">
                  Detailed Findings & Recommendations ({findings.length})
                </h3>

                {findings.map((f, i) => (
                  <div key={f.id || i} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3 hover:border-slate-300 transition">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getCategoryBadge(f.category)}
                        <span className="text-xs font-mono font-semibold text-slate-500">{f.rule_or_evidence_id}</span>
                      </div>
                      {getSeverityBadge(f.severity)}
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">{f.issue}</h4>
                      {f.flagged_text && f.flagged_text !== "(Document Scope)" && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          Detected text: <span className="font-mono bg-rose-50 text-rose-700 px-1 py-0.5 rounded border border-rose-200">"{f.flagged_text}"</span>
                        </p>
                      )}
                    </div>

                    {/* Explanation */}
                    <div className="bg-slate-50 rounded-lg p-2.5 text-xs text-slate-700 border border-slate-200 leading-relaxed">
                      <strong>Why this matters:</strong> {f.explanation}
                    </div>

                    {/* Suggested Correction & Action */}
                    <div className="bg-indigo-50/60 rounded-lg p-2.5 text-xs text-indigo-900 border border-indigo-100 flex flex-col justify-between gap-2">
                      <div>
                        <strong>Recommended Correction:</strong> {f.suggested_correction}
                      </div>
                      <div className="text-right">
                        <button
                          onClick={() => handleApplyCorrection(f)}
                          className="inline-flex items-center text-xs font-semibold text-indigo-700 hover:text-indigo-900 underline transition"
                        >
                          ⚡ Apply Suggested Fix to Editor
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div>
            <strong>BrandShield AI</strong> • Built for CodeStar 30 Round 2 Hackathon • Team: <strong>AETHORA</strong>
          </div>
          <div>
            FastAPI Deterministic Engine • React + Tailwind CSS • SQLite Storage
          </div>
        </div>
      </footer>
    </div>
  );
}
