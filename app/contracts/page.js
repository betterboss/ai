'use client';

import { useState, useEffect } from 'react';
import Nav from '../components/Nav';

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'delays', label: 'Delays' },
  { value: 'materials', label: 'Materials' },
  { value: 'payments', label: 'Payments' },
  { value: 'permits', label: 'Permits' },
  { value: 'changes', label: 'Changes' },
  { value: 'warranty', label: 'Warranty' },
  { value: 'dispute', label: 'Dispute Resolution' },
];

const CATEGORY_COLORS = {
  delays: '#f59e0b',
  materials: '#3b82f6',
  payments: '#22c55e',
  permits: '#a78bfa',
  changes: '#f97316',
  warranty: '#06b6d4',
  dispute: '#ef4444',
};

export default function ContractsPage() {
  const [clauses, setClauses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // New clause form
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('payments');
  const [formText, setFormText] = useState('');
  const [formWhenToUse, setFormWhenToUse] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formSaving, setFormSaving] = useState(false);

  // AI suggest
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestProjectType, setSuggestProjectType] = useState('');
  const [suggestConcerns, setSuggestConcerns] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  // Generate contract
  const [showGenerate, setShowGenerate] = useState(false);
  const [genProjectType, setGenProjectType] = useState('');
  const [genClientName, setGenClientName] = useState('');
  const [genJobName, setGenJobName] = useState('');
  const [genCustomTerms, setGenCustomTerms] = useState('');
  const [selectedClauseIds, setSelectedClauseIds] = useState([]);
  const [generatingContract, setGeneratingContract] = useState(false);
  const [contractHtml, setContractHtml] = useState('');

  const [error, setError] = useState('');

  useEffect(() => {
    loadClauses();
  }, []);

  const loadClauses = async () => {
    setLoading(true);
    try {
      const userId = localStorage.getItem('bb_user_id') || '';
      const params = userId ? `?userId=${userId}` : '';
      const res = await fetch(`/api/contracts/clauses${params}`);
      if (res.ok) {
        const data = await res.json();
        setClauses(data.clauses || []);
      }
    } catch (err) {
      console.error('Failed to load clauses:', err);
    } finally {
      setLoading(false);
    }
  };

  const addClause = async () => {
    if (!formTitle.trim() || !formText.trim()) {
      setError('Title and clause text are required.');
      return;
    }
    setFormSaving(true);
    setError('');
    try {
      const userId = localStorage.getItem('bb_user_id');
      const res = await fetch('/api/contracts/clauses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          title: formTitle,
          category: formCategory,
          clauseText: formText,
          whenToUse: formWhenToUse,
          isDefault: formIsDefault,
        }),
      });
      if (res.ok) {
        setFormTitle('');
        setFormText('');
        setFormWhenToUse('');
        setFormIsDefault(false);
        setShowForm(false);
        loadClauses();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save clause');
      }
    } catch (err) {
      setError('Save failed: ' + err.message);
    } finally {
      setFormSaving(false);
    }
  };

  const suggestClauses = async () => {
    const apiKey = localStorage.getItem('bb_api_key');
    if (!apiKey) {
      setError('No API key found. Configure your Anthropic API key in Setup.');
      return;
    }
    if (!suggestProjectType.trim()) {
      setError('Please enter a project type.');
      return;
    }

    setSuggesting(true);
    setError('');
    setSuggestions([]);

    try {
      const concerns = suggestConcerns
        .split('\n')
        .map((c) => c.trim())
        .filter(Boolean);

      const res = await fetch('/api/contracts/clauses/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, projectType: suggestProjectType, concerns }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuggestions(data.suggestions || []);
      } else {
        setError(data.error || 'Failed to generate suggestions');
      }
    } catch (err) {
      setError('Suggestion failed: ' + err.message);
    } finally {
      setSuggesting(false);
    }
  };

  const saveSuggestion = async (suggestion) => {
    const userId = localStorage.getItem('bb_user_id');
    try {
      const res = await fetch('/api/contracts/clauses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          title: suggestion.title,
          category: suggestion.category,
          clauseText: suggestion.clauseText,
          whenToUse: suggestion.whenToUse,
          isDefault: false,
        }),
      });
      if (res.ok) {
        loadClauses();
        setSuggestions((prev) => prev.filter((s) => s.title !== suggestion.title));
      }
    } catch (err) {
      console.error('Save suggestion failed:', err);
    }
  };

  const generateContract = async () => {
    const apiKey = localStorage.getItem('bb_api_key');
    if (!apiKey) {
      setError('No API key found. Configure your Anthropic API key in Setup.');
      return;
    }
    if (!genClientName.trim()) {
      setError('Client name is required to generate a contract.');
      return;
    }

    setGeneratingContract(true);
    setError('');
    setContractHtml('');

    try {
      const res = await fetch('/api/contracts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          projectType: genProjectType || 'General Construction',
          clientName: genClientName,
          jobName: genJobName,
          clauseIds: selectedClauseIds,
          customTerms: genCustomTerms,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setContractHtml(data.contract_html || '');
        setShowGenerate(false);
      } else {
        setError(data.error || 'Failed to generate contract');
      }
    } catch (err) {
      setError('Generation failed: ' + err.message);
    } finally {
      setGeneratingContract(false);
    }
  };

  const toggleClauseSelection = (id) => {
    setSelectedClauseIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  // Filter and group clauses
  const filtered = clauses.filter((c) => {
    const matchCategory = !categoryFilter || c.category === categoryFilter;
    const matchSearch =
      !searchTerm ||
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.clause_text.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCategory && matchSearch;
  });

  const grouped = {};
  filtered.forEach((c) => {
    const cat = c.category || 'general';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(c);
  });

  return (
    <div style={styles.page}>
      <Nav />
      <div style={styles.container}>
        <div style={styles.hero}>
          <div style={styles.heroContent}>
            <div>
              <h1 style={styles.title}>Contract Clauses</h1>
              <p style={styles.subtitle}>
                Manage your clause library and generate contracts
              </p>
            </div>
            <div style={styles.heroActions}>
              <button
                onClick={() => { setShowSuggest(!showSuggest); setShowForm(false); setShowGenerate(false); }}
                style={styles.secondaryBtn}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
                AI Suggest
              </button>
              <button
                onClick={() => { setShowGenerate(!showGenerate); setShowForm(false); setShowSuggest(false); }}
                style={styles.secondaryBtn}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                Generate Contract
              </button>
              <button
                onClick={() => { setShowForm(!showForm); setShowSuggest(false); setShowGenerate(false); }}
                style={styles.primaryBtn}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add Clause
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div style={styles.errorBanner}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {error}
            <button onClick={() => setError('')} style={styles.errorClose}>Dismiss</button>
          </div>
        )}

        {/* AI Suggest Panel */}
        {showSuggest && (
          <div style={styles.panelCard}>
            <h2 style={styles.panelTitle}>AI Clause Suggestions</h2>
            <div style={styles.formGroup}>
              <label style={styles.label}>Project Type</label>
              <input
                type="text"
                value={suggestProjectType}
                onChange={(e) => setSuggestProjectType(e.target.value)}
                placeholder="e.g., Kitchen Remodel, New Home Build, Commercial Renovation"
                style={styles.input}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Specific Concerns (one per line, optional)</label>
              <textarea
                value={suggestConcerns}
                onChange={(e) => setSuggestConcerns(e.target.value)}
                placeholder="e.g., Delays due to weather&#10;Material price increases&#10;Permit timeline risks"
                style={styles.textarea}
                rows={3}
              />
            </div>
            <button
              onClick={suggestClauses}
              disabled={suggesting}
              style={{ ...styles.generateBtn, opacity: suggesting ? 0.7 : 1 }}
            >
              {suggesting ? (
                <>
                  <div style={styles.btnSpinner} />
                  Generating Suggestions...
                </>
              ) : (
                'Get AI Suggestions'
              )}
            </button>

            {suggestions.length > 0 && (
              <div style={styles.suggestionsGrid}>
                {suggestions.map((s, i) => (
                  <div key={i} style={styles.suggestionCard}>
                    <div style={styles.suggestionHeader}>
                      <span style={styles.suggestionTitle}>{s.title}</span>
                      <span
                        style={{
                          ...styles.categoryTag,
                          color: CATEGORY_COLORS[s.category] || '#a78bfa',
                          borderColor: CATEGORY_COLORS[s.category] || '#a78bfa',
                        }}
                      >
                        {s.category}
                      </span>
                    </div>
                    <p style={styles.suggestionText}>{s.clauseText}</p>
                    {s.whenToUse && (
                      <p style={styles.whenToUse}>When to use: {s.whenToUse}</p>
                    )}
                    <button
                      onClick={() => saveSuggestion(s)}
                      style={styles.addSuggestionBtn}
                    >
                      Add to Library
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Generate Contract Panel */}
        {showGenerate && (
          <div style={styles.panelCard}>
            <h2 style={styles.panelTitle}>Generate Full Contract</h2>
            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Project Type</label>
                <input
                  type="text"
                  value={genProjectType}
                  onChange={(e) => setGenProjectType(e.target.value)}
                  placeholder="e.g., Bathroom Remodel"
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Client Name *</label>
                <input
                  type="text"
                  value={genClientName}
                  onChange={(e) => setGenClientName(e.target.value)}
                  placeholder="Client name"
                  style={styles.input}
                />
              </div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Job / Project Name</label>
              <input
                type="text"
                value={genJobName}
                onChange={(e) => setGenJobName(e.target.value)}
                placeholder="e.g., Smith Kitchen Remodel"
                style={styles.input}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Custom Terms (optional)</label>
              <textarea
                value={genCustomTerms}
                onChange={(e) => setGenCustomTerms(e.target.value)}
                placeholder="Any additional terms or requirements..."
                style={styles.textarea}
                rows={3}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                Select Clauses ({selectedClauseIds.length} selected)
              </label>
              <div style={styles.clauseCheckList}>
                {clauses.map((c) => (
                  <label key={c.id} style={styles.checkItem}>
                    <input
                      type="checkbox"
                      checked={selectedClauseIds.includes(c.id)}
                      onChange={() => toggleClauseSelection(c.id)}
                      style={styles.checkbox}
                    />
                    <span style={styles.checkLabel}>
                      {c.title}
                      <span
                        style={{
                          ...styles.checkCategory,
                          color: CATEGORY_COLORS[c.category] || '#6b7280',
                        }}
                      >
                        {c.category}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <button
              onClick={generateContract}
              disabled={generatingContract}
              style={{ ...styles.generateBtn, opacity: generatingContract ? 0.7 : 1 }}
            >
              {generatingContract ? (
                <>
                  <div style={styles.btnSpinner} />
                  Generating Contract...
                </>
              ) : (
                'Generate Contract'
              )}
            </button>
          </div>
        )}

        {/* Contract HTML Output */}
        {contractHtml && (
          <div style={styles.contractOutput}>
            <div style={styles.contractOutputHeader}>
              <h2 style={styles.panelTitle}>Generated Contract</h2>
              <button
                onClick={() => setContractHtml('')}
                style={styles.closeOutputBtn}
              >
                Close
              </button>
            </div>
            <div
              style={styles.contractHtmlWrap}
              dangerouslySetInnerHTML={{ __html: contractHtml }}
            />
          </div>
        )}

        {/* Add Clause Form */}
        {showForm && (
          <div style={styles.panelCard}>
            <h2 style={styles.panelTitle}>Add New Clause</h2>
            <div style={styles.formRow}>
              <div style={{ ...styles.formGroup, flex: 2 }}>
                <label style={styles.label}>Title</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Clause title..."
                  style={styles.input}
                />
              </div>
              <div style={{ ...styles.formGroup, flex: 1 }}>
                <label style={styles.label}>Category</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  style={styles.select}
                >
                  {CATEGORIES.filter((c) => c.value).map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Clause Text</label>
              <textarea
                value={formText}
                onChange={(e) => setFormText(e.target.value)}
                placeholder="The full clause text..."
                style={styles.textarea}
                rows={5}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>When to Use (optional)</label>
              <input
                type="text"
                value={formWhenToUse}
                onChange={(e) => setFormWhenToUse(e.target.value)}
                placeholder="Brief description of when this clause applies..."
                style={styles.input}
              />
            </div>
            <label style={styles.checkItem}>
              <input
                type="checkbox"
                checked={formIsDefault}
                onChange={(e) => setFormIsDefault(e.target.checked)}
                style={styles.checkbox}
              />
              <span style={styles.checkLabel}>Include by default in new contracts</span>
            </label>
            <div style={{ marginTop: '16px' }}>
              <button
                onClick={addClause}
                disabled={formSaving}
                style={{ ...styles.saveBtn, opacity: formSaving ? 0.7 : 1 }}
              >
                {formSaving ? 'Saving...' : 'Save Clause'}
              </button>
            </div>
          </div>
        )}

        {/* Search and filter */}
        <div style={styles.filterBar}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search clauses..."
            style={styles.searchInput}
          />
          <div style={styles.filterTags}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setCategoryFilter(cat.value)}
                style={{
                  ...styles.filterBtn,
                  ...(categoryFilter === cat.value ? styles.filterActive : {}),
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Clause List grouped by category */}
        {loading ? (
          <div style={styles.loadingWrap}>
            <div style={styles.spinner} />
            <p style={styles.loadingText}>Loading clauses...</p>
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <h3 style={styles.emptyTitle}>No clauses yet</h3>
            <p style={styles.emptyText}>
              Add clauses manually or use AI to suggest relevant clauses.
            </p>
          </div>
        ) : (
          <div style={styles.clauseGroups}>
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category} style={styles.clauseGroup}>
                <div style={styles.groupHeader}>
                  <div
                    style={{
                      ...styles.groupDot,
                      background: CATEGORY_COLORS[category] || '#6b7280',
                    }}
                  />
                  <h3 style={styles.groupTitle}>
                    {CATEGORIES.find((c) => c.value === category)?.label || category}
                  </h3>
                  <span style={styles.groupCount}>{items.length}</span>
                </div>
                <div style={styles.clauseList}>
                  {items.map((clause) => (
                    <div key={clause.id} style={styles.clauseCard}>
                      <div style={styles.clauseCardHeader}>
                        <span style={styles.clauseTitle}>{clause.title}</span>
                        {clause.is_default && (
                          <span style={styles.defaultBadge}>Default</span>
                        )}
                      </div>
                      <p style={styles.clauseText}>{clause.clause_text}</p>
                      {clause.when_to_use && (
                        <p style={styles.clauseWhen}>
                          When to use: {clause.when_to_use}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0a0b0f',
    color: '#e5e7eb',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '0 24px 60px',
  },
  hero: {
    padding: '32px 0 24px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    marginBottom: '20px',
  },
  heroContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px',
  },
  title: {
    fontSize: '2em',
    fontWeight: 800,
    margin: 0,
    color: '#fff',
    letterSpacing: '-0.03em',
  },
  subtitle: {
    color: '#6b7280',
    margin: '4px 0 0',
    fontSize: '0.9em',
  },
  heroActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  primaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #5d47fa 0%, #7c3aed 100%)',
    borderRadius: '10px',
    color: '#fff',
    fontWeight: 600,
    fontSize: '0.88em',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(93,71,250,0.35)',
  },
  secondaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    background: 'rgba(93,71,250,0.1)',
    border: '1px solid rgba(93,71,250,0.25)',
    borderRadius: '10px',
    color: '#a78bfa',
    fontWeight: 600,
    fontSize: '0.88em',
    cursor: 'pointer',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: '10px',
    color: '#fca5a5',
    fontSize: '0.88em',
    marginBottom: '20px',
  },
  errorClose: {
    marginLeft: 'auto',
    background: 'none',
    border: 'none',
    color: '#fca5a5',
    cursor: 'pointer',
    fontSize: '0.85em',
    textDecoration: 'underline',
  },
  panelCard: {
    background: '#12131a',
    borderRadius: '14px',
    padding: '24px',
    border: '1px solid rgba(93,71,250,0.2)',
    marginBottom: '20px',
    animation: 'cardIn 0.3s ease-out',
  },
  panelTitle: {
    fontSize: '1.1em',
    fontWeight: 700,
    color: '#fff',
    margin: '0 0 18px',
  },
  formGroup: {
    marginBottom: '16px',
    flex: 1,
  },
  formRow: {
    display: 'flex',
    gap: '16px',
  },
  label: {
    display: 'block',
    fontSize: '0.82em',
    fontWeight: 600,
    color: '#9ca3af',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#e5e7eb',
    fontSize: '0.92em',
    outline: 'none',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#e5e7eb',
    fontSize: '0.92em',
    outline: 'none',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#e5e7eb',
    fontSize: '0.92em',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
    lineHeight: '1.5',
    boxSizing: 'border-box',
  },
  generateBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 24px',
    background: 'linear-gradient(135deg, #5d47fa 0%, #7c3aed 100%)',
    borderRadius: '10px',
    color: '#fff',
    fontWeight: 600,
    fontSize: '0.9em',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(93,71,250,0.35)',
  },
  btnSpinner: {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  saveBtn: {
    padding: '10px 24px',
    background: 'linear-gradient(135deg, #5d47fa 0%, #7c3aed 100%)',
    borderRadius: '10px',
    color: '#fff',
    fontWeight: 600,
    fontSize: '0.9em',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(93,71,250,0.35)',
  },
  checkItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    padding: '4px 0',
  },
  checkbox: {
    accentColor: '#5d47fa',
  },
  checkLabel: {
    fontSize: '0.88em',
    color: '#d1d5db',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  checkCategory: {
    fontSize: '0.78em',
    fontWeight: 500,
  },
  clauseCheckList: {
    maxHeight: '200px',
    overflowY: 'auto',
    padding: '8px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  suggestionsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: '20px',
  },
  suggestionCard: {
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '10px',
    padding: '16px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  suggestionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  suggestionTitle: {
    fontWeight: 600,
    fontSize: '0.95em',
    color: '#f3f4f6',
  },
  categoryTag: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '0.72em',
    fontWeight: 600,
    textTransform: 'uppercase',
    border: '1px solid',
    letterSpacing: '0.5px',
  },
  suggestionText: {
    color: '#9ca3af',
    fontSize: '0.88em',
    lineHeight: '1.6',
    margin: '0 0 6px',
  },
  whenToUse: {
    color: '#6b7280',
    fontSize: '0.8em',
    fontStyle: 'italic',
    margin: '0 0 10px',
  },
  addSuggestionBtn: {
    padding: '6px 14px',
    background: 'rgba(93,71,250,0.12)',
    border: '1px solid rgba(93,71,250,0.25)',
    borderRadius: '6px',
    color: '#a78bfa',
    fontWeight: 600,
    fontSize: '0.8em',
    cursor: 'pointer',
  },
  contractOutput: {
    background: '#12131a',
    borderRadius: '14px',
    padding: '24px',
    border: '1px solid rgba(93,71,250,0.2)',
    marginBottom: '20px',
  },
  contractOutputHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  closeOutputBtn: {
    padding: '6px 14px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    color: '#9ca3af',
    cursor: 'pointer',
    fontSize: '0.82em',
  },
  contractHtmlWrap: {
    background: '#fff',
    borderRadius: '8px',
    padding: '32px',
    color: '#111',
    fontSize: '0.92em',
    maxHeight: '600px',
    overflow: 'auto',
    lineHeight: '1.6',
  },
  filterBar: {
    marginBottom: '24px',
  },
  searchInput: {
    width: '100%',
    padding: '10px 16px',
    background: '#12131a',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    color: '#e5e7eb',
    fontSize: '0.92em',
    outline: 'none',
    marginBottom: '12px',
    boxSizing: 'border-box',
  },
  filterTags: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  filterBtn: {
    padding: '5px 12px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '6px',
    color: '#6b7280',
    cursor: 'pointer',
    fontSize: '0.8em',
    fontWeight: 500,
  },
  filterActive: {
    background: 'rgba(93,71,250,0.12)',
    borderColor: 'rgba(93,71,250,0.3)',
    color: '#a78bfa',
  },
  clauseGroups: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  clauseGroup: {},
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '10px',
  },
  groupDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
  },
  groupTitle: {
    fontSize: '1em',
    fontWeight: 700,
    color: '#fff',
    margin: 0,
    textTransform: 'capitalize',
  },
  groupCount: {
    fontSize: '0.75em',
    color: '#6b7280',
    background: 'rgba(255,255,255,0.04)',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  clauseList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  clauseCard: {
    background: '#12131a',
    borderRadius: '10px',
    padding: '16px 18px',
    border: '1px solid rgba(255,255,255,0.06)',
    animation: 'cardIn 0.3s ease-out',
  },
  clauseCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  clauseTitle: {
    fontWeight: 600,
    fontSize: '0.95em',
    color: '#f3f4f6',
  },
  defaultBadge: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '0.68em',
    background: 'rgba(93,71,250,0.12)',
    color: '#a78bfa',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  clauseText: {
    color: '#9ca3af',
    fontSize: '0.88em',
    lineHeight: '1.6',
    margin: '0 0 4px',
  },
  clauseWhen: {
    color: '#6b7280',
    fontSize: '0.8em',
    fontStyle: 'italic',
    margin: 0,
  },
  loadingWrap: {
    textAlign: 'center',
    padding: '80px 20px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid rgba(93,71,250,0.2)',
    borderTopColor: '#5d47fa',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto 16px',
  },
  loadingText: {
    color: '#6b7280',
    fontSize: '0.9em',
  },
  emptyState: {
    textAlign: 'center',
    padding: '80px 20px',
  },
  emptyIcon: {
    width: '80px',
    height: '80px',
    borderRadius: '20px',
    background: '#12131a',
    border: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
  },
  emptyTitle: {
    color: '#e5e7eb',
    margin: '0 0 8px',
    fontSize: '1.2em',
    fontWeight: 600,
  },
  emptyText: {
    color: '#6b7280',
    margin: '0 0 24px',
    fontSize: '0.9em',
  },
};
