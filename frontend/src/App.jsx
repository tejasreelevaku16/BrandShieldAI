import React, { useState } from 'react';

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
  const [reviewResult, setReviewResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [showRules, setShowRules] = useState(false);

  // Calls POST /review
  const handleCheckContent = async () => {
    if (!content.trim()) {
      setErrorMessage("Marketing content cannot be empty. Please enter or load text to check.");
      setReviewResult(null);
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setReviewResult(null);

    try {
      const response = await fetch('/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: content })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const detailMsg = errData.detail?.[0]?.msg || errData.detail || "Server returned an error";
        throw new Error(detailMsg);
      }

      const data = await response.json();
      setReviewResult(data);
    } catch (err) {
      if (err.message && err.message.includes("Failed to fetch")) {
        setErrorMessage("Unable to connect to the backend server. Please verify that FastAPI is running on port 8000.");
      } else {
        setErrorMessage(err.message || "An unexpected error occurred during review.");
      }
    } finally {
      setLoading(false);
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
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
      <main className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full space-y-6">
        
        {/* Error Notification */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-300 text-rose-800 px-4 py-3 rounded-lg text-sm flex items-center justify-between shadow-sm">
            <span><strong>Error:</strong> {errorMessage}</span>
            <button onClick={() => setErrorMessage('')} className="font-bold text-rose-800 ml-4 hover:opacity-75">✕</button>
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

        {/* 2-Column Main Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Text Area & Controls (6 cols) */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">Marketing Content Draft</h2>
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
                    setReviewResult(null);
                    setErrorMessage('');
                  }}
                  className="text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold px-2.5 py-1 rounded transition"
                >
                  ⚠️ Load Problematic Sample
                </button>
                <button
                  onClick={() => {
                    setContent(COMPLIANT_SAMPLE);
                    setReviewResult(null);
                    setErrorMessage('');
                  }}
                  className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold px-2.5 py-1 rounded transition"
                >
                  ✅ Load Compliant Sample
                </button>
              </div>

              {/* Marketing Content Text Area */}
              <div>
                <textarea
                  rows={9}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste or write marketing text here for brand-rule review..."
                  className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-sans leading-relaxed transition"
                />
              </div>

              {/* Check Content Button */}
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => {
                    setContent('');
                    setReviewResult(null);
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
          </div>

          {/* Right Column: Real Explained Findings (6 cols) */}
          <div className="lg:col-span-6 space-y-4">
            
            {/* Initial State / Before Check */}
            {!reviewResult && !loading && (
              <div className="p-8 bg-white rounded-xl border border-dashed border-slate-300 text-center text-slate-400 space-y-2">
                <span className="text-4xl block">📝</span>
                <h3 className="text-sm font-semibold text-slate-700">Ready to Check</h3>
                <p className="text-xs max-w-sm mx-auto">
                  Click <strong>"Check Content"</strong> or load one of the test samples to run the AetherGlow brand rule engine.
                </p>
              </div>
            )}

            {/* Clear Success State: 0 findings */}
            {reviewResult && reviewResult.total_findings === 0 && (
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

            {/* Findings Display: When issues are detected */}
            {reviewResult && reviewResult.total_findings > 0 && (
              <div className="space-y-3">
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center justify-between text-rose-900 shadow-sm">
                  <div>
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <span>🚨 Action Required</span>
                    </h3>
                    <p className="text-xs text-rose-700 mt-0.5">
                      {reviewResult.total_findings} finding{reviewResult.total_findings === 1 ? '' : 's'} identified by the rule engine.
                    </p>
                  </div>
                  <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-white border border-rose-200 text-rose-800">
                    {reviewResult.total_findings} Issues
                  </span>
                </div>

                {/* List of Real Findings */}
                <div className="space-y-3">
                  {reviewResult.findings.map((finding, idx) => (
                    <div
                      key={finding.id || idx}
                      className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3 hover:border-slate-300 transition"
                    >
                      {/* Header: Finding Type & Badges */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(finding.status_or_uncertainty_label)}
                          <span className="text-xs font-semibold text-slate-800">
                            {finding.finding_type}
                          </span>
                        </div>
                        {getSeverityBadge(finding.severity)}
                      </div>

                      {/* Flagged Text Snippet */}
                      {finding.flagged_text && (
                        <div className="text-xs text-slate-600">
                          Detected in text:{" "}
                          <span className="font-mono bg-rose-50 text-rose-800 px-1.5 py-0.5 rounded border border-rose-200 font-semibold">
                            "{finding.flagged_text}"
                          </span>
                        </div>
                      )}

                      {/* Explanation */}
                      <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-700 border border-slate-200 leading-relaxed">
                        <strong className="text-slate-900 block mb-0.5">Why this matters:</strong>
                        {finding.explanation}
                      </div>

                      {/* Matched Rule & Suggested Correction */}
                      <div className="bg-indigo-50/60 rounded-lg p-3 text-xs text-indigo-950 border border-indigo-100 space-y-1.5">
                        <div className="text-[11px] text-indigo-700 font-medium">
                          <strong>Matched Source:</strong> {finding.matched_rule_or_source}
                        </div>
                        <div>
                          <strong>Suggested Correction:</strong> {finding.suggested_correction}
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
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div>
            <strong>BrandShield AI</strong> • Built for CodeStar 30 Round 2 • Team: <strong>AETHORA</strong>
          </div>
          <div>
            FastAPI Rule Engine (POST /review) • React & Tailwind UI
          </div>
        </div>
      </footer>
    </div>
  );
}
