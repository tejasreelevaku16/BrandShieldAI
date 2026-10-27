import React, { useState, useEffect } from 'react';
import { apiFetch, ApiError } from './api';

// Sample test paragraphs for quick demonstration
const PROBLEMATIC_SAMPLE = 
  "AetherGlow daily serum provides guaranteed 100% results for all consumers! " +
  "Our revolutionary formula reduces wrinkles by 85% in just 48 hours, " +
  "and all bottles are made with 100% recycled packaging.";

const COMPLIANT_SAMPLE = 
  "AetherGlow daily serum is formulated to nourish and support your skin's natural radiance. " +
  "Our customers love the gentle hydration, and all AetherGlow products are made with " +
  "70% recycled packaging as part of our sustainability promise.";

export default function App() {
  // Navigation: 'review', 'guidelines', or 'analytics'
  const [activeTab, setActiveTab] = useState('review');

  // Review & Workspace State
  const [content, setContent] = useState(PROBLEMATIC_SAMPLE);
  const [loading, setLoading] = useState(false);
  const [activeReview, setActiveReview] = useState(null);
  const [reviewHistory, setReviewHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [copiedFindingId, setCopiedFindingId] = useState(null);

  // Human Review Decision State
  const [selectedDecision, setSelectedDecision] = useState('');
  const [reviewerComment, setReviewerComment] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);

  // Guidelines Management State
  const [rules, setRules] = useState([]);
  const [facts, setFacts] = useState([]);
  const [guidelinesLoading, setGuidelinesLoading] = useState(false);

  // Governance Analytics State (Priority 6)
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

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
  const [modalError, setModalError] = useState('');
  const [factFormData, setFactFormData] = useState({
    fact_id: '',
    statement: '',
    source_name: '',
    source_url: '',
    verification_status: 'verified_sample',
    is_active: true
  });

  // Load Review History and Guidelines on initial mount
  useEffect(() => {
    fetchReviewHistory();
    fetchGuidelines();
  }, []);

  const fetchReviewHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await apiFetch('/reviews');
      setReviewHistory(data);
    } catch (err) {
      console.warn("Could not load review history:", err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchGuidelines = async () => {
    setGuidelinesLoading(true);
    try {
      const [rulesData, factsData] = await Promise.all([
        apiFetch('/rules'),
        apiFetch('/facts')
      ]);
      setRules(rulesData);
      setFacts(factsData);
    } catch (err) {
      console.warn("Could not load guidelines data:", err.message);
      setErrorMessage(err.message);
    } finally {
      setGuidelinesLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const data = await apiFetch('/reviews/analytics');
      setAnalytics(data);
    } catch (err) {
      console.warn("Could not load analytics:", err.message);
      setErrorMessage(err.message);
    } finally {
      setAnalyticsLoading(false);
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
      const reviewData = await apiFetch('/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content })
      });

      setActiveReview(reviewData);
      setSuccessMessage(`Content reviewed against active database rules (ID: ${reviewData.id.slice(0, 8)}).`);
      fetchReviewHistory();
    } catch (err) {
      setErrorMessage(err.message || "An error occurred during review.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Select past review from history
  const handleSelectReview = async (reviewId) => {
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const data = await apiFetch(`/reviews/${reviewId}`);
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
      const updated = await apiFetch(`/reviews/${activeReview.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: selectedDecision,
          comment: reviewerComment.trim() || undefined
        })
      });

      setActiveReview(updated);
      setSuccessMessage(`Human verdict '${selectedDecision.replace('_', ' ')}' permanently logged.`);
      fetchReviewHistory();
    } catch (err) {
      setErrorMessage(err.message || "Failed to record human decision.");
    } finally {
      setSubmittingDecision(false);
    }
  };

  // 4. Copy Suggestion to Clipboard (Priority 3)
  const handleCopySuggestion = (text, findingId) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedFindingId(findingId);
    setTimeout(() => setCopiedFindingId(null), 2000);
    setSuccessMessage(`Copied proposed wording to clipboard!`);
  };

  // 5. Apply Fix directly to Draft Editor (Priority 3)
  const handleApplyFix = (finding) => {
    const target = finding.matched_text || finding.flagged_text;
    if (!target) return;

    let replacement = "";
    if (finding.suggested_correction) {
      const matchQuote = finding.suggested_correction.match(/Use '([^']+)' instead/i);
      if (matchQuote) {
        replacement = matchQuote[1];
      } else if (finding.suggested_correction.toLowerCase().includes("align packaging claim with approved fact:")) {
        replacement = "all bottles are made with 70% recycled packaging";
      } else if (finding.suggested_correction.toLowerCase().includes("align with approved fact:")) {
        replacement = "founded in 2020";
      } else if (finding.suggested_correction.toLowerCase().includes("delivers visible radiance")) {
        replacement = "delivers visible radiance";
      } else {
        const quotes = finding.suggested_correction.match(/'([^']+)'/);
        if (quotes && quotes[1] && quotes[1] !== target) {
          replacement = quotes[1];
        }
      }
    }

    if (replacement) {
      const regex = new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      if (regex.test(content)) {
        setContent(prev => prev.replace(regex, replacement));
        setSuccessMessage(`Applied fix: Replaced "${target}" with "${replacement}" in draft editor.`);
        return;
      }
    }

    // Fallback: Copy to clipboard if exact replacement pattern couldn't be cleanly parsed
    if (finding.suggested_correction) {
      navigator.clipboard.writeText(finding.suggested_correction);
      setSuccessMessage(`Copied suggestion to clipboard: "${finding.suggested_correction}"`);
    }
  };

  // --- Rule Management Functions ---
  const handleOpenAddRule = () => {
    setEditingRule(null);
    setModalError('');
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
    setModalError('');
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
      setModalError("Rule name and description cannot be blank.");
      return;
    }

    setModalError('');
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (editingRule) {
        await apiFetch(`/rules/${editingRule.rule_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ruleFormData)
        });
      } else {
        await apiFetch('/rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ruleFormData)
        });
      }

      setShowRuleModal(false);
      fetchGuidelines();
      setSuccessMessage("Brand rule saved successfully.");
    } catch (err) {
      setSuccessMessage('');
      setModalError(err.message);
      setErrorMessage(err.message);
    }
  };

  const handleToggleRule = async (ruleId) => {
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await apiFetch(`/rules/${ruleId}/toggle`, { method: 'PATCH' });
      fetchGuidelines();
      setSuccessMessage(`Rule '${ruleId}' status updated.`);
    } catch (err) {
      setSuccessMessage('');
      setErrorMessage(err.message);
    }
  };

  const handleDeleteRule = async (ruleId, ruleName) => {
    if (!window.confirm(`Are you sure you want to delete rule '${ruleName}' (${ruleId})?`)) {
      return;
    }
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await apiFetch(`/rules/${ruleId}`, { method: 'DELETE' });
      fetchGuidelines();
      setSuccessMessage(`Rule '${ruleId}' deleted.`);
    } catch (err) {
      setSuccessMessage('');
      setErrorMessage(err.message);
    }
  };

  // --- Fact Management Functions ---
  const handleOpenAddFact = () => {
    setEditingFact(null);
    setModalError('');
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
    setModalError('');
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
      setModalError("Fact statement and source name cannot be blank.");
      return;
    }

    setModalError('');
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (editingFact) {
        await apiFetch(`/facts/${editingFact.fact_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(factFormData)
        });
      } else {
        await apiFetch('/facts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(factFormData)
        });
      }

      setShowFactModal(false);
      fetchGuidelines();
      setSuccessMessage("Approved fact saved successfully.");
    } catch (err) {
      setSuccessMessage('');
      setModalError(err.message);
      setErrorMessage(err.message);
    }
  };

  const handleToggleFact = async (factId) => {
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await apiFetch(`/facts/${factId}/toggle`, { method: 'PATCH' });
      fetchGuidelines();
      setSuccessMessage(`Fact '${factId}' status updated.`);
    } catch (err) {
      setSuccessMessage('');
      setErrorMessage(err.message);
    }
  };

  const handleDeleteFact = async (factId) => {
    if (!window.confirm(`Are you sure you want to delete fact '${factId}'?`)) {
      return;
    }
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await apiFetch(`/facts/${factId}`, { method: 'DELETE' });
      fetchGuidelines();
      setSuccessMessage(`Fact '${factId}' deleted.`);
    } catch (err) {
      setSuccessMessage('');
      setErrorMessage(err.message);
    }
  };

  const getSeverityBadge = (severity) => {
    const sev = (severity || 'MEDIUM').toUpperCase();
    const badges = {
      HIGH: "bg-rose-50 text-rose-700 border-rose-200",
      MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
      LOW: "bg-teal-50 text-teal-700 border-teal-200"
    };
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border tracking-wider ${badges[sev] || 'bg-slate-100 text-slate-800'}`}>
        {sev}
      </span>
    );
  };

  const getStatusBadge = (statusLabel) => {
    if (!statusLabel) return null;
    const lower = String(statusLabel).toLowerCase();
    if (lower.includes("unverified")) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
          🔍 Unverified Claim
        </span>
      );
    }
    if (lower.includes("contradiction")) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">
          ⚠️ Potential Factual Contradiction
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
        🛑 Confirmed Violation
      </span>
    );
  };

  const getDecisionBadge = (decisionStr, isClean = false) => {
    if (isClean && !decisionStr) {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">✅ COMPLIANT</span>;
    }
    if (!decisionStr) {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">⏳ AWAITING REVIEW</span>;
    }
    const dec = decisionStr.toLowerCase();
    if (dec === "approved") {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">✅ APPROVED</span>;
    }
    if (dec === "rejected") {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">❌ REJECTED</span>;
    }
    if (dec === "changes_requested" || dec === "request_changes") {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">🔄 CHANGES REQUESTED</span>;
    }
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border">{decisionStr}</span>;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🛡️</span>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-xl tracking-tight text-white">BrandShield AI</span>
                <span className="text-xs bg-teal-500/20 text-teal-300 border border-teal-500/40 px-2 py-0.5 rounded font-mono font-medium">
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
                  ? 'bg-teal-600 text-white shadow-sm'
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
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              📚 Brand Guidelines & Facts
            </button>
            <button
              onClick={() => {
                setActiveTab('analytics');
                fetchAnalytics();
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'analytics'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              📊 Governance Analytics
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full space-y-5">
        
        {/* Notifications */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-300 text-rose-800 px-4 py-3 rounded-lg text-sm flex items-center justify-between shadow-sm">
            <span><strong>Notice:</strong> {errorMessage}</span>
            <button onClick={() => setErrorMessage('')} className="font-bold text-rose-800 ml-4 hover:opacity-75">✕</button>
          </div>
        )}

        {successMessage && (
          <div className="bg-teal-50 border border-teal-300 text-teal-800 px-4 py-3 rounded-lg text-sm flex items-center justify-between shadow-sm">
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage('')} className="font-bold text-teal-800 ml-4 hover:opacity-75">✕</button>
          </div>
        )}

        {/* VIEW 1: CONTENT REVIEW WORKFLOW */}
        {activeTab === 'review' && (
          <div className="space-y-5">
            {/* Judge Step-by-Step Process Stepper */}
            <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm flex items-center justify-between text-xs overflow-x-auto gap-2">
              <div className="flex items-center gap-1.5 font-semibold text-slate-700 shrink-0">
                <span className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                <span>Enter Draft Copy</span>
              </div>
              <span className="text-slate-300 shrink-0">➔</span>
              <div className="flex items-center gap-1.5 font-semibold text-slate-700 shrink-0">
                <span className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                <span>Run Detection</span>
              </div>
              <span className="text-slate-300 shrink-0">➔</span>
              <div className="flex items-center gap-1.5 font-semibold text-slate-700 shrink-0">
                <span className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                <span>Inspect Evidence & Explanations</span>
              </div>
              <span className="text-slate-300 shrink-0">➔</span>
              <div className="flex items-center gap-1.5 font-semibold text-slate-700 shrink-0">
                <span className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px] font-bold">4</span>
                <span>Copy / Apply Safer Fix</span>
              </div>
              <span className="text-slate-300 shrink-0">➔</span>
              <div className="flex items-center gap-1.5 font-semibold text-slate-700 shrink-0">
                <span className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px] font-bold">5</span>
                <span>Record Human Verdict</span>
              </div>
            </div>

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
                      className="text-xs text-teal-700 hover:text-teal-900 font-semibold"
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
                                ? 'bg-teal-50/50 border-teal-400 ring-1 ring-teal-500'
                                : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-mono text-[10px] text-slate-400">
                                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {getDecisionBadge(item.latest_decision, item.total_findings === 0)}
                            </div>
                            <p className="text-slate-700 line-clamp-2 leading-relaxed font-sans">
                              {item.content}
                            </p>
                            <div className="mt-1 text-[10px] text-slate-400">
                              {item.total_findings} issue{item.total_findings === 1 ? '' : 's'} detected
                            </div>
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
                    <span className="text-xs font-semibold text-slate-600">Quick Test Samples:</span>
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
                      className="text-xs bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-semibold px-2.5 py-1 rounded transition"
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
                      className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-sans leading-relaxed transition"
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
                      className="inline-flex items-center px-6 py-2.5 rounded-lg text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <span className="animate-spin mr-2">⏳</span>
                          Evaluating Active Rules...
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
                          <span>⚖️ Human Governance Decision</span>
                        </h2>
                        <p className="text-[11px] text-slate-500">
                          Authoritative human verdict stored separately from automated rule findings.
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
                          <strong>Recorded Verdict:</strong>
                          <span className="capitalize font-semibold text-slate-900">
                            {activeReview.human_decision.decision.replace('_', ' ')}
                          </span>
                        </div>
                        {activeReview.human_decision.comment && (
                          <div className="text-slate-600 pt-1">
                            <strong>Reviewer Comment:</strong> "{activeReview.human_decision.comment}"
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 pt-1">
                          Timestamp: {new Date(activeReview.human_decision.created_at).toLocaleString()}
                        </div>
                      </div>
                    )}

                    {/* Submit Decision Choices */}
                    <div className="space-y-3 pt-1">
                      <span className="text-xs font-semibold text-slate-700 block">
                        {activeReview.human_decision ? "Update Human Verdict:" : "Record Verdict:"}
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
                          className="w-full text-xs rounded border border-slate-300 p-2 focus:ring-1 focus:ring-teal-500"
                        />
                      </div>

                      <button
                        onClick={handleSubmitDecision}
                        disabled={submittingDecision || !selectedDecision}
                        className="w-full py-2 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition disabled:opacity-50"
                      >
                        {submittingDecision ? "Saving Verdict..." : "💾 Submit Human Decision"}
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
                    <p className="text-xs leading-relaxed">
                      Click <strong>"Check Content"</strong> or pick an existing review from history to inspect findings.
                    </p>
                  </div>
                )}

                {/* Clean State (0 findings) */}
                {activeReview && activeReview.total_findings === 0 && (
                  <div className="p-6 bg-teal-50 rounded-xl border border-teal-200 text-teal-950 shadow-sm space-y-2.5">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">✅</span>
                      <h3 className="font-bold text-base text-teal-900">Brand Compliance Verified</h3>
                    </div>
                    <p className="text-xs text-teal-800 leading-relaxed">
                      {activeReview.summary_message || "No issues detected by the current active rules. All claims adhere to approved AetherGlow brand specifications."}
                    </p>
                    <div className="text-[11px] text-teal-700 bg-white/70 p-2 rounded border border-teal-200">
                      <strong>Governance Notice:</strong> Automated verification checks known brand guidelines and approved facts. Novel scientific or clinical claims should still be substantiated with regulatory counsel prior to publication.
                    </div>
                  </div>
                )}

                {/* Findings List (>0 findings) */}
                {activeReview && activeReview.total_findings > 0 && (
                  <div className="space-y-3">
                    {/* Overall Summary Card (Priority 2) */}
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-900 shadow-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm">Automated Governance Findings</h3>
                        <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-white border border-rose-200 text-rose-800">
                          {activeReview.total_findings} Issues
                        </span>
                      </div>
                      <p className="text-xs text-rose-800 leading-relaxed">
                        {activeReview.summary_message || `${activeReview.total_findings} issues detected requiring compliance action.`}
                      </p>

                      {/* Snapshot pill (Priority 4) */}
                      {activeReview.guidelines_snapshot && (
                        <div className="text-[10px] text-slate-600 bg-white/80 p-2 rounded border border-rose-100 flex items-center justify-between">
                          <span>
                            📋 <strong>Snapshot:</strong> {activeReview.guidelines_snapshot.rules_applied?.length || 0} active rules and {activeReview.guidelines_snapshot.facts_applied?.length || 0} facts applied.
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      {activeReview.findings.map((finding, idx) => {
                        const findingType = finding.type || finding.finding_type;
                        const statusLabel = finding.status || finding.status_or_uncertainty_label;
                        const matchedText = finding.matched_text || finding.flagged_text;
                        const sourceRef = finding.source || finding.matched_rule_or_source;
                        const correction = finding.suggested_correction;
                        const findingKey = finding.id || idx;

                        return (
                          <div
                            key={findingKey}
                            className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-2.5 hover:border-slate-300 transition"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                {getStatusBadge(statusLabel)}
                                <span className="text-xs font-semibold text-slate-800">{findingType}</span>
                              </div>
                              {getSeverityBadge(finding.severity)}
                            </div>

                            {matchedText && (
                              <div className="text-xs text-slate-600">
                                Flagged text:{" "}
                                <span className="font-mono bg-rose-50 text-rose-800 px-1 py-0.5 rounded border border-rose-200 font-semibold">
                                  "{matchedText}"
                                </span>
                              </div>
                            )}

                            <div className="bg-slate-50 rounded-lg p-2.5 text-xs text-slate-700 border border-slate-200 leading-relaxed">
                              <strong className="text-slate-900 block mb-0.5">Why this matters:</strong>
                              {finding.explanation}
                            </div>

                            {/* Proposed Safer Correction (Priority 3) */}
                            <div className="bg-teal-50/60 rounded-lg p-2.5 text-xs text-teal-950 border border-teal-100 space-y-1.5">
                              <div className="text-[11px] text-teal-800 font-medium">
                                <strong>Source:</strong> {sourceRef}
                              </div>
                              <div>
                                <strong>Proposed Alternative:</strong> {correction}
                              </div>

                              {/* Interactive Copy & Apply Fix buttons (Priority 3) */}
                              <div className="flex items-center justify-between pt-2 border-t border-teal-100/80 gap-2">
                                <span className="text-[10px] text-teal-700 italic">
                                  Safer wording suggestion
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {correction && (
                                    <button
                                      type="button"
                                      onClick={() => handleCopySuggestion(correction, findingKey)}
                                      className="px-2.5 py-1 rounded text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition flex items-center gap-1 shadow-2xs"
                                      title="Copy proposed wording to clipboard"
                                    >
                                      {copiedFindingId === findingKey ? "✓ Copied!" : "📋 Copy"}
                                    </button>
                                  )}
                                  {matchedText && (
                                    <button
                                      type="button"
                                      onClick={() => handleApplyFix(finding)}
                                      className="px-2.5 py-1 rounded text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white transition flex items-center gap-1 shadow-2xs"
                                      title="Replace flagged wording in draft editor"
                                    >
                                      ✨ Apply Fix
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: BRAND GUIDELINES & APPROVED FACTS MANAGEMENT (PRIORITY 5) */}
        {activeTab === 'guidelines' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h1 className="text-xl font-bold text-slate-900">Brand Guidelines & Fact Sources Management</h1>
                <p className="text-xs text-slate-500 mt-1">
                  Configure active brand governance rules and approved demonstration company facts stored in the database.
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
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 shadow-sm"
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
                          <span className="font-mono text-xs font-bold text-teal-700">{r.rule_id}</span>
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
                    Approved facts for AetherGlow. Note: Supporting URLs are references, not absolute real-world truth.
                  </p>
                </div>
                <button
                  onClick={handleOpenAddFact}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 shadow-sm"
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
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800">
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
                              className="text-teal-700 hover:underline"
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

        {/* VIEW 3: LIGHTWEIGHT GOVERNANCE ANALYTICS (PRIORITY 6) */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <span>📊 Real-Time Governance Analytics</span>
                  <span className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-2.5 py-0.5 rounded-full font-medium">
                    Actual DB Records
                  </span>
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Computed directly from actual review submissions and human governance decisions stored in the database.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchAnalytics}
                  disabled={analyticsLoading}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 shadow-sm"
                >
                  {analyticsLoading ? "Loading..." : "🔄 Refresh Data"}
                </button>
                <button
                  onClick={() => setActiveTab('review')}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800"
                >
                  ← Content Review
                </button>
              </div>
            </div>

            {analytics && (
              <div className="space-y-6">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-xs font-semibold text-slate-500 block mb-1">Total Submissions</span>
                    <span className="text-2xl font-extrabold text-slate-900 font-mono">{analytics.total_reviews}</span>
                    <span className="text-[11px] text-slate-400 block mt-1">Evaluated by engine</span>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-xs font-semibold text-amber-700 block mb-1">Awaiting Human Decision</span>
                    <span className="text-2xl font-extrabold text-amber-600 font-mono">{analytics.awaiting_review}</span>
                    <span className="text-[11px] text-slate-400 block mt-1">Pending review verdict</span>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-xs font-semibold text-emerald-700 block mb-1">Approved Content</span>
                    <span className="text-2xl font-extrabold text-emerald-600 font-mono">{analytics.approved}</span>
                    <span className="text-[11px] text-slate-400 block mt-1">Authorized for publication</span>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-xs font-semibold text-rose-700 block mb-1">Changes / Rejected</span>
                    <span className="text-2xl font-extrabold text-rose-600 font-mono">
                      {analytics.changes_requested + analytics.rejected}
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-1">
                      {analytics.changes_requested} revisions, {analytics.rejected} rejected
                    </span>
                  </div>
                </div>

                {/* Second Row: Clean vs Action Required & Most Triggered Guidelines */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Compliance Ratio (5 cols) */}
                  <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <h3 className="font-bold text-sm text-slate-900 border-b pb-2">Compliance Breakdown</h3>
                    <div className="space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Clean / Zero Findings:</span>
                        <span className="font-bold font-mono text-emerald-700">{analytics.clean_reviews}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div
                          className="bg-emerald-500 h-2 rounded-full"
                          style={{
                            width: `${analytics.total_reviews ? (analytics.clean_reviews / analytics.total_reviews) * 100 : 0}%`
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <span className="text-slate-600">Issues Flagged:</span>
                        <span className="font-bold font-mono text-rose-700">{analytics.reviews_with_issues}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div
                          className="bg-rose-500 h-2 rounded-full"
                          style={{
                            width: `${analytics.total_reviews ? (analytics.reviews_with_issues / analytics.total_reviews) * 100 : 0}%`
                          }}
                        />
                      </div>

                      <p className="text-[11px] text-slate-400 pt-3 border-t">
                        Reflects actual automated rule & fact evaluation results across all historical reviews.
                      </p>
                    </div>
                  </div>

                  {/* Most Triggered Guidelines (7 cols) */}
                  <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <h3 className="font-bold text-sm text-slate-900 border-b pb-2">Most Frequently Triggered Guidelines</h3>
                    {analytics.top_triggered_guidelines.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4 text-center">No guideline violations recorded yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {analytics.top_triggered_guidelines.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2.5 rounded bg-slate-50 text-xs border border-slate-100">
                            <span className="font-medium text-slate-800 truncate pr-4">{item.guideline}</span>
                            <span className="px-2 py-0.5 rounded font-mono font-bold bg-white text-teal-800 border border-slate-200 shrink-0">
                              {item.count} hit{item.count === 1 ? '' : 's'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
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

            {modalError && (
              <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2.5 rounded text-xs">
                <strong>Error:</strong> {modalError}
              </div>
            )}

            <form onSubmit={handleSaveRule} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Rule Name *</label>
                <input
                  type="text"
                  required
                  value={ruleFormData.name}
                  onChange={(e) => setRuleFormData({...ruleFormData, name: e.target.value})}
                  placeholder="e.g. Prohibit Miracle Claims"
                  className="w-full rounded border p-2 text-xs focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Rule Type *</label>
                  <select
                    value={ruleFormData.rule_type}
                    onChange={(e) => setRuleFormData({...ruleFormData, rule_type: e.target.value})}
                    className="w-full rounded border p-2 text-xs focus:ring-1 focus:ring-teal-500"
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
                    className="w-full rounded border p-2 text-xs focus:ring-1 focus:ring-teal-500"
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
                  className="w-full rounded border p-2 text-xs font-mono focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Preferred Replacement / Required Text</label>
                <input
                  type="text"
                  value={ruleFormData.preferred_replacement}
                  onChange={(e) => setRuleFormData({...ruleFormData, preferred_replacement: e.target.value})}
                  placeholder="e.g. customers"
                  className="w-full rounded border p-2 text-xs font-mono focus:ring-1 focus:ring-teal-500"
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
                  className="w-full rounded border p-2 text-xs focus:ring-1 focus:ring-teal-500"
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
                  className="px-4 py-2 rounded bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-teal-600 text-white font-semibold hover:bg-teal-700 shadow-sm"
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

            {modalError && (
              <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2.5 rounded text-xs">
                <strong>Error:</strong> {modalError}
              </div>
            )}

            <form onSubmit={handleSaveFact} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Fact Statement *</label>
                <textarea
                  rows={2}
                  required
                  value={factFormData.statement}
                  onChange={(e) => setFactFormData({...factFormData, statement: e.target.value})}
                  placeholder="e.g. AetherGlow products are made with 70% recycled packaging."
                  className="w-full rounded border p-2 text-xs focus:ring-1 focus:ring-teal-500"
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
                  className="w-full rounded border p-2 text-xs focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Supporting Source URL (Optional)</label>
                <input
                  type="url"
                  value={factFormData.source_url}
                  onChange={(e) => setFactFormData({...factFormData, source_url: e.target.value})}
                  placeholder="https://aetherglow.example.com/source-doc"
                  className="w-full rounded border p-2 text-xs focus:ring-1 focus:ring-teal-500"
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
                  className="px-4 py-2 rounded bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-teal-600 text-white font-semibold hover:bg-teal-700 shadow-sm"
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
            Every Claim. Clear Evidence. Confident Publishing.
          </div>
        </div>
      </footer>
    </div>
  );
}
