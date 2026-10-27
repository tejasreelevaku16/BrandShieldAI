import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch, ApiError } from './api';

// Canonical Demonstration Samples for AetherGlow Brand Governance
const PROBLEMATIC_SAMPLE = 
  "AetherGlow daily serum provides guaranteed 100% results for all consumers! " +
  "Our revolutionary formula reduces wrinkles by 85% in just 48 hours, " +
  "and all bottles are made with 100% recycled packaging.";

const COMPLIANT_SAMPLE = 
  "AetherGlow daily serum is formulated to nourish and support your skin's natural radiance. " +
  "Our customers love the gentle hydration, and all AetherGlow products are made with " +
  "70% recycled packaging as part of our sustainability promise.";

export default function App() {
  // Navigation Tabs: 'review', 'guidelines', 'analytics'
  const [activeTab, setActiveTab] = useState('review');

  // Content Review Workspace
  const [content, setContent] = useState(PROBLEMATIC_SAMPLE);
  const [loading, setLoading] = useState(false);
  const [activeReview, setActiveReview] = useState(null);
  const [reviewHistory, setReviewHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all', 'clean', 'pending', 'approved', 'rejected'
  const [findingCategoryFilter, setFindingCategoryFilter] = useState('ALL'); // 'ALL', 'RULE_VIOLATION', 'FACTUAL_CONTRADICTION', 'UNSUPPORTED_CLAIM'

  // View Mode: 'editor' vs 'comparison' (Before & After Diff Preview)
  const [editorViewMode, setEditorViewMode] = useState('editor');

  // Notifications & User Feedback
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [copiedFindingId, setCopiedFindingId] = useState(null);

  // Human Governance Decision State
  const [selectedDecision, setSelectedDecision] = useState('');
  const [reviewerComment, setReviewerComment] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);

  // Brand Guidelines & Facts
  const [rules, setRules] = useState([]);
  const [facts, setFacts] = useState([]);
  const [guidelinesLoading, setGuidelinesLoading] = useState(false);
  const [guidelinesSearch, setGuidelinesSearch] = useState('');

  // Governance Analytics State
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Live System Status
  const [backendHealth, setBackendHealth] = useState({ status: 'checking', service: 'BrandShield AI' });
  const [semanticStatus, setSemanticStatus] = useState(null);

  // Modals
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

  // Initial Data Fetch
  useEffect(() => {
    checkSystemStatus();
    fetchReviewHistory();
    fetchGuidelines();
  }, []);

  const checkSystemStatus = async () => {
    try {
      const [h, s] = await Promise.all([
        apiFetch('/health'),
        apiFetch('/semantic-status')
      ]);
      setBackendHealth({ status: 'healthy', ...h });
      setSemanticStatus(s);
    } catch {
      setBackendHealth({ status: 'offline', service: 'BrandShield AI' });
    }
  };

  const fetchReviewHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await apiFetch('/reviews');
      setReviewHistory(data || []);
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
      setRules(rulesData || []);
      setFacts(factsData || []);
    } catch (err) {
      setErrorMessage(`Unable to load guidelines: ${err.message}`);
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
      setErrorMessage(`Unable to load governance analytics: ${err.message}`);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Content Review Execution
  const handleCheckContent = async () => {
    if (!content.trim()) {
      setErrorMessage("Please enter or paste marketing content to evaluate.");
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    setSelectedDecision('');
    setReviewerComment('');
    setEditorViewMode('editor');

    try {
      const reviewData = await apiFetch('/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content })
      });

      setActiveReview(reviewData);
      setSuccessMessage(`Evaluation complete. ${reviewData.total_findings} finding${reviewData.total_findings === 1 ? '' : 's'} recorded.`);
      fetchReviewHistory();
      checkSystemStatus();
    } catch (err) {
      setErrorMessage(err.message || "An error occurred while evaluating content.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectReview = async (reviewId) => {
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const data = await apiFetch(`/reviews/${reviewId}`);
      setActiveReview(data);
      setContent(data.content);
      setSelectedDecision(data.human_decision?.decision || '');
      setReviewerComment(data.human_decision?.comment || '');
      setEditorViewMode('editor');
    } catch (err) {
      setErrorMessage(`Failed to retrieve review record: ${err.message}`);
    }
  };

  // Human Governance Decision Recording
  const handleSubmitDecision = async () => {
    if (!activeReview) return;
    if (!selectedDecision) {
      setErrorMessage("Please select a decision verdict (Approve, Request Changes, or Reject).");
      return;
    }

    setSubmittingDecision(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const updated = await apiFetch(`/reviews/${activeReview.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: selectedDecision,
          comment: reviewerComment.trim() || null
        })
      });

      setActiveReview(updated);
      setSuccessMessage(`Human verdict '${selectedDecision.replace('_', ' ').toUpperCase()}' recorded in audit log.`);
      fetchReviewHistory();
    } catch (err) {
      setErrorMessage(`Failed to submit human decision: ${err.message}`);
    } finally {
      setSubmittingDecision(false);
    }
  };

  // Single & Batch Fix Applications
  const handleApplySingleFix = (finding) => {
    const target = finding.matched_text || finding.flagged_text;
    const replacement = finding.suggested_correction;
    if (!target || !replacement) return;

    if (content.includes(target)) {
      const updatedText = content.replace(target, replacement);
      setContent(updatedText);
      setSuccessMessage(`Replaced "${target}" with compliant phrasing.`);
    } else {
      setErrorMessage(`The phrasing "${target}" was not found in the draft editor.`);
    }
  };

  const handleApplyAllFixes = () => {
    if (!activeReview || !activeReview.findings || activeReview.findings.length === 0) return;
    let updated = content;
    let appliedCount = 0;

    activeReview.findings.forEach(f => {
      const target = f.matched_text || f.flagged_text;
      const rep = f.suggested_correction;
      if (target && rep && updated.includes(target)) {
        updated = updated.replace(target, rep);
        appliedCount++;
      }
    });

    if (appliedCount > 0) {
      setContent(updated);
      setSuccessMessage(`Successfully applied ${appliedCount} compliant replacement${appliedCount === 1 ? '' : 's'}.`);
    } else {
      setErrorMessage("No matching flagged phrases remained in the draft editor.");
    }
  };

  const handleCopySuggestion = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedFindingId(id);
    setTimeout(() => setCopiedFindingId(null), 2500);
  };

  // Proposed Corrected Draft Text Generation
  const proposedCorrectedDraft = useMemo(() => {
    if (!activeReview || !activeReview.findings || activeReview.findings.length === 0) {
      return content;
    }
    let corrected = content;
    activeReview.findings.forEach(f => {
      const target = f.matched_text || f.flagged_text;
      const rep = f.suggested_correction;
      if (target && rep && corrected.includes(target)) {
        corrected = corrected.replace(target, rep);
      }
    });
    return corrected;
  }, [content, activeReview]);

  // Guidelines Management Handlers
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
      description: rule.description || '',
      is_active: rule.is_active
    });
    setShowRuleModal(true);
  };

  const handleSaveRule = async (e) => {
    e.preventDefault();
    setModalError('');

    if (!ruleFormData.name.trim()) {
      setModalError("Rule name is required.");
      return;
    }

    try {
      if (editingRule) {
        await apiFetch(`/rules/${editingRule.rule_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ruleFormData)
        });
        setSuccessMessage(`Rule '${editingRule.rule_id}' updated successfully.`);
      } else {
        await apiFetch('/rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ruleFormData)
        });
        setSuccessMessage("New brand rule registered in database.");
      }
      setShowRuleModal(false);
      fetchGuidelines();
    } catch (err) {
      setModalError(err.message || "Failed to persist brand rule.");
    }
  };

  const handleToggleRule = async (ruleId) => {
    try {
      await apiFetch(`/rules/${ruleId}/toggle`, { method: 'PATCH' });
      fetchGuidelines();
      setSuccessMessage(`Rule '${ruleId}' status toggled.`);
    } catch (err) {
      setErrorMessage(`Failed to toggle rule: ${err.message}`);
    }
  };

  const handleDeleteRule = async (ruleId, name) => {
    if (!window.confirm(`Delete brand rule '${name}' (${ruleId})?`)) return;
    try {
      await apiFetch(`/rules/${ruleId}`, { method: 'DELETE' });
      fetchGuidelines();
      setSuccessMessage(`Rule '${ruleId}' deleted.`);
    } catch (err) {
      setErrorMessage(`Failed to delete rule: ${err.message}`);
    }
  };

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
      verification_status: fact.verification_status || 'verified_sample',
      is_active: fact.is_active
    });
    setShowFactModal(true);
  };

  const handleSaveFact = async (e) => {
    e.preventDefault();
    setModalError('');

    if (!factFormData.statement.trim() || !factFormData.source_name.trim()) {
      setModalError("Fact statement and verifiable source name are required.");
      return;
    }

    try {
      if (editingFact) {
        await apiFetch(`/facts/${editingFact.fact_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(factFormData)
        });
        setSuccessMessage(`Approved fact '${editingFact.fact_id}' updated.`);
      } else {
        await apiFetch('/facts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(factFormData)
        });
        setSuccessMessage("New approved fact registered in database.");
      }
      setShowFactModal(false);
      fetchGuidelines();
    } catch (err) {
      setModalError(err.message || "Failed to persist approved fact.");
    }
  };

  const handleToggleFact = async (factId) => {
    try {
      await apiFetch(`/facts/${factId}/toggle`, { method: 'PATCH' });
      fetchGuidelines();
      setSuccessMessage(`Approved fact '${factId}' status toggled.`);
    } catch (err) {
      setErrorMessage(`Failed to toggle fact: ${err.message}`);
    }
  };

  const handleDeleteFact = async (factId) => {
    if (!window.confirm(`Delete approved fact '${factId}'?`)) return;
    try {
      await apiFetch(`/facts/${factId}`, { method: 'DELETE' });
      fetchGuidelines();
      setSuccessMessage(`Fact '${factId}' deleted.`);
    } catch (err) {
      setErrorMessage(`Failed to delete fact: ${err.message}`);
    }
  };

  // Filtered Review History
  const filteredHistory = useMemo(() => {
    return reviewHistory.filter(item => {
      if (historyFilter === 'all') return true;
      if (historyFilter === 'clean') return item.total_findings === 0;
      if (historyFilter === 'pending') return item.total_findings > 0 && !item.latest_decision;
      return item.latest_decision?.toLowerCase() === historyFilter;
    });
  }, [reviewHistory, historyFilter]);

  // Filtered Findings in Active Review
  const filteredFindings = useMemo(() => {
    if (!activeReview || !activeReview.findings) return [];
    if (findingCategoryFilter === 'ALL') return activeReview.findings;
    return activeReview.findings.filter(f => f.category === findingCategoryFilter);
  }, [activeReview, findingCategoryFilter]);


  // Visual Badges & Presentation Elements
  const renderSeverityBadge = (severity) => {
    const sev = (severity || 'MEDIUM').toUpperCase();
    if (sev === 'HIGH') {
      return (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded border bg-rose-50 text-rose-800 border-rose-200 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse"></span>
          High Severity
        </span>
      );
    }
    if (sev === 'LOW') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded border bg-platinum-100 text-platinum-600 border-platinum-300 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-platinum-400"></span>
          Low Severity
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded border bg-amber-50 text-amber-800 border-amber-200 shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
        Medium Severity
      </span>
    );
  };

  const renderCategoryPill = (category) => {
    if (category === 'FACTUAL_CONTRADICTION') {
      return (
        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded border bg-rose-50 text-rose-800 border-rose-200">
          Factual Contradiction
        </span>
      );
    }
    if (category === 'UNSUPPORTED_CLAIM') {
      return (
        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded border bg-amber-50 text-amber-800 border-amber-200">
          Unverified Claim
        </span>
      );
    }
    return (
      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded border bg-lavender-100 text-lavender-800 border-lavender-200">
        Brand Rule Violation
      </span>
    );
  };

  const renderDecisionBadge = (decision, isClean = false) => {
    if (isClean && !decision) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
          ✓ Verified Clean
        </span>
      );
    }
    if (!decision) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-platinum-100 text-platinum-600 border border-platinum-300">
          ⏳ Pending Decision
        </span>
      );
    }

    const d = decision.toLowerCase();
    if (d === 'approved') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
          ✓ Approved
        </span>
      );
    }
    if (d === 'changes_requested') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs">
          ↺ Changes Requested
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-300 shadow-2xs">
        ✕ Rejected
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-canvas text-platinum-800 flex flex-col font-sans selection:bg-lavender-200 selection:text-platinum-800 antialiased">
      
      {/* =========================================================================
          TOP NAVIGATION HEADER - Light Premium Enterprise Aesthetic
      ========================================================================= */}
      <header className="bg-white/95 backdrop-blur-md text-platinum-800 border-b border-platinum-300 sticky top-0 z-40 shadow-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          
          {/* Logo & Platform Name */}
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-lg bg-mocha-600 flex items-center justify-center text-white font-extrabold shadow-subtle text-lg">
              🛡️
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <span className="font-extrabold text-xl tracking-tight text-platinum-800">BrandShield AI</span>
                <span className="text-[11px] font-semibold bg-lavender-100 text-lavender-800 border border-lavender-200 px-2 py-0.5 rounded font-mono">
                  Team AETHORA
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-platinum-100 text-platinum-600 border border-platinum-300 hidden sm:inline">
                  Client: AetherGlow
                </span>
              </div>
              <p className="text-xs text-platinum-600 hidden md:block">
                Every Claim. Clear Evidence. Confident Publishing.
              </p>
            </div>
          </div>

          {/* Navigation Tabs with Lavender Highlights */}
          <nav aria-label="Main Navigation" className="flex items-center space-x-1.5 bg-platinum-100 p-1 rounded-lg border border-platinum-300">
            <button
              onClick={() => setActiveTab('review')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === 'review'
                  ? 'bg-mocha-600 text-white shadow-subtle'
                  : 'text-platinum-600 hover:text-platinum-800 hover:bg-white/80'
              }`}
            >
              📝 Content Review
            </button>
            <button
              onClick={() => {
                setActiveTab('guidelines');
                fetchGuidelines();
              }}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === 'guidelines'
                  ? 'bg-mocha-600 text-white shadow-subtle'
                  : 'text-platinum-600 hover:text-platinum-800 hover:bg-white/80'
              }`}
            >
              📚 Brand Guidelines & Facts
            </button>
            <button
              onClick={() => {
                setActiveTab('analytics');
                fetchAnalytics();
              }}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === 'analytics'
                  ? 'bg-mocha-600 text-white shadow-subtle'
                  : 'text-platinum-600 hover:text-platinum-800 hover:bg-white/80'
              }`}
            >
              📊 Governance Analytics
            </button>
          </nav>

          {/* Live Diagnostic Status Indicator */}
          <div className="hidden lg:flex items-center space-x-2 text-xs">
            <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full border text-[11px] ${
              backendHealth.status === 'healthy'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${backendHealth.status === 'healthy' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
              <span>{backendHealth.status === 'healthy' ? 'API Online' : 'Backend Offline'}</span>
            </div>
            {semanticStatus && (
              <span className="text-[11px] text-platinum-600 font-mono" title={semanticStatus.engine_mode}>
                NLP: {semanticStatus.memory_footprint}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* =========================================================================
          MAIN WORKSPACE CANVAS - Soft Platinum Background (~55%)
      ========================================================================= */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-5">
        
        {/* Global Notifications */}
        {errorMessage && (
          <div className="bg-rose-50 border-l-4 border-rose-500 text-rose-900 px-4 py-3 rounded-r-lg text-sm flex items-center justify-between shadow-subtle border border-rose-200">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-rose-600">Notice:</span>
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage('')} className="font-bold text-rose-600 hover:text-rose-900 ml-4">✕</button>
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-50 border-l-4 border-emerald-500 text-emerald-900 px-4 py-3 rounded-r-lg text-sm flex items-center justify-between shadow-subtle border border-emerald-200">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-emerald-600">✓</span>
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage('')} className="font-bold text-emerald-600 hover:text-emerald-900 ml-4">✕</button>
          </div>
        )}

        {/* =====================================================================
            VIEW 1: CONTENT REVIEW WORKFLOW
        ===================================================================== */}
        {activeTab === 'review' && (
          <div className="space-y-5">
            
            {/* Step-by-Step Governance Pipeline Banner */}
            <div className="bg-white rounded-xl border border-platinum-300 px-4 py-3 shadow-card flex items-center justify-between text-xs overflow-x-auto gap-3">
              <div className="flex items-center gap-2 font-medium text-platinum-700 shrink-0">
                <span className="w-5 h-5 rounded-full bg-mocha-600 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                <span>Draft Marketing Copy</span>
              </div>
              <span className="text-platinum-400 shrink-0">➔</span>
              <div className="flex items-center gap-2 font-medium text-platinum-700 shrink-0">
                <span className="w-5 h-5 rounded-full bg-mocha-600 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                <span>Evaluate Guidelines & Facts</span>
              </div>
              <span className="text-platinum-400 shrink-0">➔</span>
              <div className="flex items-center gap-2 font-medium text-platinum-700 shrink-0">
                <span className="w-5 h-5 rounded-full bg-mocha-600 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                <span>Inspect Evidence & Corrections</span>
              </div>
              <span className="text-platinum-400 shrink-0">➔</span>
              <div className="flex items-center gap-2 font-medium text-platinum-700 shrink-0">
                <span className="w-5 h-5 rounded-full bg-mocha-600 text-white flex items-center justify-center text-[10px] font-bold">4</span>
                <span>Preview Before/After</span>
              </div>
              <span className="text-platinum-400 shrink-0">➔</span>
              <div className="flex items-center gap-2 font-medium text-platinum-700 shrink-0">
                <span className="w-5 h-5 rounded-full bg-mocha-600 text-white flex items-center justify-center text-[10px] font-bold">5</span>
                <span>Record Human Verdict</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* ---------------- Column 1: Review History Sidebar (3 cols) ---------------- */}
              <div className="lg:col-span-3 space-y-4">
                <div className="bg-white rounded-xl border border-platinum-300 p-4 shadow-card space-y-3">
                  <div className="flex items-center justify-between border-b border-platinum-200 pb-2.5">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-platinum-800 flex items-center gap-1.5">
                      <span>📂 Audit History</span>
                    </h3>
                    <button
                      onClick={fetchReviewHistory}
                      disabled={historyLoading}
                      className="text-xs text-mocha-600 hover:underline font-semibold transition"
                    >
                      {historyLoading ? "..." : "🔄 Refresh"}
                    </button>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex flex-wrap gap-1 text-[11px] pb-1">
                    {['all', 'clean', 'pending', 'approved', 'rejected'].map(fKey => (
                      <button
                        key={fKey}
                        onClick={() => setHistoryFilter(fKey)}
                        className={`px-2 py-0.5 rounded capitalize font-medium transition ${
                          historyFilter === fKey
                            ? 'bg-mocha-600 text-white shadow-subtle'
                            : 'bg-platinum-100 text-platinum-600 hover:bg-platinum-200 hover:text-platinum-800 border border-platinum-300'
                        }`}
                      >
                        {fKey}
                      </button>
                    ))}
                  </div>

                  {filteredHistory.length === 0 ? (
                    <div className="text-center py-6 text-platinum-500 text-xs">
                      No review history matching this filter.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
                      {filteredHistory.map((item) => {
                        const isSelected = activeReview && activeReview.id === item.id;
                        return (
                          <div
                            key={item.id}
                            onClick={() => handleSelectReview(item.id)}
                            className={`p-3 rounded-lg border text-xs cursor-pointer transition ${
                              isSelected
                                ? 'bg-mocha-50/60 border-mocha-600 ring-2 ring-lavender-200 shadow-subtle'
                                : 'bg-white border-platinum-300 hover:bg-platinum-50 hover:border-platinum-400'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-mono text-[10px] text-platinum-500">
                                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {renderDecisionBadge(item.latest_decision, item.total_findings === 0)}
                            </div>
                            <p className="text-platinum-800 line-clamp-2 leading-relaxed">
                              {item.content}
                            </p>
                            <div className="mt-1.5 flex items-center justify-between text-[10px] text-platinum-500 pt-1 border-t border-platinum-200">
                              <span>{item.total_findings} finding{item.total_findings === 1 ? '' : 's'}</span>
                              <span className="font-mono">{item.id.slice(0, 8)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* ---------------- Column 2: Editor & Human Review Decision (5 cols) ---------------- */}
              <div className="lg:col-span-5 space-y-4">
                
                {/* Draft Content Card */}
                <div className="bg-white rounded-xl border border-platinum-300 p-5 shadow-card space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-platinum-800 uppercase tracking-wide">
                        1. Marketing Copy Draft
                      </h2>
                      <p className="text-xs text-platinum-600">
                        Enter advertising copy to verify against active AetherGlow standards.
                      </p>
                    </div>

                    {/* View Switcher: Editor vs Before/After Comparison */}
                    {activeReview && activeReview.total_findings > 0 && (
                      <div className="inline-flex rounded-lg p-0.5 bg-platinum-100 border border-platinum-300 text-xs">
                        <button
                          onClick={() => setEditorViewMode('editor')}
                          className={`px-2.5 py-1 rounded font-semibold transition ${
                            editorViewMode === 'editor'
                              ? 'bg-white text-platinum-800 shadow-subtle'
                              : 'text-platinum-600 hover:text-platinum-800'
                          }`}
                        >
                          Draft Editor
                        </button>
                        <button
                          onClick={() => setEditorViewMode('comparison')}
                          className={`px-2.5 py-1 rounded font-semibold transition ${
                            editorViewMode === 'comparison'
                              ? 'bg-white text-platinum-800 shadow-subtle'
                              : 'text-platinum-600 hover:text-platinum-800'
                          }`}
                        >
                          Before & After
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Quick-Load Demonstration Samples */}
                  <div className="flex flex-wrap gap-2 items-center bg-platinum-50 p-2.5 rounded-lg border border-platinum-300">
                    <span className="text-xs font-semibold text-platinum-700">Quick Test Samples:</span>
                    <button
                      onClick={() => {
                        setContent(PROBLEMATIC_SAMPLE);
                        setActiveReview(null);
                        setErrorMessage('');
                        setEditorViewMode('editor');
                      }}
                      className="text-xs bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-semibold px-2.5 py-1 rounded transition"
                    >
                      ⚠️ Problematic Sample
                    </button>
                    <button
                      onClick={() => {
                        setContent(COMPLIANT_SAMPLE);
                        setActiveReview(null);
                        setErrorMessage('');
                        setEditorViewMode('editor');
                      }}
                      className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold px-2.5 py-1 rounded transition"
                    >
                      ✓ Compliant Sample
                    </button>
                  </div>

                  {/* Main Textarea vs Before/After Diff View */}
                  {editorViewMode === 'editor' ? (
                    <div>
                      <textarea
                        rows={7}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Paste marketing copy here to check against brand rules and approved facts..."
                        className="w-full rounded-lg bg-white border-platinum-300 border p-3 text-sm text-platinum-800 placeholder-platinum-400 focus:ring-2 focus:ring-mocha-600/30 focus:border-mocha-600 leading-relaxed font-sans transition"
                      />
                      <div className="flex justify-between items-center text-[11px] text-platinum-600 pt-1">
                        <span>{content.trim() ? content.trim().split(/\s+/).length : 0} words • {content.length} characters</span>
                        <span>Evaluated against active database specifications</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-rose-50/70 p-3 rounded-lg border border-rose-200 space-y-1">
                          <span className="font-bold text-rose-800 block text-[10px] uppercase tracking-wide">
                            Original Submission
                          </span>
                          <p className="text-platinum-800 leading-relaxed font-sans">{content}</p>
                        </div>
                        <div className="bg-emerald-50/70 p-3 rounded-lg border border-emerald-200 space-y-1">
                          <span className="font-bold text-emerald-800 block text-[10px] uppercase tracking-wide">
                            Compliant Revised Version
                          </span>
                          <p className="text-platinum-800 leading-relaxed font-sans">{proposedCorrectedDraft}</p>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setContent(proposedCorrectedDraft);
                            setEditorViewMode('editor');
                            setSuccessMessage("Adopted all compliant revisions into draft editor.");
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-subtle transition"
                        >
                          ✓ Adopt Revised Version into Draft
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Actions & Check Button */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => {
                        setContent('');
                        setActiveReview(null);
                        setErrorMessage('');
                      }}
                      className="text-xs text-platinum-600 hover:text-platinum-800 transition"
                    >
                      Clear Editor
                    </button>
                    <button
                      onClick={handleCheckContent}
                      disabled={loading || !content.trim()}
                      className="inline-flex items-center px-6 py-2.5 rounded-lg text-sm font-semibold bg-mocha-600 hover:bg-mocha-700 text-white shadow-subtle border border-mocha-700 transition disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <span className="animate-spin mr-2">⏳</span>
                          Evaluating Rules & Facts...
                        </>
                      ) : (
                        <>
                          <span>🔍 Check Content</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Human Governance Verdict Card */}
                {activeReview && (
                  <div className="bg-white rounded-xl border border-platinum-300 p-5 shadow-card space-y-4">
                    <div className="border-b border-platinum-200 pb-2.5 flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-bold text-platinum-800 uppercase tracking-wide">
                          2. Human Governance Decision
                        </h2>
                        <p className="text-xs text-platinum-600">
                          Audited human verdict stored separately from automated rule findings.
                        </p>
                      </div>
                      {activeReview.human_decision && (
                        <div>{renderDecisionBadge(activeReview.human_decision.decision)}</div>
                      )}
                    </div>

                    {/* Display existing decision details */}
                    {activeReview.human_decision && (
                      <div className="bg-platinum-50 border border-platinum-300 rounded-lg p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between text-platinum-800">
                          <span className="font-semibold">Recorded Verdict:</span>
                          <span className="capitalize font-bold text-mocha-600">
                            {activeReview.human_decision.decision.replace('_', ' ')}
                          </span>
                        </div>
                        {activeReview.human_decision.comment && (
                          <div className="text-platinum-800 pt-1">
                            <span className="font-semibold">Reviewer Comment:</span> "{activeReview.human_decision.comment}"
                          </div>
                        )}
                        <div className="text-[10px] text-platinum-500 pt-1 font-mono">
                          Timestamp: {new Date(activeReview.human_decision.created_at).toLocaleString()}
                        </div>
                      </div>
                    )}

                    {/* Submit / Update Human Verdict */}
                    <div className="space-y-3 pt-1">
                      <span className="text-xs font-semibold text-platinum-700 block">
                        {activeReview.human_decision ? "Update Decision Verdict:" : "Record Human Decision Verdict:"}
                      </span>

                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedDecision('approved')}
                          className={`py-2 px-2 rounded-lg text-xs font-bold border transition ${
                            selectedDecision === 'approved'
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-subtle'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          ✓ Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedDecision('changes_requested')}
                          className={`py-2 px-2 rounded-lg text-xs font-bold border transition ${
                            selectedDecision === 'changes_requested'
                              ? 'bg-amber-600 text-white border-amber-700 shadow-subtle'
                              : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                          }`}
                        >
                          ↺ Request Changes
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedDecision('rejected')}
                          className={`py-2 px-2 rounded-lg text-xs font-bold border transition ${
                            selectedDecision === 'rejected'
                              ? 'bg-rose-600 text-white border-rose-700 shadow-subtle'
                              : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                          }`}
                        >
                          ✕ Reject
                        </button>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-platinum-700 mb-1">
                          Reviewer Compliance Notes:
                        </label>
                        <textarea
                          rows={2}
                          value={reviewerComment}
                          onChange={(e) => setReviewerComment(e.target.value)}
                          placeholder="Optional audit rationale, regulatory conditions, or required copy changes..."
                          className="w-full text-xs rounded border border-platinum-300 bg-white p-2.5 text-platinum-800 placeholder-platinum-400 focus:ring-1 focus:ring-mocha-600"
                        />
                      </div>

                      <button
                        onClick={handleSubmitDecision}
                        disabled={submittingDecision || !selectedDecision}
                        className="w-full py-2.5 rounded-lg text-xs font-semibold bg-mocha-600 hover:bg-mocha-700 text-white shadow-subtle border border-mocha-700 transition disabled:opacity-50"
                      >
                        {submittingDecision ? "Saving Human Decision..." : "💾 Submit Decision to Audit Trail"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ---------------- Column 3: Findings, Evidence & Explanations (4 cols) ---------------- */}
              <div className="lg:col-span-4 space-y-4">
                
                {/* Empty State */}
                {!activeReview && !loading && (
                  <div className="p-8 bg-white rounded-xl border border-dashed border-platinum-300 text-center text-platinum-600 space-y-3 shadow-card">
                    <span className="text-4xl block">🔍</span>
                    <h3 className="text-sm font-semibold text-platinum-800">Ready for Analysis</h3>
                    <p className="text-xs text-platinum-600 leading-relaxed">
                      Click <strong>"Check Content"</strong> above or select a past submission from the audit history sidebar to inspect evidence and findings.
                    </p>
                  </div>
                )}

                {/* Clean State (0 Findings) */}
                {activeReview && activeReview.total_findings === 0 && (
                  <div className="p-6 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 shadow-card space-y-3">
                    <div className="flex items-center space-x-2.5">
                      <span className="text-2xl text-emerald-600 font-bold">✓</span>
                      <div>
                        <h3 className="font-bold text-sm text-emerald-900">Brand Governance Verified</h3>
                        <span className="text-[11px] text-emerald-700 font-mono font-semibold">Status: CLEAN</span>
                      </div>
                    </div>
                    <p className="text-xs text-emerald-900/90 leading-relaxed">
                      {activeReview.summary_message || "No guideline violations or contradictory claims detected by current active rules."}
                    </p>
                    <div className="text-[11px] text-emerald-900 bg-white/80 p-2.5 rounded border border-emerald-200">
                      <strong>Verification Note:</strong> Content adheres to active AetherGlow brand guidelines. Remember that novel clinical or technical claims must still be registered with documentation prior to distribution.
                    </div>
                  </div>
                )}

                {/* Findings List (>0 Findings) */}
                {activeReview && activeReview.total_findings > 0 && (
                  <div className="space-y-3">
                    
                    {/* Findings Overview Card */}
                    <div className="bg-white border border-platinum-300 rounded-xl p-4 shadow-card space-y-2.5">
                      <div className="flex items-center justify-between border-b border-platinum-200 pb-2">
                        <div>
                          <h3 className="font-bold text-xs uppercase tracking-wider text-platinum-800">
                            Governance Findings ({activeReview.total_findings})
                          </h3>
                          <span className="text-[11px] text-platinum-600">
                            {activeReview.summary_breakdown?.rule_violations || 0} Rule Violations • {activeReview.summary_breakdown?.factual_contradictions || 0} Contradictions • {activeReview.summary_breakdown?.unsupported_claims || 0} Unverified
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleApplyAllFixes}
                          className="px-2.5 py-1 text-xs font-semibold rounded bg-mocha-600 text-white hover:bg-mocha-700 border border-mocha-700 transition shadow-subtle"
                        >
                          ✨ Apply All Fixes
                        </button>
                      </div>

                      {/* Finding Category Filter Pills */}
                      <div className="flex flex-wrap gap-1 text-[11px]">
                        {[
                          { key: 'ALL', label: 'All Findings' },
                          { key: 'RULE_VIOLATION', label: 'Rule Violations' },
                          { key: 'FACTUAL_CONTRADICTION', label: 'Contradictions' },
                          { key: 'UNSUPPORTED_CLAIM', label: 'Unverified Claims' }
                        ].map(cat => (
                          <button
                            key={cat.key}
                            onClick={() => setFindingCategoryFilter(cat.key)}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
                              findingCategoryFilter === cat.key
                                ? 'bg-lavender-200 text-lavender-900 border border-lavender-300 shadow-subtle'
                                : 'bg-platinum-100 text-platinum-600 hover:bg-platinum-200 hover:text-platinum-800 border border-platinum-300'
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Individual Finding Cards */}
                    <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
                      {filteredFindings.map((finding, idx) => {
                        const statusLabel = finding.status || finding.status_or_uncertainty_label;
                        const matchedText = finding.matched_text || finding.flagged_text;
                        const sourceRef = finding.source || finding.matched_rule_or_source;
                        const correction = finding.suggested_correction;
                        const findingKey = finding.id || idx;

                        return (
                          <div
                            key={findingKey}
                            className="bg-white rounded-xl border border-platinum-300 p-4 shadow-card space-y-3 hover:border-mocha-400 transition"
                          >
                            {/* Card Header: Category & Severity */}
                            <div className="flex items-center justify-between gap-2">
                              {renderCategoryPill(finding.category)}
                              {renderSeverityBadge(finding.severity)}
                            </div>

                            {/* Flagged Phrase */}
                            {matchedText && (
                              <div className="text-xs text-platinum-800">
                                <span className="font-semibold text-platinum-600 text-[10px] uppercase block mb-0.5">Flagged Phrase:</span>
                                <span className="font-mono bg-rose-50 text-rose-900 px-2 py-0.5 rounded border border-rose-200 font-bold inline-block">
                                  "{matchedText}"
                                </span>
                              </div>
                            )}

                            {/* Grounded Explanation */}
                            <div className="bg-platinum-50 rounded-lg p-2.5 text-xs text-platinum-800 border border-platinum-300 leading-relaxed">
                              <strong className="text-platinum-900 block mb-0.5">Why this was flagged:</strong>
                              {finding.explanation}
                            </div>

                            {/* Evidence / Source Reference - Contextual Lavender Highlight */}
                            <div className="bg-lavender-50 rounded-lg p-2.5 text-xs text-platinum-800 border border-lavender-200 space-y-1.5">
                              <div className="text-[11px] text-lavender-800">
                                <strong>Verified Source / Guideline:</strong> {sourceRef}
                              </div>
                              {correction && (
                                <div className="text-xs text-platinum-800">
                                  <strong className="text-platinum-900">Compliant Alternative:</strong> {correction}
                                </div>
                              )}

                              {/* Interactive Actions */}
                              <div className="flex items-center justify-between pt-2 border-t border-lavender-200/60 gap-2">
                                <span className="text-[10px] text-platinum-600 italic">
                                  {statusLabel}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {correction && (
                                    <button
                                      type="button"
                                      onClick={() => handleCopySuggestion(correction, findingKey)}
                                      className="px-2.5 py-1 rounded text-xs font-semibold bg-white hover:bg-platinum-100 text-platinum-800 border border-platinum-300 transition shadow-2xs"
                                      title="Copy compliant wording to clipboard"
                                    >
                                      {copiedFindingId === findingKey ? "✓ Copied" : "📋 Copy"}
                                    </button>
                                  )}
                                  {matchedText && (
                                    <button
                                      type="button"
                                      onClick={() => handleApplySingleFix(finding)}
                                      className="px-2.5 py-1 rounded text-xs font-semibold bg-mocha-600 hover:bg-mocha-700 text-white border border-mocha-700 transition shadow-2xs"
                                      title="Replace phrase in editor"
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

        {/* =====================================================================
            VIEW 2: BRAND GUIDELINES & APPROVED FACTS MANAGEMENT
        ===================================================================== */}
        {activeTab === 'guidelines' && (
          <div className="space-y-6">
            
            {/* Header with Search and Add Actions */}
            <div className="bg-white rounded-xl border border-platinum-300 p-5 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-lg font-bold text-platinum-800 uppercase tracking-wide">
                  Brand Guidelines & Fact Sources
                </h1>
                <p className="text-xs text-platinum-600 mt-0.5">
                  Manage active brand rules and approved facts stored in SQLite. Modifications dynamically govern all future reviews.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  type="text"
                  value={guidelinesSearch}
                  onChange={(e) => setGuidelinesSearch(e.target.value)}
                  placeholder="Filter rules & facts..."
                  className="px-3 py-1.5 text-xs rounded-lg border border-platinum-300 bg-white text-platinum-800 placeholder-platinum-400 focus:ring-1 focus:ring-mocha-600 w-44"
                />
                <button
                  onClick={handleOpenAddRule}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-mocha-600 text-white hover:bg-mocha-700 border border-mocha-700 shadow-subtle"
                >
                  ➕ Add Rule
                </button>
                <button
                  onClick={handleOpenAddFact}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-platinum-100 text-platinum-800 hover:bg-platinum-200 border border-platinum-300 shadow-subtle"
                >
                  ➕ Add Fact
                </button>
              </div>
            </div>

            {/* SECTION 1: BRAND RULES TABLE */}
            <div className="bg-white rounded-xl border border-platinum-300 p-5 shadow-card space-y-4">
              <div className="flex items-center justify-between border-b border-platinum-200 pb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-platinum-800 uppercase tracking-wider">
                    📋 Active Brand Rules
                  </h2>
                  <span className="text-xs bg-platinum-100 text-platinum-700 border border-platinum-300 px-2 py-0.5 rounded-full font-mono">
                    {rules.length} Registered
                  </span>
                </div>
              </div>

              {rules.length === 0 ? (
                <p className="text-xs text-platinum-500 py-4 text-center">No brand rules registered in database.</p>
              ) : (
                <div className="divide-y divide-platinum-200">
                  {rules
                    .filter(r => !guidelinesSearch || r.name.toLowerCase().includes(guidelinesSearch.toLowerCase()) || r.rule_id.toLowerCase().includes(guidelinesSearch.toLowerCase()))
                    .map((r) => (
                    <div key={r.id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-mocha-600">{r.rule_id}</span>
                          <span className="font-semibold text-sm text-platinum-800">{r.name}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-platinum-100 text-platinum-600 border border-platinum-300">
                            {r.rule_type}
                          </span>
                          {renderSeverityBadge(r.severity)}
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.is_active ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-platinum-100 text-platinum-500 border border-platinum-300'
                          }`}>
                            {r.is_active ? '● Active' : '○ Disabled'}
                          </span>
                        </div>
                        <p className="text-xs text-platinum-600 leading-relaxed">{r.description}</p>
                        {(r.prohibited_phrase || r.preferred_replacement) && (
                          <div className="text-[11px] text-platinum-600 flex flex-wrap gap-4 pt-0.5">
                            {r.prohibited_phrase && (
                              <span>Flag: <code className="bg-rose-50 text-rose-800 border border-rose-200 px-1.5 py-0.5 rounded font-mono font-bold">{r.prohibited_phrase}</code></span>
                            )}
                            {r.preferred_replacement && (
                              <span>Replacement: <code className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded font-mono font-bold">{r.preferred_replacement}</code></span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 self-start md:self-center shrink-0">
                        <button
                          onClick={() => handleToggleRule(r.rule_id)}
                          className={`text-xs px-2.5 py-1 rounded font-semibold border transition ${
                            r.is_active ? 'bg-white text-platinum-700 hover:bg-platinum-100 border-platinum-300' : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {r.is_active ? "Disable" : "Enable"}
                        </button>
                        <button
                          onClick={() => handleOpenEditRule(r)}
                          className="text-xs px-2.5 py-1 rounded font-semibold bg-platinum-100 text-platinum-800 hover:bg-platinum-200 border border-platinum-300 shadow-2xs"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDeleteRule(r.rule_id, r.name)}
                          className="text-xs px-2.5 py-1 rounded font-semibold bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SECTION 2: APPROVED FACT SOURCES TABLE */}
            <div className="bg-white rounded-xl border border-platinum-300 p-5 shadow-card space-y-4">
              <div className="flex items-center justify-between border-b border-platinum-200 pb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-platinum-800 uppercase tracking-wider">
                    📖 Approved Fact Sources (Ground Truth Library)
                  </h2>
                  <span className="text-xs bg-platinum-100 text-platinum-700 border border-platinum-300 px-2 py-0.5 rounded-full font-mono">
                    {facts.length} Verified Facts
                  </span>
                </div>
              </div>

              {facts.length === 0 ? (
                <p className="text-xs text-platinum-500 py-4 text-center">No approved facts registered in database.</p>
              ) : (
                <div className="divide-y divide-platinum-200">
                  {facts
                    .filter(f => !guidelinesSearch || f.statement.toLowerCase().includes(guidelinesSearch.toLowerCase()) || f.fact_id.toLowerCase().includes(guidelinesSearch.toLowerCase()))
                    .map((f) => (
                    <div key={f.id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-mocha-600">{f.fact_id}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-lavender-100 text-lavender-800 border border-lavender-200">
                            {f.verification_status}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            f.is_active ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-platinum-100 text-platinum-500 border border-platinum-300'
                          }`}>
                            {f.is_active ? '● Active' : '○ Disabled'}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-platinum-800">"{f.statement}"</p>
                        <div className="text-[11px] text-platinum-600 flex items-center gap-3">
                          <span><strong>Source:</strong> {f.source_name}</span>
                          {f.source_url && (
                            <a
                              href={f.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-mocha-600 hover:underline"
                            >
                              🔗 Reference Document
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-start md:self-center shrink-0">
                        <button
                          onClick={() => handleToggleFact(f.fact_id)}
                          className={`text-xs px-2.5 py-1 rounded font-semibold border transition ${
                            f.is_active ? 'bg-white text-platinum-700 hover:bg-platinum-100 border-platinum-300' : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {f.is_active ? "Disable" : "Enable"}
                        </button>
                        <button
                          onClick={() => handleOpenEditFact(f)}
                          className="text-xs px-2.5 py-1 rounded font-semibold bg-platinum-100 text-platinum-800 hover:bg-platinum-200 border border-platinum-300 shadow-2xs"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDeleteFact(f.fact_id)}
                          className="text-xs px-2.5 py-1 rounded font-semibold bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200"
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

        {/* =====================================================================
            VIEW 3: GOVERNANCE ANALYTICS
        ===================================================================== */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            
            {/* Header */}
            <div className="bg-white rounded-xl border border-platinum-300 p-5 shadow-card flex items-center justify-between gap-4">
              <div>
                <h1 className="text-lg font-bold text-platinum-800 uppercase tracking-wide flex items-center gap-2">
                  <span>📊 Governance Analytics</span>
                  <span className="text-[11px] bg-lavender-100 text-lavender-800 border border-lavender-200 px-2.5 py-0.5 rounded-full font-mono">
                    Audited Database Records
                  </span>
                </h1>
                <p className="text-xs text-platinum-600 mt-0.5">
                  Computed directly from actual review submissions and human governance verdicts in the database.
                </p>
              </div>
              <button
                onClick={fetchAnalytics}
                disabled={analyticsLoading}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-mocha-600 text-white hover:bg-mocha-700 border border-mocha-700 shadow-subtle"
              >
                {analyticsLoading ? "Loading..." : "🔄 Refresh Metrics"}
              </button>
            </div>

            {analytics && (
              <div className="space-y-6">
                
                {/* 4 Primary KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-platinum-300 shadow-card">
                    <span className="text-xs font-semibold text-platinum-600 block mb-1">Total Submissions</span>
                    <span className="text-2xl font-extrabold text-platinum-800 font-mono">{analytics.total_reviews}</span>
                    <span className="text-[11px] text-platinum-500 block mt-1">Evaluated by engine</span>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-platinum-300 shadow-card">
                    <span className="text-xs font-semibold text-amber-800 block mb-1">Awaiting Human Verdict</span>
                    <span className="text-2xl font-extrabold text-amber-600 font-mono">{analytics.awaiting_review}</span>
                    <span className="text-[11px] text-platinum-500 block mt-1">Pending compliance sign-off</span>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-platinum-300 shadow-card">
                    <span className="text-xs font-semibold text-emerald-800 block mb-1">Approved for Publishing</span>
                    <span className="text-2xl font-extrabold text-emerald-600 font-mono">{analytics.approved}</span>
                    <span className="text-[11px] text-platinum-500 block mt-1">Authorized by reviewer</span>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-platinum-300 shadow-card">
                    <span className="text-xs font-semibold text-rose-800 block mb-1">Revisions / Rejected</span>
                    <span className="text-2xl font-extrabold text-rose-600 font-mono">
                      {analytics.changes_requested + analytics.rejected}
                    </span>
                    <span className="text-[11px] text-platinum-500 block mt-1">
                      {analytics.changes_requested} revisions, {analytics.rejected} rejected
                    </span>
                  </div>
                </div>

                {/* Secondary Row: Clean vs Action Required & Top Triggered Guidelines */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Compliance Ratio Breakdown */}
                  <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-platinum-300 shadow-card space-y-4">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-platinum-800 border-b border-platinum-200 pb-2">
                      First-Pass Compliance Ratio
                    </h3>

                    <div className="space-y-3.5 text-xs">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-platinum-700 font-medium">Clean / Zero Findings:</span>
                          <span className="font-bold font-mono text-emerald-700">
                            {analytics.clean_reviews} ({analytics.total_reviews ? Math.round((analytics.clean_reviews / analytics.total_reviews) * 100) : 0}%)
                          </span>
                        </div>
                        <div className="w-full bg-platinum-100 rounded-full h-2.5 overflow-hidden border border-platinum-200">
                          <div
                            className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                            style={{
                              width: `${analytics.total_reviews ? (analytics.clean_reviews / analytics.total_reviews) * 100 : 0}%`
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-platinum-700 font-medium">Action Required (Findings Flagged):</span>
                          <span className="font-bold font-mono text-rose-700">
                            {analytics.reviews_with_issues} ({analytics.total_reviews ? Math.round((analytics.reviews_with_issues / analytics.total_reviews) * 100) : 0}%)
                          </span>
                        </div>
                        <div className="w-full bg-platinum-100 rounded-full h-2.5 overflow-hidden border border-platinum-200">
                          <div
                            className="bg-rose-500 h-2.5 rounded-full transition-all duration-500"
                            style={{
                              width: `${analytics.total_reviews ? (analytics.reviews_with_issues / analytics.total_reviews) * 100 : 0}%`
                            }}
                          />
                        </div>
                      </div>

                      <div className="pt-3 border-t border-platinum-200 text-[11px] text-platinum-600 leading-relaxed">
                        Metrics reflect historical reviews stored permanently in database.
                      </div>
                    </div>
                  </div>

                  {/* Top Triggered Guidelines */}
                  <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-platinum-300 shadow-card space-y-4">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-platinum-800 border-b border-platinum-200 pb-2">
                      Frequently Triggered Guidelines
                    </h3>

                    {analytics.top_triggered_guidelines.length === 0 ? (
                      <p className="text-xs text-platinum-500 py-6 text-center">No guideline violations recorded yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {analytics.top_triggered_guidelines.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-platinum-50 text-xs border border-platinum-300">
                            <span className="font-medium text-platinum-800 truncate pr-4">{item.guideline}</span>
                            <span className="px-2.5 py-0.5 rounded font-mono font-bold bg-lavender-100 text-lavender-800 border border-lavender-200 shrink-0">
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

      {/* =========================================================================
          MODAL 1: ADD / EDIT BRAND RULE
      ========================================================================= */}
      {showRuleModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-elevated border border-platinum-300 max-w-lg w-full p-6 space-y-4 text-platinum-800">
            <div className="flex justify-between items-center border-b border-platinum-200 pb-3">
              <h3 className="text-sm font-bold text-platinum-900 uppercase tracking-wide">
                {editingRule ? `Edit Rule: ${editingRule.rule_id}` : "Add New Brand Rule"}
              </h3>
              <button onClick={() => setShowRuleModal(false)} className="font-bold text-platinum-400 hover:text-platinum-800">✕</button>
            </div>

            {modalError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded text-xs">
                <strong>Error:</strong> {modalError}
              </div>
            )}

            <form onSubmit={handleSaveRule} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-platinum-700 mb-1">Rule Name *</label>
                <input
                  type="text"
                  required
                  value={ruleFormData.name}
                  onChange={(e) => setRuleFormData({...ruleFormData, name: e.target.value})}
                  placeholder="e.g. Prohibit Absolute Outcome Guarantees"
                  className="w-full rounded border border-platinum-300 bg-white p-2.5 text-xs text-platinum-800 placeholder-platinum-400 focus:ring-1 focus:ring-mocha-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-platinum-700 mb-1">Rule Type *</label>
                  <select
                    value={ruleFormData.rule_type}
                    onChange={(e) => setRuleFormData({...ruleFormData, rule_type: e.target.value})}
                    className="w-full rounded border border-platinum-300 bg-white p-2 text-xs text-platinum-800 focus:ring-1 focus:ring-mocha-600"
                  >
                    <option value="prohibited_phrase">Prohibited Phrase</option>
                    <option value="preferred_terminology">Preferred Terminology</option>
                    <option value="required_phrase">Required Phrase</option>
                    <option value="custom_text">Custom Text Match</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-platinum-700 mb-1">Severity *</label>
                  <select
                    value={ruleFormData.severity}
                    onChange={(e) => setRuleFormData({...ruleFormData, severity: e.target.value})}
                    className="w-full rounded border border-platinum-300 bg-white p-2 text-xs text-platinum-800 focus:ring-1 focus:ring-mocha-600"
                  >
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-platinum-700 mb-1">Phrase to Detect</label>
                <input
                  type="text"
                  value={ruleFormData.prohibited_phrase}
                  onChange={(e) => setRuleFormData({...ruleFormData, prohibited_phrase: e.target.value})}
                  placeholder="e.g. guaranteed 100% results"
                  className="w-full rounded border border-platinum-300 bg-white p-2 text-xs text-platinum-800 placeholder-platinum-400 focus:ring-1 focus:ring-mocha-600 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-platinum-700 mb-1">Compliant Alternative / Replacement</label>
                <input
                  type="text"
                  value={ruleFormData.preferred_replacement}
                  onChange={(e) => setRuleFormData({...ruleFormData, preferred_replacement: e.target.value})}
                  placeholder="e.g. formulated to deliver visible radiance"
                  className="w-full rounded border border-platinum-300 bg-white p-2 text-xs text-platinum-800 placeholder-platinum-400 focus:ring-1 focus:ring-mocha-600 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-platinum-700 mb-1">Explanation / Compliance Rationale</label>
                <textarea
                  rows={2}
                  value={ruleFormData.description}
                  onChange={(e) => setRuleFormData({...ruleFormData, description: e.target.value})}
                  placeholder="Explain why this rule exists and cite regulatory / brand standards..."
                  className="w-full rounded border border-platinum-300 bg-white p-2 text-xs text-platinum-800 placeholder-platinum-400 focus:ring-1 focus:ring-mocha-600"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="ruleActive"
                  checked={ruleFormData.is_active}
                  onChange={(e) => setRuleFormData({...ruleFormData, is_active: e.target.checked})}
                  className="rounded text-mocha-600 focus:ring-mocha-600"
                />
                <label htmlFor="ruleActive" className="text-xs font-semibold text-platinum-700">
                  Enable Rule Immediately
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-platinum-200">
                <button
                  type="button"
                  onClick={() => setShowRuleModal(false)}
                  className="px-3.5 py-1.5 rounded text-xs font-semibold bg-platinum-100 text-platinum-700 hover:bg-platinum-200 border border-platinum-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded text-xs font-semibold bg-mocha-600 text-white hover:bg-mocha-700 border border-mocha-700 shadow-subtle"
                >
                  Save Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: ADD / EDIT APPROVED FACT SOURCE
      ========================================================================= */}
      {showFactModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-elevated border border-platinum-300 max-w-lg w-full p-6 space-y-4 text-platinum-800">
            <div className="flex justify-between items-center border-b border-platinum-200 pb-3">
              <h3 className="text-sm font-bold text-platinum-900 uppercase tracking-wide">
                {editingFact ? `Edit Fact: ${editingFact.fact_id}` : "Add Approved Brand Fact"}
              </h3>
              <button onClick={() => setShowFactModal(false)} className="font-bold text-platinum-400 hover:text-platinum-800">✕</button>
            </div>

            {modalError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded text-xs">
                <strong>Error:</strong> {modalError}
              </div>
            )}

            <form onSubmit={handleSaveFact} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-platinum-700 mb-1">Approved Fact Statement *</label>
                <textarea
                  rows={3}
                  required
                  value={factFormData.statement}
                  onChange={(e) => setFactFormData({...factFormData, statement: e.target.value})}
                  placeholder="e.g. AetherGlow products are made with 70% recycled packaging."
                  className="w-full rounded border border-platinum-300 bg-white p-2 text-xs text-platinum-800 placeholder-platinum-400 focus:ring-1 focus:ring-mocha-600 leading-relaxed font-sans"
                />
              </div>

              <div>
                <label className="block font-semibold text-platinum-700 mb-1">Source Name / Verifying Document *</label>
                <input
                  type="text"
                  required
                  value={factFormData.source_name}
                  onChange={(e) => setFactFormData({...factFormData, source_name: e.target.value})}
                  placeholder="e.g. AetherGlow 2025 Sustainability & Packaging Certificate"
                  className="w-full rounded border border-platinum-300 bg-white p-2 text-xs text-platinum-800 placeholder-platinum-400 focus:ring-1 focus:ring-mocha-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-platinum-700 mb-1">Reference URL (Optional)</label>
                <input
                  type="url"
                  value={factFormData.source_url}
                  onChange={(e) => setFactFormData({...factFormData, source_url: e.target.value})}
                  placeholder="https://aetherglow.example.com/sustainability-2025"
                  className="w-full rounded border border-platinum-300 bg-white p-2 text-xs text-platinum-800 placeholder-platinum-400 focus:ring-1 focus:ring-mocha-600 font-mono"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="factActive"
                  checked={factFormData.is_active}
                  onChange={(e) => setFactFormData({...factFormData, is_active: e.target.checked})}
                  className="rounded text-mocha-600 focus:ring-mocha-600"
                />
                <label htmlFor="factActive" className="text-xs font-semibold text-platinum-700">
                  Enable Fact for Reviews
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-platinum-200">
                <button
                  type="button"
                  onClick={() => setShowFactModal(false)}
                  className="px-3.5 py-1.5 rounded text-xs font-semibold bg-platinum-100 text-platinum-700 hover:bg-platinum-200 border border-platinum-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded text-xs font-semibold bg-mocha-600 text-white hover:bg-mocha-700 border border-mocha-700 shadow-subtle"
                >
                  Save Approved Fact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          FOOTER - Enterprise Brand Context & Platform Metadata
      ========================================================================= */}
      <footer className="border-t border-platinum-300 bg-white py-4 mt-auto text-platinum-600 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-platinum-800">BrandShield AI</span>
            <span>•</span>
            <span>Enterprise Brand Governance Platform</span>
            <span>•</span>
            <span className="text-mocha-600 font-medium">Team AETHORA</span>
          </div>
          <div className="flex items-center space-x-3 text-platinum-500 font-mono text-[11px]">
            <span>FastAPI + React</span>
            <span>•</span>
            <span>Zero-Dependency NLP</span>
            <span>•</span>
            <span>CodeStar 30 Round 2</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
