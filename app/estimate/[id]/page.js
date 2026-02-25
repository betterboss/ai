'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Nav from '../../components/Nav';
import EstimateTable from '../../components/EstimateTable';
import TakeoffUploader from '../../components/TakeoffUploader';
import CatalogPicker from '../../components/CatalogPicker';

const STATUS_COLORS = {
  draft: { bg: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: 'rgba(251,191,36,0.25)' },
  sent: { bg: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: 'rgba(139,92,246,0.25)' },
  approved: { bg: 'rgba(34,197,94,0.1)', color: '#22c55e', border: 'rgba(34,197,94,0.25)' },
  rejected: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'rgba(239,68,68,0.25)' },
};

const SEVERITY_COLORS = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#6b7280',
};

export default function EstimateEditor() {
  const params = useParams();
  const estimateId = params.id;

  const [estimate, setEstimate] = useState(null);
  const [items, setItems] = useState([]);
  const [takeoffs, setTakeoffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [error, setError] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [grantKey, setGrantKey] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [clientInfo, setClientInfo] = useState({ client_name: '', client_email: '', client_phone: '', job_address: '' });
  const saveTimerRef = useRef(null);

  useEffect(() => {
    setApiKey(localStorage.getItem('mrBetterBoss_apiKey') || '');
    setGrantKey(localStorage.getItem('bb_jobtread_grant_key') || '');
    loadEstimate();
  }, [estimateId]);

  const loadEstimate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/estimate/${estimateId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEstimate(data.estimate);
      setItems(data.items || []);
      setTakeoffs(data.takeoffs || []);
      setClientInfo({
        client_name: data.estimate.client_name || '',
        client_email: data.estimate.client_email || '',
        client_phone: data.estimate.client_phone || '',
        job_address: data.estimate.job_address || '',
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveEstimate = async (updates) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/estimate/${estimateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEstimate(data.estimate);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateClientInfo = (field, value) => {
    const updated = { ...clientInfo, [field]: value };
    setClientInfo(updated);
    // Debounce the save
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveEstimate({ [field]: value });
    }, 600);
  };

  const updateItem = async (itemId, updates) => {
    try {
      const res = await fetch(`/api/estimate/${estimateId}/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, ...updates }),
      });
      if (!res.ok) throw new Error('Failed to update item');
      loadEstimate();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteItem = async (itemId) => {
    try {
      const res = await fetch(`/api/estimate/${estimateId}/items?item_id=${itemId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete item');
      loadEstimate();
    } catch (err) {
      setError(err.message);
    }
  };

  const addBlankItem = async () => {
    try {
      const res = await fetch(`/api/estimate/${estimateId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: 'New item',
          quantity: 1,
          unit: 'each',
          unit_cost: 0,
          markup_pct: 25,
          category: 'General',
        }),
      });
      if (!res.ok) throw new Error('Failed to add item');
      loadEstimate();
    } catch (err) {
      setError(err.message);
    }
  };

  const addFromCatalog = async (catalogItem) => {
    try {
      const res = await fetch(`/api/estimate/${estimateId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: catalogItem.name,
          quantity: 1,
          unit: catalogItem.unit,
          unit_cost: catalogItem.unit_cost,
          markup_pct: catalogItem.markup_pct,
          category: catalogItem.category,
          catalog_item_id: catalogItem.id,
          source: 'catalog',
        }),
      });
      if (!res.ok) throw new Error('Failed to add catalog item');
      loadEstimate();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleTakeoffComplete = useCallback(async (data) => {
    if (!data.items?.length) return;

    const lineItems = data.items.map(item => ({
      category: item.category || 'General',
      description: item.description,
      quantity: item.quantity || 0,
      unit: item.unit || 'each',
      unit_cost: 0,
      markup_pct: 25,
      source: 'takeoff',
    }));

    try {
      const res = await fetch(`/api/estimate/${estimateId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: lineItems }),
      });
      if (!res.ok) throw new Error('Failed to add takeoff items');
      loadEstimate();
    } catch (err) {
      setError(err.message);
    }
  }, [estimateId]);

  const reviewEstimate = async () => {
    if (!apiKey) {
      setError('Anthropic API key is required for AI review. Add it in Settings below.');
      return;
    }
    setReviewing(true);
    setError('');
    setReviewResult(null);
    try {
      const res = await fetch('/api/estimate/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimate, items, apiKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReviewResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setReviewing(false);
    }
  };

  const addSuggestedItem = async (suggestion) => {
    try {
      const res = await fetch(`/api/estimate/${estimateId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: suggestion.description,
          quantity: suggestion.quantity || 1,
          unit: suggestion.unit || 'each',
          unit_cost: 0,
          markup_pct: 25,
          category: suggestion.category || 'General',
          source: 'manual',
        }),
      });
      if (!res.ok) throw new Error('Failed to add suggested item');
      loadEstimate();
    } catch (err) {
      setError(err.message);
    }
  };

  const syncToJobTread = async () => {
    if (!grantKey) {
      setError('JobTread grant key is required. Add it in Settings below.');
      return;
    }

    setSyncing(true);
    setError('');
    setSyncResult(null);

    try {
      const res = await fetch(`/api/estimate/${estimateId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grantKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSyncResult(data);
      loadEstimate();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <Nav />
        <div style={styles.loadingWrap}>
          <div style={styles.spinner} />
          <p style={{ color: '#6b7280' }}>Loading estimate...</p>
        </div>
        <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!estimate) {
    return (
      <div style={styles.page}>
        <Nav />
        <div style={styles.loadingWrap}>
          <p style={{ color: '#ef4444' }}>Estimate not found</p>
          <a href="/estimate" style={styles.backLink}>Back to Estimates</a>
        </div>
      </div>
    );
  }

  const statusStyle = STATUS_COLORS[estimate.status] || STATUS_COLORS.draft;
  const totalPrice = parseFloat(estimate.total_price || 0);
  const totalCost = parseFloat(estimate.total_cost || 0);
  const margin = parseFloat(estimate.margin_pct || 0);

  return (
    <div style={styles.page}>
      <Nav />
      <div style={styles.container}>
        {/* Header Bar */}
        <div style={styles.topBar}>
          <a href="/estimate" style={styles.backLink}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Estimates
          </a>
          {saving && <span style={styles.savingBadge}>Saving...</span>}
        </div>

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.headerTitleRow}>
              <h1 style={styles.title}>{estimate.name}</h1>
              <select
                value={estimate.status || 'draft'}
                onChange={e => saveEstimate({ status: e.target.value })}
                style={{ ...styles.statusBadge, background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}`, cursor: 'pointer', appearance: 'none', paddingRight: '10px' }}
              >
                <option value="draft">draft</option>
                <option value="sent">sent</option>
                <option value="approved">approved</option>
                <option value="rejected">rejected</option>
              </select>
            </div>
            {estimate.client_name && (
              <p style={styles.clientName}>{estimate.client_name}</p>
            )}
          </div>
          <div style={styles.headerRight}>
            <div style={styles.priceBlock}>
              <div style={styles.priceLabel}>Total Price</div>
              <div style={styles.priceValue}>
                ${totalPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </div>
            <div style={styles.marginBlock}>
              <div style={styles.marginLabel}>Margin</div>
              <div style={{ ...styles.marginValue, color: margin >= 20 ? '#22c55e' : margin >= 10 ? '#f59e0b' : '#ef4444' }}>
                {margin.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {/* Alerts */}
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
        {syncResult && (
          <div style={styles.alertSuccess}>
            <span>Synced to JobTread! Estimate #{syncResult.jobtread_estimate_number}</span>
            <button onClick={() => setSyncResult(null)} style={styles.alertClose}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        <div style={styles.layout}>
          {/* Sidebar */}
          <div style={styles.sidebar}>
            {/* Quick Actions */}
            <div style={styles.sideCard}>
              <div style={styles.sideHeader}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                <h3 style={styles.sideTitle}>Actions</h3>
              </div>
              <div style={styles.actionGrid}>
                <button onClick={reviewEstimate} disabled={reviewing} style={styles.actionBtnAI}>
                  {reviewing ? (
                    <><div style={styles.btnSpinnerSm} /> Reviewing...</>
                  ) : (
                    <>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      AI Review
                    </>
                  )}
                </button>
                <button onClick={syncToJobTread} disabled={syncing} style={styles.actionBtnSync}>
                  {syncing ? (
                    <><div style={styles.btnSpinnerSm} /> Syncing...</>
                  ) : (
                    <>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Sync to JT
                    </>
                  )}
                </button>
              </div>
              <a href={`/estimate/${estimateId}/quote`} style={styles.quoteLink}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                Generate Quote / PDF
              </a>
            </div>

            {/* Takeoff Upload */}
            <div style={styles.sideCard}>
              <div style={styles.sideHeader}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <h3 style={styles.sideTitle}>Blueprint Takeoff</h3>
              </div>
              <TakeoffUploader
                estimateId={estimateId}
                apiKey={apiKey}
                onTakeoffComplete={handleTakeoffComplete}
              />
            </div>

            {/* Job Info */}
            <div style={styles.sideCard}>
              <div style={styles.sideHeader}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <h3 style={styles.sideTitle}>Client Info</h3>
              </div>
              <div style={styles.fieldGroup}>
                <div style={styles.infoField}>
                  <label style={styles.infoLabel}>Client</label>
                  <input
                    style={styles.infoInput}
                    value={clientInfo.client_name}
                    onChange={e => updateClientInfo('client_name', e.target.value)}
                    placeholder="Client name"
                  />
                </div>
                <div style={styles.infoField}>
                  <label style={styles.infoLabel}>Email</label>
                  <input
                    style={styles.infoInput}
                    value={clientInfo.client_email}
                    onChange={e => updateClientInfo('client_email', e.target.value)}
                    placeholder="Email"
                  />
                </div>
                <div style={styles.infoField}>
                  <label style={styles.infoLabel}>Phone</label>
                  <input
                    style={styles.infoInput}
                    value={clientInfo.client_phone}
                    onChange={e => updateClientInfo('client_phone', e.target.value)}
                    placeholder="Phone"
                  />
                </div>
                <div style={styles.infoField}>
                  <label style={styles.infoLabel}>Address</label>
                  <input
                    style={styles.infoInput}
                    value={clientInfo.job_address}
                    onChange={e => updateClientInfo('job_address', e.target.value)}
                    placeholder="Job address"
                  />
                </div>
              </div>
            </div>

            {/* Settings (collapsible) */}
            <div style={styles.sideCard}>
              <button onClick={() => setShowSettings(!showSettings)} style={styles.settingsToggle}>
                <div style={styles.sideHeader}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <h3 style={styles.sideTitle}>Settings</h3>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#6b7280', transform: showSettings ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                  <path d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showSettings && (
                <div style={styles.fieldGroup}>
                  <div style={styles.infoField}>
                    <label style={styles.infoLabel}>Anthropic API Key</label>
                    <input
                      style={styles.infoInput}
                      type="password"
                      value={apiKey}
                      onChange={e => {
                        setApiKey(e.target.value);
                        localStorage.setItem('mrBetterBoss_apiKey', e.target.value);
                      }}
                      placeholder="sk-ant-..."
                    />
                  </div>
                  <div style={styles.infoField}>
                    <label style={styles.infoLabel}>JobTread Grant Key</label>
                    <input
                      style={styles.infoInput}
                      type="password"
                      value={grantKey}
                      onChange={e => {
                        setGrantKey(e.target.value);
                        localStorage.setItem('bb_jobtread_grant_key', e.target.value);
                      }}
                      placeholder="Grant key"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div style={styles.main}>
            {/* AI Review Panel */}
            {reviewResult && (
              <div style={styles.reviewPanel}>
                <div style={styles.reviewHeader}>
                  <div style={styles.reviewTitleRow}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#a78bfa' }}>
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span style={styles.reviewTitle}>AI Review</span>
                    <span style={{
                      ...styles.reviewScore,
                      color: reviewResult.score >= 80 ? '#22c55e' : reviewResult.score >= 60 ? '#f59e0b' : '#ef4444'
                    }}>
                      {reviewResult.score}/100
                    </span>
                  </div>
                  <button onClick={() => setReviewResult(null)} style={styles.alertClose}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                {reviewResult.summary && (
                  <p style={styles.reviewSummary}>{reviewResult.summary}</p>
                )}
                {reviewResult.issues?.length > 0 && (
                  <div style={styles.reviewIssues}>
                    {reviewResult.issues.map((issue, i) => {
                      const sevColor = SEVERITY_COLORS[issue.severity] || SEVERITY_COLORS.low;
                      return (
                        <div key={i} style={{ ...styles.reviewIssue, borderLeftColor: sevColor }}>
                          <div style={styles.reviewIssueHeader}>
                            <span style={{ ...styles.severityBadge, background: sevColor + '18', color: sevColor }}>
                              {issue.severity}
                            </span>
                            <span style={styles.reviewIssueType}>{issue.type?.replace(/_/g, ' ')}</span>
                          </div>
                          <p style={styles.reviewIssueMsg}>{issue.message}</p>
                          {issue.suggestion && (
                            <button onClick={() => addSuggestedItem(issue.suggestion)} style={styles.reviewAddBtn}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 5v14M5 12h14" />
                              </svg>
                              Add: {issue.suggestion.description}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Line Items Header */}
            <div style={styles.tableHeader}>
              <h2 style={styles.tableTitle}>
                Line Items
                <span style={styles.itemCount}>{items.length}</span>
              </h2>
              <div style={styles.tableActions}>
                <button onClick={() => setShowCatalog(true)} style={styles.tableBtnSecondary}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  Catalog
                </button>
                <button onClick={addBlankItem} style={styles.tableBtn}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Add Item
                </button>
              </div>
            </div>

            <EstimateTable
              items={items}
              onUpdateItem={updateItem}
              onDeleteItem={deleteItem}
              onAddItem={addBlankItem}
              defaultMarkup={25}
            />
          </div>
        </div>
      </div>

      {showCatalog && (
        <CatalogPicker
          onSelect={addFromCatalog}
          onClose={() => setShowCatalog(false)}
        />
      )}

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
  topBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 0 8px',
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    color: '#6b7280',
    textDecoration: 'none',
    fontSize: '0.85em',
    fontWeight: 500,
  },
  savingBadge: {
    padding: '3px 10px',
    background: 'rgba(93,71,250,0.1)',
    borderRadius: '6px',
    color: '#a78bfa',
    fontSize: '0.75em',
    fontWeight: 500,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '8px 0 24px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    marginBottom: '24px',
  },
  headerLeft: {},
  headerTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  title: {
    fontSize: '1.6em',
    fontWeight: 800,
    margin: 0,
    color: '#fff',
    letterSpacing: '-0.02em',
  },
  statusBadge: {
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '0.7em',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  clientName: {
    color: '#9ca3af',
    margin: '4px 0 0',
    fontSize: '0.9em',
  },
  headerRight: {
    display: 'flex',
    gap: '24px',
    alignItems: 'flex-end',
  },
  priceBlock: { textAlign: 'right' },
  priceLabel: { fontSize: '0.72em', color: '#6b7280', marginBottom: '2px' },
  priceValue: { fontSize: '1.5em', fontWeight: 800, color: '#22c55e', fontVariantNumeric: 'tabular-nums' },
  marginBlock: { textAlign: 'right' },
  marginLabel: { fontSize: '0.72em', color: '#6b7280', marginBottom: '2px' },
  marginValue: { fontSize: '1.5em', fontWeight: 800, fontVariantNumeric: 'tabular-nums' },
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
  alertSuccess: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    background: 'rgba(34,197,94,0.08)',
    border: '1px solid rgba(34,197,94,0.2)',
    borderRadius: '10px',
    color: '#22c55e',
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
  layout: {
    display: 'grid',
    gridTemplateColumns: '280px 1fr',
    gap: '20px',
    alignItems: 'start',
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    position: 'sticky',
    top: '72px',
  },
  sideCard: {
    background: 'rgba(255,255,255,0.025)',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  sideHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#9ca3af',
    marginBottom: '12px',
  },
  sideTitle: {
    fontSize: '0.8em',
    fontWeight: 600,
    color: '#9ca3af',
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  actionGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
    marginBottom: '8px',
  },
  actionBtnAI: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '9px 12px',
    background: 'rgba(251,191,36,0.08)',
    border: '1px solid rgba(251,191,36,0.2)',
    borderRadius: '8px',
    color: '#fbbf24',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.82em',
  },
  actionBtnSync: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '9px 12px',
    background: 'linear-gradient(135deg, #5d47fa 0%, #7c3aed 100%)',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.82em',
  },
  quoteLink: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '9px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    color: '#9ca3af',
    textDecoration: 'none',
    fontSize: '0.82em',
    fontWeight: 500,
    transition: 'all 0.15s',
  },
  btnSpinnerSm: {
    width: '12px',
    height: '12px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: 'currentColor',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  infoField: {},
  infoLabel: {
    display: 'block',
    fontSize: '0.72em',
    color: '#6b7280',
    marginBottom: '4px',
    fontWeight: 500,
  },
  infoInput: {
    width: '100%',
    padding: '7px 10px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '6px',
    color: '#e5e7eb',
    fontSize: '0.85em',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
  },
  settingsToggle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
  },
  main: {
    minWidth: 0,
  },
  reviewPanel: {
    background: 'rgba(139,92,246,0.05)',
    border: '1px solid rgba(139,92,246,0.15)',
    borderRadius: '12px',
    padding: '18px',
    marginBottom: '20px',
  },
  reviewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  reviewTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  reviewTitle: {
    fontWeight: 700,
    fontSize: '1em',
    color: '#f3f4f6',
  },
  reviewScore: {
    fontWeight: 700,
    fontSize: '0.9em',
    padding: '2px 8px',
    borderRadius: '6px',
    background: 'rgba(255,255,255,0.06)',
  },
  reviewSummary: {
    color: '#9ca3af',
    fontSize: '0.85em',
    margin: '0 0 14px',
    lineHeight: 1.6,
  },
  reviewIssues: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  reviewIssue: {
    background: 'rgba(255,255,255,0.025)',
    borderRadius: '8px',
    padding: '12px 14px',
    borderLeft: '3px solid',
  },
  reviewIssueHeader: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    marginBottom: '4px',
  },
  severityBadge: {
    fontSize: '0.68em',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  reviewIssueType: {
    fontSize: '0.75em',
    color: '#6b7280',
    textTransform: 'capitalize',
  },
  reviewIssueMsg: {
    fontSize: '0.85em',
    color: '#e5e7eb',
    margin: '0 0 6px',
    lineHeight: 1.5,
  },
  reviewAddBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    background: 'rgba(93,71,250,0.1)',
    border: '1px solid rgba(93,71,250,0.25)',
    borderRadius: '6px',
    color: '#a78bfa',
    padding: '4px 10px',
    fontSize: '0.78em',
    cursor: 'pointer',
    fontWeight: 500,
  },
  tableHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '14px',
  },
  tableTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '1.05em',
    fontWeight: 600,
    margin: 0,
    color: '#f3f4f6',
  },
  itemCount: {
    padding: '2px 8px',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: '10px',
    fontSize: '0.75em',
    color: '#9ca3af',
    fontWeight: 500,
  },
  tableActions: {
    display: 'flex',
    gap: '8px',
  },
  tableBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 14px',
    background: 'rgba(93,71,250,0.12)',
    border: '1px solid rgba(93,71,250,0.25)',
    borderRadius: '8px',
    color: '#a78bfa',
    cursor: 'pointer',
    fontSize: '0.82em',
    fontWeight: 500,
  },
  tableBtnSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 14px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    color: '#9ca3af',
    cursor: 'pointer',
    fontSize: '0.82em',
    fontWeight: 500,
  },
};
