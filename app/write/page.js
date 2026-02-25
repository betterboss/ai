'use client';

import { useState, useEffect } from 'react';
import Nav from '../components/Nav';

const TABS = [
  { key: 'email', label: 'Email Writer', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { key: 'proposal', label: 'Proposal', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { key: 'change_order', label: 'Change Order', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
  { key: 'clauses', label: 'Contract Clauses', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
];

const EMAIL_TYPES = [
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'estimate_sent', label: 'Estimate Sent' },
  { value: 'payment_reminder', label: 'Payment Reminder' },
  { value: 'project_update', label: 'Project Update' },
  { value: 'complaint_response', label: 'Complaint Response' },
  { value: 'thank_you', label: 'Thank You' },
  { value: 'change_order', label: 'Change Order Notice' },
  { value: 'review_request', label: 'Review Request' },
];

const CHANGE_ORDER_REASONS = [
  { value: 'client_request', label: 'Client Request' },
  { value: 'unforeseen_conditions', label: 'Unforeseen Conditions' },
  { value: 'design_change', label: 'Design Change' },
  { value: 'material_substitution', label: 'Material Substitution' },
];

const CONCERN_OPTIONS = [
  { value: 'payment', label: 'Payment Terms' },
  { value: 'delays', label: 'Delays' },
  { value: 'material_prices', label: 'Material Prices' },
  { value: 'scope_changes', label: 'Scope Changes' },
  { value: 'warranty', label: 'Warranty' },
  { value: 'liability', label: 'Liability' },
  { value: 'termination', label: 'Termination' },
  { value: 'disputes', label: 'Disputes' },
  { value: 'safety', label: 'Safety' },
  { value: 'permits', label: 'Permits' },
  { value: 'subcontractors', label: 'Subcontractors' },
  { value: 'insurance', label: 'Insurance' },
];

export default function WritePage() {
  const [activeTab, setActiveTab] = useState('email');
  const [apiKey, setApiKey] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Email state
  const [emailType, setEmailType] = useState('follow_up');
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailJobName, setEmailJobName] = useState('');
  const [emailContext, setEmailContext] = useState('');
  const [emailResult, setEmailResult] = useState(null);

  // Proposal state
  const [estimates, setEstimates] = useState([]);
  const [selectedEstimate, setSelectedEstimate] = useState('');
  const [proposalTone, setProposalTone] = useState('professional');
  const [includeTerms, setIncludeTerms] = useState(true);
  const [proposalResult, setProposalResult] = useState(null);

  // Change order state
  const [coEstimate, setCoEstimate] = useState('');
  const [coDescription, setCoDescription] = useState('');
  const [coReason, setCoReason] = useState('client_request');
  const [coAddedItems, setCoAddedItems] = useState([{ description: '', quantity: 1, unit: 'each', unit_cost: 0, markup_pct: 25 }]);
  const [coRemovedItems, setCoRemovedItems] = useState([]);
  const [coResult, setCoResult] = useState(null);

  // Clauses state
  const [clauseProjectType, setClauseProjectType] = useState('');
  const [selectedConcerns, setSelectedConcerns] = useState([]);
  const [clauseResult, setClauseResult] = useState(null);

  useEffect(() => {
    setApiKey(localStorage.getItem('mrBetterBoss_apiKey') || '');
    loadEstimates();
  }, []);

  const loadEstimates = async () => {
    try {
      const res = await fetch('/api/estimate');
      const data = await res.json();
      setEstimates(data.estimates || []);
    } catch {
      // Silently fail - estimates are optional
    }
  };

  const handleApiKeyChange = (val) => {
    setApiKey(val);
    localStorage.setItem('mrBetterBoss_apiKey', val);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadHtml = (html, filename) => {
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${filename}</title><style>body{margin:0;padding:40px;font-family:'Inter',-apple-system,sans-serif;}</style></head><body>${html}</body></html>`;
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Email generation
  const generateEmail = async () => {
    if (!apiKey) { setError('Add your Anthropic API key below.'); return; }
    setGenerating(true);
    setError('');
    setEmailResult(null);
    try {
      const res = await fetch('/api/write/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: emailType,
          context: emailContext,
          recipientName: emailRecipient,
          jobName: emailJobName,
          apiKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEmailResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  // Proposal generation
  const generateProposal = async () => {
    if (!apiKey) { setError('Add your Anthropic API key below.'); return; }
    if (!selectedEstimate) { setError('Select an estimate first.'); return; }
    setGenerating(true);
    setError('');
    setProposalResult(null);
    try {
      const res = await fetch('/api/write/proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estimateId: selectedEstimate,
          tone: proposalTone,
          includeTerms,
          apiKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProposalResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  // Change order generation
  const generateChangeOrder = async () => {
    if (!apiKey) { setError('Add your Anthropic API key below.'); return; }
    if (!coEstimate) { setError('Select an estimate first.'); return; }
    if (!coDescription) { setError('Describe the change order.'); return; }
    setGenerating(true);
    setError('');
    setCoResult(null);
    try {
      const validAdded = coAddedItems.filter(i => i.description.trim());
      const validRemoved = coRemovedItems.filter(i => i.description.trim());
      const res = await fetch('/api/write/change-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estimateId: coEstimate,
          description: coDescription,
          reason: coReason,
          addedItems: validAdded,
          removedItems: validRemoved,
          apiKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCoResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  // Clause generation
  const generateClauses = async () => {
    if (!apiKey) { setError('Add your Anthropic API key below.'); return; }
    if (selectedConcerns.length === 0) { setError('Select at least one concern.'); return; }
    setGenerating(true);
    setError('');
    setClauseResult(null);
    try {
      const res = await fetch('/api/write/contract-clause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectType: clauseProjectType,
          concerns: selectedConcerns,
          apiKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setClauseResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const toggleConcern = (concern) => {
    setSelectedConcerns(prev =>
      prev.includes(concern) ? prev.filter(c => c !== concern) : [...prev, concern]
    );
  };

  const addCoItem = (type) => {
    const newItem = { description: '', quantity: 1, unit: 'each', unit_cost: 0, markup_pct: 25 };
    if (type === 'added') {
      setCoAddedItems([...coAddedItems, newItem]);
    } else {
      setCoRemovedItems([...coRemovedItems, newItem]);
    }
  };

  const updateCoItem = (type, index, field, value) => {
    if (type === 'added') {
      const updated = [...coAddedItems];
      updated[index] = { ...updated[index], [field]: value };
      setCoAddedItems(updated);
    } else {
      const updated = [...coRemovedItems];
      updated[index] = { ...updated[index], [field]: value };
      setCoRemovedItems(updated);
    }
  };

  const removeCoItem = (type, index) => {
    if (type === 'added') {
      setCoAddedItems(coAddedItems.filter((_, i) => i !== index));
    } else {
      setCoRemovedItems(coRemovedItems.filter((_, i) => i !== index));
    }
  };

  return (
    <div style={styles.page}>
      <Nav />
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.hero}>
          <div style={styles.heroContent}>
            <div>
              <h1 style={styles.heroTitle}>Writing Tools</h1>
              <p style={styles.heroSub}>AI-powered documents for your construction business</p>
            </div>
          </div>
        </div>

        {/* API Key */}
        {!apiKey && (
          <div style={styles.keyBanner}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Add your Anthropic API key to get started:</span>
            <input
              style={styles.keyInput}
              type="password"
              placeholder="sk-ant-..."
              value={apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={styles.alertError}>
            <span>{error}</span>
            <button onClick={() => setError('')} style={styles.alertClose}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* Tabs */}
        <div style={styles.tabRow}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setError(''); }}
              style={{
                ...styles.tab,
                ...(activeTab === tab.key ? styles.tabActive : {}),
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </div>

        <div style={styles.layout}>
          {/* Form Panel */}
          <div style={styles.formPanel}>

            {/* EMAIL TAB */}
            {activeTab === 'email' && (
              <div style={styles.formCard}>
                <h2 style={styles.formTitle}>Email Writer</h2>
                <p style={styles.formDesc}>Generate professional customer emails in seconds.</p>

                <div style={styles.field}>
                  <label style={styles.label}>Email Type</label>
                  <select
                    style={styles.select}
                    value={emailType}
                    onChange={(e) => setEmailType(e.target.value)}
                  >
                    {EMAIL_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Recipient Name</label>
                  <input
                    style={styles.input}
                    value={emailRecipient}
                    onChange={(e) => setEmailRecipient(e.target.value)}
                    placeholder="John Smith"
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Job / Project Name</label>
                  <input
                    style={styles.input}
                    value={emailJobName}
                    onChange={(e) => setEmailJobName(e.target.value)}
                    placeholder="Kitchen Remodel - 123 Oak St"
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Additional Context <span style={styles.labelHint}>(optional)</span></label>
                  <textarea
                    style={styles.textarea}
                    value={emailContext}
                    onChange={(e) => setEmailContext(e.target.value)}
                    placeholder="Any specific details you want included..."
                    rows={3}
                  />
                </div>

                <button
                  onClick={generateEmail}
                  disabled={generating}
                  style={styles.generateBtn}
                >
                  {generating ? (
                    <><div style={styles.btnSpinner} /> Generating...</>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                      </svg>
                      Generate Email
                    </>
                  )}
                </button>
              </div>
            )}

            {/* PROPOSAL TAB */}
            {activeTab === 'proposal' && (
              <div style={styles.formCard}>
                <h2 style={styles.formTitle}>Proposal Generator</h2>
                <p style={styles.formDesc}>Generate a complete proposal from any estimate.</p>

                <div style={styles.field}>
                  <label style={styles.label}>Select Estimate</label>
                  <select
                    style={styles.select}
                    value={selectedEstimate}
                    onChange={(e) => setSelectedEstimate(e.target.value)}
                  >
                    <option value="">Choose an estimate...</option>
                    {estimates.map(est => (
                      <option key={est.id} value={est.id}>
                        {est.name} — {est.client_name || 'No client'} — ${parseFloat(est.total_price || 0).toLocaleString()}
                      </option>
                    ))}
                  </select>
                  {selectedEstimate && (
                    <a
                      href={`/write/proposal/${selectedEstimate}`}
                      style={styles.fullEditorLink}
                    >
                      Open in full proposal editor
                    </a>
                  )}
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Tone</label>
                  <div style={styles.radioGroup}>
                    {['professional', 'friendly', 'urgent'].map(t => (
                      <button
                        key={t}
                        onClick={() => setProposalTone(t)}
                        style={{
                          ...styles.radioBtn,
                          ...(proposalTone === t ? styles.radioBtnActive : {}),
                        }}
                      >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={styles.field}>
                  <label style={styles.toggleRow}>
                    <input
                      type="checkbox"
                      checked={includeTerms}
                      onChange={(e) => setIncludeTerms(e.target.checked)}
                      style={styles.checkbox}
                    />
                    <span style={styles.toggleLabel}>Include Terms & Conditions</span>
                  </label>
                </div>

                <button
                  onClick={generateProposal}
                  disabled={generating}
                  style={styles.generateBtn}
                >
                  {generating ? (
                    <><div style={styles.btnSpinner} /> Generating...</>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                      </svg>
                      Generate Proposal
                    </>
                  )}
                </button>
              </div>
            )}

            {/* CHANGE ORDER TAB */}
            {activeTab === 'change_order' && (
              <div style={styles.formCard}>
                <h2 style={styles.formTitle}>Change Order</h2>
                <p style={styles.formDesc}>Generate formal change order documents.</p>

                <div style={styles.field}>
                  <label style={styles.label}>Select Estimate</label>
                  <select
                    style={styles.select}
                    value={coEstimate}
                    onChange={(e) => setCoEstimate(e.target.value)}
                  >
                    <option value="">Choose an estimate...</option>
                    {estimates.map(est => (
                      <option key={est.id} value={est.id}>
                        {est.name} — ${parseFloat(est.total_price || 0).toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Reason</label>
                  <select
                    style={styles.select}
                    value={coReason}
                    onChange={(e) => setCoReason(e.target.value)}
                  >
                    {CHANGE_ORDER_REASONS.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Description of Change</label>
                  <textarea
                    style={styles.textarea}
                    value={coDescription}
                    onChange={(e) => setCoDescription(e.target.value)}
                    placeholder="Describe what is changing and why..."
                    rows={3}
                  />
                </div>

                {/* Added Items */}
                <div style={styles.field}>
                  <label style={styles.label}>Added Items</label>
                  {coAddedItems.map((item, i) => (
                    <div key={i} style={styles.itemRow}>
                      <input
                        style={{ ...styles.input, flex: 2 }}
                        value={item.description}
                        onChange={(e) => updateCoItem('added', i, 'description', e.target.value)}
                        placeholder="Description"
                      />
                      <input
                        style={{ ...styles.input, width: '60px', flex: 0 }}
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateCoItem('added', i, 'quantity', e.target.value)}
                        placeholder="Qty"
                      />
                      <input
                        style={{ ...styles.input, width: '80px', flex: 0 }}
                        type="number"
                        value={item.unit_cost}
                        onChange={(e) => updateCoItem('added', i, 'unit_cost', e.target.value)}
                        placeholder="Cost"
                      />
                      <button
                        onClick={() => removeCoItem('added', i)}
                        style={styles.removeItemBtn}
                        title="Remove item"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button onClick={() => addCoItem('added')} style={styles.addItemBtn}>
                    + Add Item
                  </button>
                </div>

                {/* Removed Items */}
                <div style={styles.field}>
                  <label style={styles.label}>Credits / Removed Items</label>
                  {coRemovedItems.map((item, i) => (
                    <div key={i} style={styles.itemRow}>
                      <input
                        style={{ ...styles.input, flex: 2 }}
                        value={item.description}
                        onChange={(e) => updateCoItem('removed', i, 'description', e.target.value)}
                        placeholder="Description"
                      />
                      <input
                        style={{ ...styles.input, width: '60px', flex: 0 }}
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateCoItem('removed', i, 'quantity', e.target.value)}
                        placeholder="Qty"
                      />
                      <input
                        style={{ ...styles.input, width: '80px', flex: 0 }}
                        type="number"
                        value={item.unit_cost}
                        onChange={(e) => updateCoItem('removed', i, 'unit_cost', e.target.value)}
                        placeholder="Cost"
                      />
                      <button
                        onClick={() => removeCoItem('removed', i)}
                        style={styles.removeItemBtn}
                        title="Remove item"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button onClick={() => addCoItem('removed')} style={styles.addItemBtn}>
                    + Add Credit
                  </button>
                </div>

                <button
                  onClick={generateChangeOrder}
                  disabled={generating}
                  style={styles.generateBtn}
                >
                  {generating ? (
                    <><div style={styles.btnSpinner} /> Generating...</>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                      </svg>
                      Generate Change Order
                    </>
                  )}
                </button>
              </div>
            )}

            {/* CLAUSES TAB */}
            {activeTab === 'clauses' && (
              <div style={styles.formCard}>
                <h2 style={styles.formTitle}>Contract Clauses</h2>
                <p style={styles.formDesc}>Get AI-suggested contract clauses for your projects.</p>

                <div style={styles.field}>
                  <label style={styles.label}>Project Type</label>
                  <input
                    style={styles.input}
                    value={clauseProjectType}
                    onChange={(e) => setClauseProjectType(e.target.value)}
                    placeholder="e.g. Kitchen Remodel, New Roof, Commercial Build-Out"
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Areas of Concern</label>
                  <div style={styles.chipGroup}>
                    {CONCERN_OPTIONS.map(c => (
                      <button
                        key={c.value}
                        onClick={() => toggleConcern(c.value)}
                        style={{
                          ...styles.chip,
                          ...(selectedConcerns.includes(c.value) ? styles.chipActive : {}),
                        }}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={generateClauses}
                  disabled={generating}
                  style={styles.generateBtn}
                >
                  {generating ? (
                    <><div style={styles.btnSpinner} /> Generating...</>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                      </svg>
                      Generate Clauses
                    </>
                  )}
                </button>
              </div>
            )}

            {/* API Key Setting (always visible at bottom) */}
            {apiKey && (
              <div style={styles.settingsCard}>
                <div style={styles.settingsHeader}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  <span style={styles.settingsLabel}>API Key</span>
                </div>
                <input
                  style={styles.input}
                  type="password"
                  value={apiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  placeholder="sk-ant-..."
                />
              </div>
            )}
          </div>

          {/* Output Panel */}
          <div style={styles.outputPanel}>
            {/* Email Output */}
            {activeTab === 'email' && emailResult && (
              <div style={styles.outputCard}>
                <div style={styles.outputHeader}>
                  <h3 style={styles.outputTitle}>Generated Email</h3>
                  <div style={styles.outputActions}>
                    <button
                      onClick={() => copyToClipboard(`Subject: ${emailResult.subject}\n\n${emailResult.body}`)}
                      style={styles.copyBtn}
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
                <div style={styles.emailPreview}>
                  <div style={styles.emailSubject}>
                    <span style={styles.emailSubjectLabel}>Subject:</span>
                    {emailResult.subject}
                  </div>
                  <div style={styles.emailBody}>
                    {emailResult.body.split('\n').map((line, i) => (
                      <p key={i} style={styles.emailLine}>{line || '\u00A0'}</p>
                    ))}
                  </div>
                </div>
                {emailResult.usage && (
                  <div style={styles.usageBadge}>
                    Tokens: {emailResult.usage.input_tokens + emailResult.usage.output_tokens}
                  </div>
                )}
              </div>
            )}

            {/* Proposal Output */}
            {activeTab === 'proposal' && proposalResult && (
              <div style={styles.outputCard}>
                <div style={styles.outputHeader}>
                  <h3 style={styles.outputTitle}>Generated Proposal</h3>
                  <div style={styles.outputActions}>
                    <button
                      onClick={() => copyToClipboard(proposalResult.proposal_text)}
                      style={styles.copyBtn}
                    >
                      {copied ? 'Copied!' : 'Copy Text'}
                    </button>
                    <button
                      onClick={() => downloadHtml(proposalResult.proposal_html, 'proposal')}
                      style={styles.downloadBtn}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                      </svg>
                      Download HTML
                    </button>
                  </div>
                </div>
                <div
                  style={styles.htmlPreview}
                  dangerouslySetInnerHTML={{ __html: proposalResult.proposal_html }}
                />
                {proposalResult.usage && (
                  <div style={styles.usageBadge}>
                    Tokens: {proposalResult.usage.input_tokens + proposalResult.usage.output_tokens}
                  </div>
                )}
              </div>
            )}

            {/* Change Order Output */}
            {activeTab === 'change_order' && coResult && (
              <div style={styles.outputCard}>
                <div style={styles.outputHeader}>
                  <h3 style={styles.outputTitle}>Change Order Document</h3>
                  <div style={styles.outputActions}>
                    <button
                      onClick={() => downloadHtml(coResult.document_html, 'change-order')}
                      style={styles.downloadBtn}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                      </svg>
                      Download HTML
                    </button>
                  </div>
                </div>
                {coResult.cost_summary && (
                  <div style={styles.costSummary}>
                    <div style={styles.costRow}>
                      <span>Added:</span>
                      <span style={{ color: '#ef4444' }}>+${coResult.cost_summary.added_total.toFixed(2)}</span>
                    </div>
                    <div style={styles.costRow}>
                      <span>Credits:</span>
                      <span style={{ color: '#22c55e' }}>-${coResult.cost_summary.removed_total.toFixed(2)}</span>
                    </div>
                    <div style={{ ...styles.costRow, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px', fontWeight: 700 }}>
                      <span>Net Impact:</span>
                      <span style={{ color: coResult.cost_summary.net_impact >= 0 ? '#ef4444' : '#22c55e' }}>
                        {coResult.cost_summary.net_impact >= 0 ? '+' : ''}${coResult.cost_summary.net_impact.toFixed(2)}
                      </span>
                    </div>
                    <div style={styles.costRow}>
                      <span>New Total:</span>
                      <span style={{ color: '#a78bfa', fontWeight: 700 }}>${coResult.cost_summary.new_total.toFixed(2)}</span>
                    </div>
                  </div>
                )}
                <div
                  style={styles.htmlPreview}
                  dangerouslySetInnerHTML={{ __html: coResult.document_html }}
                />
                {coResult.usage && (
                  <div style={styles.usageBadge}>
                    Tokens: {coResult.usage.input_tokens + coResult.usage.output_tokens}
                  </div>
                )}
              </div>
            )}

            {/* Clauses Output */}
            {activeTab === 'clauses' && clauseResult && (
              <div style={styles.outputCard}>
                <div style={styles.outputHeader}>
                  <h3 style={styles.outputTitle}>Suggested Clauses ({clauseResult.clauses?.length || 0})</h3>
                  <div style={styles.outputActions}>
                    <button
                      onClick={() => {
                        const text = clauseResult.clauses.map(c =>
                          `## ${c.title}\nCategory: ${c.category}\n\n${c.clause_text}\n\nWhen to use: ${c.when_to_use}`
                        ).join('\n\n---\n\n');
                        copyToClipboard(text);
                      }}
                      style={styles.copyBtn}
                    >
                      {copied ? 'Copied!' : 'Copy All'}
                    </button>
                  </div>
                </div>
                <div style={styles.clausesList}>
                  {(clauseResult.clauses || []).map((clause, i) => (
                    <div key={i} style={styles.clauseCard}>
                      <div style={styles.clauseHeader}>
                        <h4 style={styles.clauseTitle}>{clause.title}</h4>
                        <span style={{
                          ...styles.clauseBadge,
                          ...(clause.source === 'default' ? styles.clauseBadgeDefault : {}),
                        }}>
                          {clause.source === 'default' ? 'Default' : clause.category}
                        </span>
                      </div>
                      <p style={styles.clauseText}>{clause.clause_text}</p>
                      <p style={styles.clauseWhen}>
                        <strong>When to use:</strong> {clause.when_to_use}
                      </p>
                      <button
                        onClick={() => copyToClipboard(clause.clause_text)}
                        style={styles.clauseCopyBtn}
                      >
                        Copy Clause
                      </button>
                    </div>
                  ))}
                </div>
                {clauseResult.usage && (
                  <div style={styles.usageBadge}>
                    Tokens: {clauseResult.usage.input_tokens + clauseResult.usage.output_tokens}
                  </div>
                )}
              </div>
            )}

            {/* Empty state */}
            {((activeTab === 'email' && !emailResult) ||
              (activeTab === 'proposal' && !proposalResult) ||
              (activeTab === 'change_order' && !coResult) ||
              (activeTab === 'clauses' && !clauseResult)) && !generating && (
              <div style={styles.emptyOutput}>
                <div style={styles.emptyIconWrap}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <p style={styles.emptyTitle}>Ready to write</p>
                <p style={styles.emptyText}>Fill out the form and click Generate to create your document.</p>
              </div>
            )}

            {/* Generating state */}
            {generating && (
              <div style={styles.emptyOutput}>
                <div style={styles.spinner} />
                <p style={styles.emptyTitle}>Generating...</p>
                <p style={styles.emptyText}>AI is crafting your document. This may take a few seconds.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
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
    maxWidth: '1280px',
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
  },
  heroTitle: {
    fontSize: '2em',
    fontWeight: 800,
    margin: 0,
    color: '#fff',
    letterSpacing: '-0.03em',
  },
  heroSub: {
    color: '#6b7280',
    margin: '4px 0 0',
    fontSize: '0.9em',
  },
  keyBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    background: 'rgba(245,158,11,0.06)',
    border: '1px solid rgba(245,158,11,0.2)',
    borderRadius: '10px',
    marginBottom: '16px',
    fontSize: '0.88em',
    color: '#f59e0b',
  },
  keyInput: {
    flex: 1,
    padding: '7px 12px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    color: '#e5e7eb',
    fontSize: '0.9em',
    fontFamily: 'inherit',
    outline: 'none',
  },
  alertError: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: '10px',
    color: '#ef4444',
    fontSize: '0.88em',
    marginBottom: '16px',
  },
  alertClose: {
    background: 'transparent',
    border: 'none',
    color: 'inherit',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
  },
  tabRow: {
    display: 'flex',
    gap: '4px',
    marginBottom: '20px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    paddingBottom: '0',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 18px',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#6b7280',
    cursor: 'pointer',
    fontSize: '0.88em',
    fontWeight: 500,
    transition: 'all 0.2s',
    fontFamily: 'inherit',
  },
  tabActive: {
    color: '#a78bfa',
    borderBottomColor: '#5d47fa',
    background: 'rgba(93,71,250,0.06)',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '380px 1fr',
    gap: '20px',
    alignItems: 'start',
  },
  formPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    position: 'sticky',
    top: '72px',
  },
  formCard: {
    background: '#12131a',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  formTitle: {
    fontSize: '1.15em',
    fontWeight: 700,
    color: '#fff',
    margin: '0 0 4px',
  },
  formDesc: {
    color: '#6b7280',
    fontSize: '0.85em',
    margin: '0 0 20px',
    lineHeight: 1.4,
  },
  field: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '0.78em',
    color: '#9ca3af',
    marginBottom: '6px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  labelHint: {
    fontWeight: 400,
    textTransform: 'none',
    letterSpacing: 'normal',
    color: '#4b5563',
  },
  input: {
    width: '100%',
    padding: '9px 12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    color: '#e5e7eb',
    fontSize: '0.9em',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '9px 12px',
    background: '#12131a',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    color: '#e5e7eb',
    fontSize: '0.9em',
    fontFamily: 'inherit',
    outline: 'none',
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '9px 12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    color: '#e5e7eb',
    fontSize: '0.9em',
    fontFamily: 'inherit',
    outline: 'none',
    resize: 'vertical',
    lineHeight: 1.5,
    boxSizing: 'border-box',
  },
  radioGroup: {
    display: 'flex',
    gap: '6px',
  },
  radioBtn: {
    flex: 1,
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    color: '#6b7280',
    fontSize: '0.85em',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s',
    textAlign: 'center',
  },
  radioBtnActive: {
    background: 'rgba(93,71,250,0.12)',
    borderColor: 'rgba(93,71,250,0.3)',
    color: '#a78bfa',
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
  },
  checkbox: {
    accentColor: '#5d47fa',
    width: '16px',
    height: '16px',
    cursor: 'pointer',
  },
  toggleLabel: {
    color: '#e5e7eb',
    fontSize: '0.9em',
  },
  fullEditorLink: {
    display: 'inline-block',
    marginTop: '6px',
    color: '#7a64ff',
    fontSize: '0.82em',
    textDecoration: 'none',
    fontWeight: 500,
  },
  chipGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  chip: {
    padding: '6px 12px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px',
    color: '#6b7280',
    fontSize: '0.82em',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s',
  },
  chipActive: {
    background: 'rgba(93,71,250,0.12)',
    borderColor: 'rgba(93,71,250,0.3)',
    color: '#a78bfa',
  },
  itemRow: {
    display: 'flex',
    gap: '6px',
    marginBottom: '6px',
    alignItems: 'center',
  },
  removeItemBtn: {
    background: 'transparent',
    border: 'none',
    color: '#6b7280',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  addItemBtn: {
    padding: '6px 12px',
    background: 'transparent',
    border: '1px dashed rgba(255,255,255,0.1)',
    borderRadius: '6px',
    color: '#6b7280',
    fontSize: '0.82em',
    cursor: 'pointer',
    fontFamily: 'inherit',
    width: '100%',
    marginTop: '4px',
  },
  generateBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '12px 20px',
    background: 'linear-gradient(135deg, #5d47fa 0%, #7c3aed 100%)',
    borderRadius: '10px',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.95em',
    fontFamily: 'inherit',
    boxShadow: '0 4px 16px rgba(93,71,250,0.35)',
    transition: 'all 0.2s',
    marginTop: '8px',
  },
  btnSpinner: {
    width: '14px',
    height: '14px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  settingsCard: {
    background: '#12131a',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  settingsHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '8px',
  },
  settingsLabel: {
    fontSize: '0.78em',
    color: '#6b7280',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  outputPanel: {
    minWidth: 0,
  },
  outputCard: {
    background: '#12131a',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  outputHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  outputTitle: {
    fontSize: '1em',
    fontWeight: 600,
    color: '#f3f4f6',
    margin: 0,
  },
  outputActions: {
    display: 'flex',
    gap: '6px',
  },
  copyBtn: {
    padding: '6px 14px',
    background: 'rgba(93,71,250,0.1)',
    border: '1px solid rgba(93,71,250,0.25)',
    borderRadius: '6px',
    color: '#a78bfa',
    fontSize: '0.82em',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  downloadBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    background: 'linear-gradient(135deg, #5d47fa, #7c3aed)',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '0.82em',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  emailPreview: {
    padding: '20px',
  },
  emailSubject: {
    fontWeight: 600,
    color: '#f3f4f6',
    marginBottom: '16px',
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '8px',
    fontSize: '0.95em',
  },
  emailSubjectLabel: {
    color: '#6b7280',
    fontWeight: 500,
    marginRight: '8px',
    fontSize: '0.85em',
  },
  emailBody: {
    padding: '0 4px',
  },
  emailLine: {
    color: '#d1d5db',
    fontSize: '0.9em',
    lineHeight: 1.7,
    margin: '0 0 4px',
  },
  htmlPreview: {
    padding: '24px',
    background: '#fff',
    borderRadius: '0 0 12px 12px',
    overflow: 'auto',
    maxHeight: '70vh',
  },
  costSummary: {
    padding: '16px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  costRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.9em',
    padding: '4px 0',
    color: '#9ca3af',
  },
  clausesList: {
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  clauseCard: {
    background: 'rgba(255,255,255,0.025)',
    borderRadius: '10px',
    padding: '16px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  clauseHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '8px',
    gap: '12px',
  },
  clauseTitle: {
    fontSize: '0.95em',
    fontWeight: 600,
    color: '#f3f4f6',
    margin: 0,
  },
  clauseBadge: {
    padding: '3px 8px',
    background: 'rgba(93,71,250,0.1)',
    border: '1px solid rgba(93,71,250,0.2)',
    borderRadius: '4px',
    color: '#a78bfa',
    fontSize: '0.7em',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  clauseBadgeDefault: {
    background: 'rgba(34,197,94,0.1)',
    borderColor: 'rgba(34,197,94,0.2)',
    color: '#22c55e',
  },
  clauseText: {
    color: '#d1d5db',
    fontSize: '0.88em',
    lineHeight: 1.7,
    margin: '0 0 8px',
  },
  clauseWhen: {
    color: '#6b7280',
    fontSize: '0.82em',
    lineHeight: 1.5,
    margin: '0 0 10px',
  },
  clauseCopyBtn: {
    padding: '4px 10px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '4px',
    color: '#9ca3af',
    fontSize: '0.78em',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  usageBadge: {
    padding: '8px 20px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    color: '#4b5563',
    fontSize: '0.75em',
    textAlign: 'right',
  },
  emptyOutput: {
    textAlign: 'center',
    padding: '80px 24px',
    background: '#12131a',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  emptyIconWrap: {
    width: '72px',
    height: '72px',
    borderRadius: '18px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
  },
  emptyTitle: {
    color: '#e5e7eb',
    fontSize: '1.1em',
    fontWeight: 600,
    margin: '0 0 6px',
  },
  emptyText: {
    color: '#6b7280',
    fontSize: '0.88em',
    margin: 0,
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
};
