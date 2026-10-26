import React, { useState, useEffect } from 'react';

// Sample paragraph containing several intentional brand-rule issues
const PROBLEMATIC_SAMPLE = 
  "AetherGlow daily serum provides guaranteed 100% results for all consumers! " +
  "Our revolutionary formula reduces wrinkles by 85% in just 48 hours, " +
  "and all bottles are made with 100% recycled packaging.";

// Fully compliant sample paragraph
const COMPLIANT_SAMPLE = 
  "AetherGlow daily serum is formulated to nourish and support your skin's natural radiance. " +
  "Our customers love the gentle hydration, and all AetherGlow products are made with " +
  "70% recycled packaging as part of our sustainability promise.";

export default function App() {
  const [content, setContent] = useState(PROBLEMATIC_SAMPLE);
  const [loading, setLoading] = useState(false);
  const [activeReview, setActiveReview] = useState(null);
  const [reviewHistory, setReviewHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showRules, setShowRules] = useState(false);

  // Human Review State
  const [selectedDecision, setSelectedDecision] = useState('');
  const [reviewerComment, setReviewerComment] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);

  // Fetch Review History on mount
  useEffect(() => {
    fetchReviewHistory();
  }, []);

  const fetchReviewHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/reviews');
      if (!res.ok) throw new Error("Failed to load review history");
      const data = await res.json();
      setReviewHistory(data);
    } catch (err) {
      console.warn("Could not load review history:", err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  // 1. Check Content & Save Review via POST /reviews
  const handleCheckContent = async () => {
    if (!content.trim()) {
      setErrorMessage("Marketing content cannot be empty. Please enter or load text to check.");
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    setSelectedDecision('');
    setReviewerComment('');

    try {
      const response = await fetch('/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const detailMsg = errData.detail?.[0]?.msg || errData.detail || "Server returned an error";
        throw new Error(detailMsg);
      }

      const reviewData = await response.json();
      setActiveReview(reviewData);
      setSuccessMessage(`Review record saved to database (ID: ${reviewData.id.slice(0, 8)}).`);
      
      // Refresh history list
      fetchReviewHistory();
    } catch (err) {
      if (err.message && err.message.includes("Failed to fetch")) {
        setErrorMessage("Unable to connect to the backend server. Please ensure FastAPI is running on port 8000.");
      } else {
        setErrorMessage(err.message || "An unexpected error occurred during review.");
      }
    } finally {
      setLoading(false);
    }
  };

  // 2. Load existing review from History via GET /reviews/{id}
  const handleSelectReview = async (reviewId) => {
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const res = await fetch(`/reviews/${reviewId}`);
      if (!res.ok) throw new Error("Could not retrieve review record.");
      const data = await res.json();
      setActiveReview(data);
      setContent(data.content);
      setSelectedDecision('');
      setReviewerComment('');
    } catch (err) {
      setErrorMessage(err.message || "Failed to load selected review.");
    }
  };

  // 3. Submit Human Governance Decision via POST /reviews/{id}/decision
  const handleSubmitDecision = async () => {
    if (!activeReview || !activeReview.id) {
      setErrorMessage("No active review selected to record decision on.");
      return;
    }
    if (!selectedDecision) {
      setErrorMessage("Please select a decision (Approve, Reject, or Request Changes) before submitting.");
      return;
    }

    setSubmittingDecision(true);
    setErrorMessage('');

    try {
      const res = await fetch(`/reviews/${activeReview.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: selectedDecision,
          comment: reviewerComment.trim() || undefined
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to submit decision.");
      }

      const updatedReview = await res.json();
      setActiveReview(updatedReview);
      setSuccessMessage(`Human decision '${selectedDecision}' successfully saved and logged.`);
      
      // Update history
      fetchReviewHistory();
    } catch (err) {
      setErrorMessage(err.message || "Failed to record human decision.");
    } finally {
      setSubmittingDecision(false);
    }
  };

  const getSeverityBadge = (severity) => {
    const badges = {
      HIGH: "bg-red-100 text-red-800 border-red-300",
      MEDIUM: "bg-amber-100 text-amber-800 border-amber-300",
      LOW: "bg-blue-100 text-blue-800 border-blue-300"
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-bold border ${badges[severity] || 'bg-slate-100 text-slate-800'}`}>
        {severity}
      </span>
    );
  };

  const getStatusBadge = (statusLabel) => {
    if (statusLabel === "Unverified claim") {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300">
          🔍 {statusLabel}
        </span>
      );
    }
    if (statusLabel === "Factual Contradiction") {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
          ⚠️ {statusLabel}
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
        🛑 {statusLabel}
      </span>
    );
  };

  const getDecisionBadge = (decisionStr) => {
    if (!decisionStr) return null;
    const dec = decisionStr.toLowerCase();
    if (dec === "approved") {
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✅ APPROVED</span>;
    }
    if (dec === "rejected") {
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">❌ REJECTED</span>;
    }
    if (dec === "changes_requested") {
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">🔄 CHANGES REQUESTED</span>;
    }
    return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border">{decisionStr}</span>;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🛡️</span>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-xl tracking-tight text-white">BrandShield AI</span>
                <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded font-mono">
                  Team AETHORA
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Every Claim. Clear Evidence. Confident Publishing.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="text-right hidden sm:block">
              <span className="text-xs text-slate-400 block">Brand Context</span>
              <span className="text-xs font-semibold text-emerald-400">AetherGlow</span>
            </div>
            <button
              onClick={() => setShowRules(!showRules)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              📖 {showRules ? 'Hide Rules' : 'View AetherGlow Rules'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full space-y-6">
        
        {/* Error Notification */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-300 text-rose-800 px-4 py-3 rounded-lg text-sm flex items-center justify-between shadow-sm">
            <span><strong>Error:</strong> {errorMessage}</span>
            <button onClick={() => setErrorMessage('')} className="font-bold text-rose-800 ml-4 hover:opacity-75">✕</button>
          </div>
        )}

        {/* Success Notification */}
        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-lg text-sm flex items-center justify-between shadow-sm">
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage('')} className="font-bold text-emerald-800 ml-4 hover:opacity-75">✕</button>
          </div>
        )}

        {/* Brand Rules Reference Drawer */}
        {showRules && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3 text-sm">
            <h2 className="font-bold text-slate-900 border-b pb-2 flex items-center gap-2">
              <span>📋 AetherGlow Brand Governance Guidelines</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-700">
              <div className="p-3 bg-slate-50 rounded-lg border">
                <strong className="text-rose-700 block mb-1">1. Prohibited Phrase</strong>
                Never use "guaranteed 100% results" or promise unconditional outcomes.
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border">
                <strong className="text-blue-700 block mb-1">2. Required Terminology</strong>
                Always refer to our audience as "customers", never as "consumers".
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border">
                <strong className="text-emerald-700 block mb-1">3. Approved Fact</strong>
                "AetherGlow products are made with 70% recycled packaging."
              </div>
            </div>
          </div>
        )}

        {/* 3-Column Layout: History | Editor & Decision | Findings */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Column 1: Review History Sidebar (3 cols) */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <span>📂 Review History</span>
                </h3>
                <button
                  onClick={fetchReviewHistory}
                  disabled={historyLoading}
                  className="text-xs text-indigo-600 hover:text-indigo-800"
                >
                  {historyLoading ? "..." : "🔄 Refresh"}
                </button>
              </div>

              {reviewHistory.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">No reviews in database yet.</p>
              ) : (
                <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
                  {reviewHistory.map((item) => {
                    const isSelected = activeReview && activeReview.id === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelectReview(item.id)}
                        className={`p-3 rounded-lg border text-xs cursor-pointer transition ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-400'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-[10px] text-slate-400">
                            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {item.latest_decision ? (
                            getDecisionBadge(item.latest_decision)
                          ) : (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              item.total_findings === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {item.total_findings} finding{item.total_findings === 1 ? '' : 's'}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-700 line-clamp-2 leading-relaxed">
                          {item.content}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Editor & Human Review Decision (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Editor Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">1. Marketing Content Draft</h2>
                <span className="text-xs text-slate-400 font-mono">
                  {content.trim().split(/\s+/).filter(Boolean).length} words
                </span>
              </div>

              {/* Sample Loading Buttons */}
              <div className="flex flex-wrap gap-2 items-center bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-xs font-semibold text-slate-600">Quick Test:</span>
                <button
                  onClick={() => {
                    setContent(PROBLEMATIC_SAMPLE);
                    setActiveReview(null);
                    setErrorMessage('');
                  }}
                  className="text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold px-2.5 py-1 rounded transition"
                >
                  ⚠️ Load Problematic Sample
                </button>
                <button
                  onClick={() => {
                    setContent(COMPLIANT_SAMPLE);
                    setActiveReview(null);
                    setErrorMessage('');
                  }}
                  className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold px-2.5 py-1 rounded transition"
                >
                  ✅ Load Compliant Sample
                </button>
              </div>

              {/* Text Area */}
              <div>
                <textarea
                  rows={8}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste or write marketing text here for brand-rule review..."
                  className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-sans leading-relaxed transition"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => {
                    setContent('');
                    setActiveReview(null);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 transition"
                >
                  Clear Text
                </button>
                <button
                  onClick={handleCheckContent}
                  disabled={loading}
                  className="inline-flex items-center px-6 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      Checking Content...
                    </>
                  ) : (
                    <>
                      <span>🔍 Check Content</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Human Governance Review Decision Box */}
            {activeReview && (
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="border-b pb-2 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <span>⚖️ Human Review Decision</span>
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Authoritative human verdict stored separately from automated findings.
                    </p>
                  </div>
                  {activeReview.human_decision && (
                    <div>{getDecisionBadge(activeReview.human_decision.decision)}</div>
                  )}
                </div>

                {/* Display Current Decision if already recorded */}
                {activeReview.human_decision && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-700">
                      <strong>Current Verdict:</strong>
                      <span className="capitalize font-semibold text-slate-900">{activeReview.human_decision.decision.replace('_', ' ')}</span>
                    </div>
                    {activeReview.human_decision.comment && (
                      <div className="text-slate-600 pt-1">
                        <strong>Reviewer Comment:</strong> "{activeReview.human_decision.comment}"
                      </div>
                    )}
                    <div className="text-[10px] text-slate-400 pt-1">
                      Logged at: {new Date(activeReview.human_decision.created_at).toLocaleString()}
                    </div>
                  </div>
                )}

                {/* Submit New / Updated Decision */}
                <div className="space-y-3 pt-1">
                  <span className="text-xs font-semibold text-slate-700 block">
                    {activeReview.human_decision ? "Update Decision:" : "Choose Verdict:"}
                  </span>

                  {/* 3 Decision Choice Buttons */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedDecision('approved')}
                      className={`py-2 px-2 rounded-lg text-xs font-bold border transition ${
                        selectedDecision === 'approved'
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      ✅ Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDecision('changes_requested')}
                      className={`py-2 px-2 rounded-lg text-xs font-bold border transition ${
                        selectedDecision === 'changes_requested'
                          ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                          : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                      }`}
                    >
                      🔄 Request Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDecision('rejected')}
                      className={`py-2 px-2 rounded-lg text-xs font-bold border transition ${
                        selectedDecision === 'rejected'
                          ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
                          : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                      }`}
                    >
                      ❌ Reject
                    </button>
                  </div>

                  {/* Reviewer Comment */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Reviewer Comment (Optional):
                    </label>
                    <textarea
                      rows={2}
                      value={reviewerComment}
                      onChange={(e) => setReviewerComment(e.target.value)}
                      placeholder="Add compliance notes, rationale, or requested edits..."
                      className="w-full text-xs rounded border border-slate-300 p-2 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <button
                    onClick={handleSubmitDecision}
                    disabled={submittingDecision || !selectedDecision}
                    className="w-full py-2 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition disabled:opacity-50"
                  >
                    {submittingDecision ? "Saving Decision..." : "💾 Submit Human Decision"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Column 3: Real Explained Findings (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            
            {/* Initial Placeholder State */}
            {!activeReview && !loading && (
              <div className="p-8 bg-white rounded-xl border border-dashed border-slate-300 text-center text-slate-400 space-y-2">
                <span className="text-4xl block">📝</span>
                <h3 className="text-sm font-semibold text-slate-700">Ready to Check</h3>
                <p className="text-xs">
                  Click <strong>"Check Content"</strong> or pick an existing review from the history to inspect explained findings.
                </p>
              </div>
            )}

            {/* Clear Success State: 0 findings */}
            {activeReview && activeReview.total_findings === 0 && (
              <div className="p-6 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 shadow-sm space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">✅</span>
                  <h3 className="font-bold text-base">Brand Compliance Verified</h3>
                </div>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  No issues found! This content adheres to all AetherGlow brand rules, terminology guidelines, and approved specifications. Ready for publishing.
                </p>
              </div>
            )}

            {/* Findings List */}
            {activeReview && activeReview.total_findings > 0 && (
              <div className="space-y-3">
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center justify-between text-rose-900 shadow-sm">
                  <div>
                    <h3 className="font-bold text-sm">Automated Rule Findings</h3>
                    <p className="text-xs text-rose-700 mt-0.5">
                      {activeReview.total_findings} finding{activeReview.total_findings === 1 ? '' : 's'} identified by the engine.
                    </p>
                  </div>
                  <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-white border border-rose-200 text-rose-800">
                    {activeReview.total_findings} Issues
                  </span>
                </div>

                <div className="space-y-3">
                  {activeReview.findings.map((finding, idx) => (
                    <div
                      key={finding.id || idx}
                      className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-2.5 hover:border-slate-300 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {getStatusBadge(finding.status_or_uncertainty_label)}
                          <span className="text-xs font-semibold text-slate-800">{finding.finding_type}</span>
                        </div>
                        {getSeverityBadge(finding.severity)}
                      </div>

                      {finding.flagged_text && (
                        <div className="text-xs text-slate-600">
                          Flagged text:{" "}
                          <span className="font-mono bg-rose-50 text-rose-800 px-1 py-0.5 rounded border border-rose-200 font-semibold">
                            "{finding.flagged_text}"
                          </span>
                        </div>
                      )}

                      <div className="bg-slate-50 rounded-lg p-2.5 text-xs text-slate-700 border border-slate-200 leading-relaxed">
                        <strong className="text-slate-900 block mb-0.5">Why this matters:</strong>
                        {finding.explanation}
                      </div>

                      <div className="bg-indigo-50/60 rounded-lg p-2.5 text-xs text-indigo-950 border border-indigo-100 space-y-1">
                        <div className="text-[11px] text-indigo-700 font-medium">
                          <strong>Source:</strong> {finding.matched_rule_or_source}
                        </div>
                        <div>
                          <strong>Correction:</strong> {finding.suggested_correction}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div>
            <strong>BrandShield AI</strong> • Built for CodeStar 30 Round 2 • Team: <strong>AETHORA</strong>
          </div>
          <div>
            FastAPI Persistent Storage (SQLite) • React & Tailwind Review Workflow
          </div>
        </div>
      </footer>
    </div>
  );
}
