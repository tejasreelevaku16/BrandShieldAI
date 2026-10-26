import React, { useState, useEffect } from 'react';

// Sample test paragraphs
const PROBLEMATIC_SAMPLE = 
  "AetherGlow daily serum provides guaranteed 100% results for all consumers! " +
  "Our revolutionary formula reduces wrinkles by 85% in just 48 hours, " +
  "and all bottles are made with 100% recycled packaging.";

const COMPLIANT_SAMPLE = 
  "AetherGlow daily serum is formulated to nourish and support your skin's natural radiance. " +
  "Our customers love the gentle hydration, and all AetherGlow products are made with " +
  "70% recycled packaging as part of our sustainability promise.";

export default function App() {
  // Navigation: 'review' or 'guidelines'
  const [activeTab, setActiveTab] = useState('review');

  // Review & Workspace State
  const [content, setContent] = useState(PROBLEMATIC_SAMPLE);
  const [loading, setLoading] = useState(false);
  const [activeReview, setActiveReview] = useState(null);
  const [reviewHistory, setReviewHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Human Review Decision State
  const [selectedDecision, setSelectedDecision] = useState('');
  const [reviewerComment, setReviewerComment] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);

  // Guidelines Management State
  const [rules, setRules] = useState([]);
  const [facts, setFacts] = useState([]);
  const [guidelinesLoading, setGuidelinesLoading] = useState(false);

  // Modals / Forms
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleFormData, setRuleFormData] = useState({
    rule_id: '',
    name: '',
    rule_type: 'prohibited_phrase',
    severity: 'MEDIUM',
    prohibited_phrase: '',
    preferred_replacement: '',
    description: '',
    is_active: true
  });

  const [showFactModal, setShowFactModal] = useState(false);
  const [editingFact, setEditingFact] = useState(null);
  const [factFormData, setFactFormData] = useState({
    fact_id: '',
    statement: '',
    source_name: '',
    source_url: '',
    verification_status: 'verified_sample',
    is_active: true
  });

  // Load Review History and Guidelines on mount
  useEffect(() => {
    fetchReviewHistory();
    fetchGuidelines();
  }, []);

  const fetchReviewHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/reviews');
      if (res.ok) {
        const data = await res.json();
        setReviewHistory(data);
      }
    } catch (err) {
      console.warn("Could not load review history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchGuidelines = async () => {
    setGuidelinesLoading(true);
    try {
      const [rulesRes, factsRes] = await Promise.all([
        fetch('/rules'),
        fetch('/facts')
      ]);
      if (rulesRes.ok) setRules(await rulesRes.json());
      if (factsRes.ok) setFacts(await factsRes.json());
    } catch (err) {
      console.warn("Could not load guidelines data:", err);
    } finally {
      setGuidelinesLoading(false);
    }
  };

  // 1. Submit Content for Review
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
        throw new Error(errData.detail?.[0]?.msg || errData.detail || "Server error");
      }

      const reviewData = await response.json();
      setActiveReview(reviewData);
      setSuccessMessage(`Content reviewed against active database rules (ID: ${reviewData.id.slice(0, 8)}).`);
      fetchReviewHistory();
    } catch (err) {
      if (err.message && err.message.includes("Failed to fetch")) {
        setErrorMessage("Unable to connect to the backend server. Please verify that FastAPI is running on port 8000.");
      } else {
        setErrorMessage(err.message || "An error occurred during review.");
      }
    } finally {
      setLoading(false);
    }
  };

  // 2. Select past review
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

  // 3. Submit human governance decision
  const handleSubmitDecision = async () => {
    if (!activeReview || !activeReview.id) {
      setErrorMessage("No active review selected.");
      return;
    }
    if (!selectedDecision) {
      setErrorMessage("Please select a decision (Approve, Reject, or Request Changes).");
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

      const updated = await res.json();
      setActiveReview(updated);
      setSuccessMessage(`Human decision '${selectedDecision}' logged.`);
      fetchReviewHistory();
    } catch (err) {
      setErrorMessage(err.message || "Failed to record human decision.");
    } finally {
      setSubmittingDecision(false);
    }
  };

  // --- Rule Management Functions ---
  const handleOpenAddRule = () => {
    setEditingRule(null);
    setRuleFormData({
      rule_id: '',
      name: '',
      rule_type: 'prohibited_phrase',
      severity: 'MEDIUM',
      prohibited_phrase: '',
      preferred_replacement: '',
      description: '',
      is_active: true
    });
    setShowRuleModal(true);
  };

  const handleOpenEditRule = (rule) => {
    setEditingRule(rule);
    setRuleFormData({
      rule_id: rule.rule_id,
      name: rule.name,
      rule_type: rule.rule_type,
      severity: rule.severity,
      prohibited_phrase: rule.prohibited_phrase || '',
      preferred_replacement: rule.preferred_replacement || '',
      description: rule.description,
      is_active: rule.is_active
    });
    setShowRuleModal(true);
  };

  const handleSaveRule = async (e) => {
    e.preventDefault();
    if (!ruleFormData.name.trim() || !ruleFormData.description.trim()) {
      alert("Rule name and description cannot be blank.");
      return;
    }

    try {
      if (editingRule) {
        // Update existing rule
        const res = await fetch(`/rules/${editingRule.rule_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ruleFormData)
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || "Failed to update rule.");
        }
      } else {
        // Create new rule
        const res = await fetch('/rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ruleFormData)
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || "Failed to create rule.");
        }
      }

      setShowRuleModal(false);
      fetchGuidelines();
      setSuccessMessage("Brand rule saved successfully.");
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleRule = async (ruleId) => {
    try {
      const res = await fetch(`/rules/${ruleId}/toggle`, { method: 'PATCH' });
      if (!res.ok) throw new Error("Failed to toggle rule");
      fetchGuidelines();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteRule = async (ruleId, ruleName) => {
    if (!window.confirm(`Are you sure you want to delete rule '${ruleName}' (${ruleId})?`)) {
      return;
    }
    try {
      const res = await fetch(`/rules/${ruleId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Failed to delete rule");
      fetchGuidelines();
      setSuccessMessage(`Rule '${ruleId}' deleted.`);
    } catch (err) {
      alert(err.message);
    }
  };

  // --- Fact Management Functions ---
  const handleOpenAddFact = () => {
    setEditingFact(null);
    setFactFormData({
      fact_id: '',
      statement: '',
      source_name: '',
      source_url: '',
      verification_status: 'verified_sample',
      is_active: true
    });
    setShowFactModal(true);
  };

  const handleOpenEditFact = (fact) => {
    setEditingFact(fact);
    setFactFormData({
      fact_id: fact.fact_id,
      statement: fact.statement,
      source_name: fact.source_name,
      source_url: fact.source_url || '',
      verification_status: fact.verification_status,
      is_active: fact.is_active
    });
    setShowFactModal(true);
  };

  const handleSaveFact = async (e) => {
    e.preventDefault();
    if (!factFormData.statement.trim() || !factFormData.source_name.trim()) {
      alert("Fact statement and source name cannot be blank.");
      return;
    }

    try {
      if (editingFact) {
        const res = await fetch(`/facts/${editingFact.fact_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(factFormData)
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || "Failed to update fact.");
        }
      } else {
        const res = await fetch('/facts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(factFormData)
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || "Failed to create fact.");
        }
      }

      setShowFactModal(false);
      fetchGuidelines();
      setSuccessMessage("Approved fact saved successfully.");
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleFact = async (factId) => {
    try {
      const res = await fetch(`/facts/${factId}/toggle`, { method: 'PATCH' });
      if (!res.ok) throw new Error("Failed to toggle fact");
      fetchGuidelines();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteFact = async (factId) => {
    if (!window.confirm(`Are you sure you want to delete fact '${factId}'?`)) {
      return;
    }
    try {
      const res = await fetch(`/facts/${factId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Failed to delete fact");
      fetchGuidelines();
      setSuccessMessage(`Fact '${factId}' deleted.`);
    } catch (err) {
      alert(err.message);
    }
  };

  const getSeverityBadge = (severity) => {
    const badges = {
      HIGH: "bg-red-100 text-red-800 border-red-300",
      MEDIUM: "bg-amber-100 text-amber-800 border-amber-300",
      LOW: "bg-blue-100 text-blue-800 border-blue-300"
    };
    return (
      <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${badges[severity] || 'bg-slate-100 text-slate-800'}`}>
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
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✅ APPROVED</span>;
    }
    if (dec === "rejected") {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">❌ REJECTED</span>;
    }
    if (dec === "changes_requested") {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">🔄 CHANGES REQUESTED</span>;
    }
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border">{decisionStr}</span>;
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
              <p className="text-xs text-slate-400 hidden sm:block">
                Every Claim. Clear Evidence. Confident Publishing.
              </p>
            </div>
          </div>

          {/* Navigation Switcher */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('review')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'review'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              📝 Content Review
            </button>
            <button
              onClick={() => {
                setActiveTab('guidelines');
                fetchGuidelines();
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'guidelines'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              📚 Brand Guidelines & Facts
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full space-y-5">
        
        {/* Notifications */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-300 text-rose-800 px-4 py-3 rounded-lg text-sm flex items-center justify-between shadow-sm">
            <span><strong>Error:</strong> {errorMessage}</span>
            <button onClick={() => setErrorMessage('')} className="font-bold text-rose-800 ml-4 hover:opacity-75">✕</button>
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-lg text-sm flex items-center justify-between shadow-sm">
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage('')} className="font-bold text-emerald-800 ml-4 hover:opacity-75">✕</button>
          </div>
        )}

        {/* VIEW 1: CONTENT REVIEW WORKFLOW */}
        {activeTab === 'review' && (
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
                    placeholder="Write or paste marketing copy to check against active brand rules..."
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
                        Checking with Active Rules...
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

                  {/* Submit Decision Choices */}
                  <div className="space-y-3 pt-1">
                    <span className="text-xs font-semibold text-slate-700 block">
                      {activeReview.human_decision ? "Update Decision:" : "Choose Verdict:"}
                    </span>

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
              {!activeReview && !loading && (
                <div className="p-8 bg-white rounded-xl border border-dashed border-slate-300 text-center text-slate-400 space-y-2">
                  <span className="text-4xl block">📝</span>
                  <h3 className="text-sm font-semibold text-slate-700">Ready to Check</h3>
                  <p className="text-xs">
                    Click <strong>"Check Content"</strong> or pick an existing review to inspect explained findings.
                  </p>
                </div>
              )}

              {activeReview && activeReview.total_findings === 0 && (
                <div className="p-6 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 shadow-sm space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">✅</span>
                    <h3 className="font-bold text-base">Brand Compliance Verified</h3>
                  </div>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    No issues found! This content adheres to all active AetherGlow brand rules and approved specifications. Ready for publishing.
                  </p>
                </div>
              )}

              {activeReview && activeReview.total_findings > 0 && (
                <div className="space-y-3">
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center justify-between text-rose-900 shadow-sm">
                    <div>
                      <h3 className="font-bold text-sm">Automated Rule Findings</h3>
                      <p className="text-xs text-rose-700 mt-0.5">
                        {activeReview.total_findings} finding{activeReview.total_findings === 1 ? '' : 's'} identified by the active engine.
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
        )}

        {/* VIEW 2: BRAND GUIDELINES & APPROVED FACTS MANAGEMENT (TASK 4) */}
        {activeTab === 'guidelines' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h1 className="text-xl font-bold text-slate-900">Brand Guidelines & Fact Sources Management</h1>
                <p className="text-xs text-slate-500 mt-1">
                  Configure active brand governance rules and approved demonstration company facts stored in SQLite.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('review')}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800"
              >
                ← Return to Content Review
              </button>
            </div>

            {/* SECTION 1: BRAND RULES */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>📋 Brand Governance Rules</span>
                    <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-mono">
                      {rules.length} Rules
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Active rules are dynamically evaluated on all future content reviews without code changes.
                  </p>
                </div>
                <button
                  onClick={handleOpenAddRule}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                >
                  ➕ Add New Rule
                </button>
              </div>

              {rules.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No brand rules configured.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {rules.map((r) => (
                    <div key={r.id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-indigo-700">{r.rule_id}</span>
                          <span className="font-semibold text-sm text-slate-900">{r.name}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700">
                            {r.rule_type}
                          </span>
                          {getSeverityBadge(r.severity)}
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {r.is_active ? '● Active' : '○ Disabled'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">{r.description}</p>
                        {(r.prohibited_phrase || r.preferred_replacement) && (
                          <div className="text-[11px] text-slate-500 flex gap-4 pt-0.5">
                            {r.prohibited_phrase && <span>Detect: <code className="bg-rose-50 text-rose-700 px-1 py-0.5 rounded font-mono font-bold">{r.prohibited_phrase}</code></span>}
                            {r.preferred_replacement && <span>Replacement: <code className="bg-emerald-50 text-emerald-700 px-1 py-0.5 rounded font-mono font-bold">{r.preferred_replacement}</code></span>}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-start md:self-center">
                        <button
                          onClick={() => handleToggleRule(r.rule_id)}
                          className={`text-xs px-2.5 py-1 rounded font-semibold border transition ${
                            r.is_active ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {r.is_active ? "Disable" : "Enable"}
                        </button>
                        <button
                          onClick={() => handleOpenEditRule(r)}
                          className="text-xs px-2.5 py-1 rounded font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 border"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDeleteRule(r.rule_id, r.name)}
                          className="text-xs px-2.5 py-1 rounded font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SECTION 2: APPROVED FACT SOURCES */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>📖 Approved Fact Sources (Sample Demonstration Brand)</span>
                    <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-mono">
                      {facts.length} Facts
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Sample facts for AetherGlow. Note: Source URLs are supporting references, not automatic real-world truth.
                  </p>
                </div>
                <button
                  onClick={handleOpenAddFact}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                >
                  ➕ Add Approved Fact
                </button>
              </div>

              {facts.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No approved facts configured.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {facts.map((f) => (
                    <div key={f.id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-emerald-700">{f.fact_id}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                            {f.verification_status}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            f.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {f.is_active ? '● Active' : '○ Disabled'}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-900">"{f.statement}"</p>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span><strong>Source:</strong> {f.source_name}</span>
                          {f.source_url && (
                            <a
                              href={f.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-600 hover:underline"
                            >
                              🔗 Reference Link
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start md:self-center">
                        <button
                          onClick={() => handleToggleFact(f.fact_id)}
                          className={`text-xs px-2.5 py-1 rounded font-semibold border transition ${
                            f.is_active ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {f.is_active ? "Disable" : "Enable"}
                        </button>
                        <button
                          onClick={() => handleOpenEditFact(f)}
                          className="text-xs px-2.5 py-1 rounded font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 border"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDeleteFact(f.fact_id)}
                          className="text-xs px-2.5 py-1 rounded font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: ADD / EDIT RULE */}
      {showRuleModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-base font-bold text-slate-900">
                {editingRule ? `Edit Rule: ${editingRule.rule_id}` : "Add New Brand Rule"}
              </h3>
              <button onClick={() => setShowRuleModal(false)} className="font-bold text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Rule Name *</label>
                <input
                  type="text"
                  required
                  value={ruleFormData.name}
                  onChange={(e) => setRuleFormData({...ruleFormData, name: e.target.value})}
                  placeholder="e.g. Prohibit Miracle Claims"
                  className="w-full rounded border p-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Rule Type *</label>
                  <select
                    value={ruleFormData.rule_type}
                    onChange={(e) => setRuleFormData({...ruleFormData, rule_type: e.target.value})}
                    className="w-full rounded border p-2 text-xs"
                  >
                    <option value="prohibited_phrase">Prohibited Phrase</option>
                    <option value="preferred_terminology">Preferred Terminology</option>
                    <option value="required_phrase">Required Phrase</option>
                    <option value="custom_text">Custom Text Match</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Severity *</label>
                  <select
                    value={ruleFormData.severity}
                    onChange={(e) => setRuleFormData({...ruleFormData, severity: e.target.value})}
                    className="w-full rounded border p-2 text-xs"
                  >
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phrase to Detect / Prohibited Phrase</label>
                <input
                  type="text"
                  value={ruleFormData.prohibited_phrase}
                  onChange={(e) => setRuleFormData({...ruleFormData, prohibited_phrase: e.target.value})}
                  placeholder="e.g. guaranteed 100% results"
                  className="w-full rounded border p-2 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Preferred Replacement / Required Text</label>
                <input
                  type="text"
                  value={ruleFormData.preferred_replacement}
                  onChange={(e) => setRuleFormData({...ruleFormData, preferred_replacement: e.target.value})}
                  placeholder="e.g. customers"
                  className="w-full rounded border p-2 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Rule Description & Explanation *</label>
                <textarea
                  rows={3}
                  required
                  value={ruleFormData.description}
                  onChange={(e) => setRuleFormData({...ruleFormData, description: e.target.value})}
                  placeholder="Explain why this rule exists and why it matters..."
                  className="w-full rounded border p-2 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="rule_active"
                  checked={ruleFormData.is_active}
                  onChange={(e) => setRuleFormData({...ruleFormData, is_active: e.target.checked})}
                />
                <label htmlFor="rule_active" className="font-semibold text-slate-700">Enable this rule immediately</label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowRuleModal(false)}
                  className="px-4 py-2 rounded bg-slate-100 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
                >
                  Save Brand Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT FACT */}
      {showFactModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-base font-bold text-slate-900">
                {editingFact ? `Edit Fact: ${editingFact.fact_id}` : "Add Approved Fact"}
              </h3>
              <button onClick={() => setShowFactModal(false)} className="font-bold text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleSaveFact} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Fact Statement *</label>
                <textarea
                  rows={2}
                  required
                  value={factFormData.statement}
                  onChange={(e) => setFactFormData({...factFormData, statement: e.target.value})}
                  placeholder="e.g. AetherGlow products are made with 70% recycled packaging."
                  className="w-full rounded border p-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Source Name / Document Reference *</label>
                <input
                  type="text"
                  required
                  value={factFormData.source_name}
                  onChange={(e) => setFactFormData({...factFormData, source_name: e.target.value})}
                  placeholder="e.g. AetherGlow Packaging Audit 2025"
                  className="w-full rounded border p-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Supporting Source URL (Optional)</label>
                <input
                  type="url"
                  value={factFormData.source_url}
                  onChange={(e) => setFactFormData({...factFormData, source_url: e.target.value})}
                  placeholder="https://aetherglow.example.com/source-doc"
                  className="w-full rounded border p-2 text-xs"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">Note: Source URLs provide supporting context, not automatic real-world truth.</span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="fact_active"
                  checked={factFormData.is_active}
                  onChange={(e) => setFactFormData({...factFormData, is_active: e.target.checked})}
                />
                <label htmlFor="fact_active" className="font-semibold text-slate-700">Activate this fact in verification</label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowFactModal(false)}
                  className="px-4 py-2 rounded bg-slate-100 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
                >
                  Save Fact Source
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div>
            <strong>BrandShield AI</strong> • Built for CodeStar 30 Round 2 • Team: <strong>AETHORA</strong>
          </div>
          <div>
            SQLite Editable Guidelines & Fact Sources • Dynamic Rule Verification Engine
          </div>
        </div>
      </footer>
    </div>
  );
}
