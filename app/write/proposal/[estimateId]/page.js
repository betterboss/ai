'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Nav from '../../../components/Nav';

export default function ProposalEditorPage() {
  const params = useParams();
  const estimateId = params.estimateId;
  const printRef = useRef(null);

  const [estimate, setEstimate] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [apiKey, setApiKey] = useState('');

  // Proposal settings
  const [tone, setTone] = useState('professional');
  const [includeTerms, setIncludeTerms] = useState(true);

  // Generated content
  const [proposalHtml, setProposalHtml] = useState('');
  const [proposalText, setProposalText] = useState('');
  const [usage, setUsage] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setApiKey(localStorage.getItem('mrBetterBoss_apiKey') || '');
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
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApiKeyChange = (val) => {
    setApiKey(val);
    localStorage.setItem('mrBetterBoss_apiKey', val);
  };

  const generateProposal = async () => {
    if (!apiKey) {
      setError('Add your Anthropic API key to generate proposals.');
      return;
    }
    setGenerating(true);
    setError('');
    setProposalHtml('');
    setProposalText('');
    try {
      const res = await fetch('/api/write/proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estimateId,
          tone,
          includeTerms,
          apiKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProposalHtml(data.proposal_html || '');
      setProposalText(data.proposal_text || '');
      setUsage(data.usage || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Proposal - ${estimate?.name || 'Document'}</title>
          <style>
            body { margin: 0; padding: 40px; font-family: 'Inter', -apple-system, sans-serif; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>${proposalHtml}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  const downloadHtml = () => {
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Proposal - ${estimate?.name || 'Document'}</title><style>body{margin:0;padding:40px;font-family:'Inter',-apple-system,sans-serif;}</style></head><body>${proposalHtml}</body></html>`;
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proposal-${estimate?.name?.replace(/\s+/g, '-').toLowerCase() || 'document'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyText = () => {
    navigator.clipboard.writeText(proposalText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  const totalPrice = parseFloat(estimate.total_price || 0);
  const totalCost = parseFloat(estimate.total_cost || 0);
  const margin = parseFloat(estimate.margin_pct || 0);

  // Group items by category for the sidebar
  const grouped = {};
  items.forEach(item => {
    const cat = item.category || 'General';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });

  return (
    <div style={styles.page}>
      <Nav />
      <div style={styles.container}>
        {/* Top bar */}
        <div style={styles.topBar}>
          <a href={`/estimate/${estimateId}`} style={styles.backLink}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Estimate
          </a>
          <a href="/write" style={styles.backLink}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Writing Tools
          </a>
        </div>

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <h1 style={styles.title}>Proposal Builder</h1>
            <p style={styles.subtitle}>{estimate.name}</p>
          </div>
          <div style={styles.headerRight}>
            <div style={styles.priceBlock}>
              <div style={styles.priceLabel}>Estimate Total</div>
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

        <div style={styles.layout}>
          {/* Sidebar */}
          <div style={styles.sidebar}>
            {/* Proposal Settings */}
            <div style={styles.sideCard}>
              <div style={styles.sideHeader}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                <h3 style={styles.sideTitle}>Settings</h3>
              </div>

              <div style={styles.fieldGroup}>
                <div style={styles.field}>
                  <label style={styles.fieldLabel}>Tone</label>
                  <div style={styles.toneGroup}>
                    {[
                      { value: 'professional', label: 'Professional', desc: 'Formal & polished' },
                      { value: 'friendly', label: 'Friendly', desc: 'Warm & approachable' },
                      { value: 'urgent', label: 'Urgent', desc: 'Time-sensitive' },
                    ].map(t => (
                      <button
                        key={t.value}
                        onClick={() => setTone(t.value)}
                        style={{
                          ...styles.toneBtn,
                          ...(tone === t.value ? styles.toneBtnActive : {}),
                        }}
                      >
                        <span style={styles.toneBtnLabel}>{t.label}</span>
                        <span style={styles.toneBtnDesc}>{t.desc}</span>
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
            </div>

            {/* Estimate Summary */}
            <div style={styles.sideCard}>
              <div style={styles.sideHeader}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <h3 style={styles.sideTitle}>Estimate Details</h3>
              </div>
              <div style={styles.detailsList}>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Client</span>
                  <span style={styles.detailValue}>{estimate.client_name || 'Not set'}</span>
                </div>
                {estimate.client_email && (
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Email</span>
                    <span style={styles.detailValue}>{estimate.client_email}</span>
                  </div>
                )}
                {estimate.job_address && (
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Address</span>
                    <span style={styles.detailValue}>{estimate.job_address}</span>
                  </div>
                )}
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Items</span>
                  <span style={styles.detailValue}>{items.length} line items</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Categories</span>
                  <span style={styles.detailValue}>{Object.keys(grouped).length}</span>
                </div>
              </div>

              {/* Category breakdown */}
              <div style={styles.categoryList}>
                {Object.entries(grouped).map(([cat, catItems]) => {
                  const catTotal = catItems.reduce((s, i) => s + (parseFloat(i.total_price) || 0), 0);
                  return (
                    <div key={cat} style={styles.categoryRow}>
                      <span style={styles.categoryName}>{cat}</span>
                      <span style={styles.categoryTotal}>${catTotal.toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* API Key */}
            <div style={styles.sideCard}>
              <div style={styles.sideHeader}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <h3 style={styles.sideTitle}>API Key</h3>
              </div>
              <input
                style={styles.keyInput}
                type="password"
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder="sk-ant-..."
              />
            </div>
          </div>

          {/* Main Content Area */}
          <div style={styles.main}>
            {proposalHtml ? (
              <>
                {/* Action bar */}
                <div style={styles.actionBar}>
                  <div style={styles.actionLeft}>
                    <h2 style={styles.previewTitle}>Proposal Preview</h2>
                    {usage && (
                      <span style={styles.tokenBadge}>
                        {usage.input_tokens + usage.output_tokens} tokens
                      </span>
                    )}
                  </div>
                  <div style={styles.actionRight}>
                    <button onClick={copyText} style={styles.actionBtn}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                      {copied ? 'Copied!' : 'Copy Text'}
                    </button>
                    <button onClick={downloadHtml} style={styles.actionBtn}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                      </svg>
                      Download
                    </button>
                    <button onClick={handlePrint} style={styles.printBtn}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 6 2 18 2 18 9" />
                        <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                        <rect x="6" y="14" width="12" height="8" />
                      </svg>
                      Print / PDF
                    </button>
                  </div>
                </div>

                {/* Proposal Preview */}
                <div ref={printRef} style={styles.proposalPreview}>
                  <div dangerouslySetInnerHTML={{ __html: proposalHtml }} />
                </div>
              </>
            ) : (
              <div style={styles.emptyState}>
                {generating ? (
                  <>
                    <div style={styles.spinner} />
                    <h3 style={styles.emptyTitle}>Generating your proposal...</h3>
                    <p style={styles.emptyText}>AI is crafting a professional proposal from your estimate. This may take 10-20 seconds.</p>
                  </>
                ) : (
                  <>
                    <div style={styles.emptyIconWrap}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 style={styles.emptyTitle}>Ready to build your proposal</h3>
                    <p style={styles.emptyText}>
                      Choose your tone and settings, then click Generate to create a professional proposal from this estimate.
                    </p>
                    <div style={styles.emptyStats}>
                      <div style={styles.emptyStat}>
                        <span style={styles.emptyStatValue}>{items.length}</span>
                        <span style={styles.emptyStatLabel}>Line Items</span>
                      </div>
                      <div style={styles.emptyStat}>
                        <span style={styles.emptyStatValue}>{Object.keys(grouped).length}</span>
                        <span style={styles.emptyStatLabel}>Categories</span>
                      </div>
                      <div style={styles.emptyStat}>
                        <span style={{ ...styles.emptyStatValue, color: '#22c55e' }}>
                          ${totalPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                        <span style={styles.emptyStatLabel}>Total Price</span>
                      </div>
                    </div>
                  </>
                )}
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
    gap: '20px',
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
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '8px 0 24px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    marginBottom: '24px',
  },
  headerLeft: {},
  title: {
    fontSize: '1.6em',
    fontWeight: 800,
    margin: 0,
    color: '#fff',
    letterSpacing: '-0.02em',
  },
  subtitle: {
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
    gridTemplateColumns: '300px 1fr',
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
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  field: {},
  fieldLabel: {
    display: 'block',
    fontSize: '0.75em',
    color: '#6b7280',
    marginBottom: '6px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  toneGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  toneBtn: {
    display: 'flex',
    flexDirection: 'column',
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s',
    fontFamily: 'inherit',
  },
  toneBtnActive: {
    background: 'rgba(93,71,250,0.1)',
    borderColor: 'rgba(93,71,250,0.3)',
  },
  toneBtnLabel: {
    fontSize: '0.88em',
    fontWeight: 600,
    color: '#e5e7eb',
  },
  toneBtnDesc: {
    fontSize: '0.75em',
    color: '#6b7280',
    marginTop: '1px',
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
    fontSize: '0.88em',
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
    fontSize: '0.92em',
    fontFamily: 'inherit',
    boxShadow: '0 4px 16px rgba(93,71,250,0.35)',
    transition: 'all 0.2s',
  },
  btnSpinner: {
    width: '14px',
    height: '14px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  detailsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    paddingBottom: '12px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    marginBottom: '12px',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.85em',
  },
  detailLabel: {
    color: '#6b7280',
    fontWeight: 500,
  },
  detailValue: {
    color: '#d1d5db',
    textAlign: 'right',
    maxWidth: '160px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  categoryList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  categoryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.82em',
    padding: '4px 0',
  },
  categoryName: {
    color: '#9ca3af',
    textTransform: 'capitalize',
  },
  categoryTotal: {
    color: '#a78bfa',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
  },
  keyInput: {
    width: '100%',
    padding: '8px 10px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '6px',
    color: '#e5e7eb',
    fontSize: '0.85em',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  },
  main: {
    minWidth: 0,
  },
  actionBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  actionLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  previewTitle: {
    fontSize: '1.05em',
    fontWeight: 600,
    color: '#f3f4f6',
    margin: 0,
  },
  tokenBadge: {
    padding: '3px 8px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '4px',
    color: '#6b7280',
    fontSize: '0.72em',
    fontWeight: 500,
  },
  actionRight: {
    display: 'flex',
    gap: '6px',
  },
  actionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    color: '#9ca3af',
    cursor: 'pointer',
    fontSize: '0.82em',
    fontWeight: 500,
    fontFamily: 'inherit',
    transition: 'all 0.15s',
  },
  printBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 14px',
    background: 'linear-gradient(135deg, #5d47fa, #7c3aed)',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.82em',
    fontWeight: 600,
    fontFamily: 'inherit',
  },
  proposalPreview: {
    background: '#fff',
    borderRadius: '12px',
    padding: '48px',
    boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
    overflow: 'auto',
    maxHeight: '80vh',
    color: '#1a1a1a',
  },
  emptyState: {
    textAlign: 'center',
    padding: '80px 24px',
    background: 'rgba(255,255,255,0.025)',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  emptyIconWrap: {
    width: '80px',
    height: '80px',
    borderRadius: '20px',
    background: 'rgba(255,255,255,0.03)',
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
    maxWidth: '400px',
    marginLeft: 'auto',
    marginRight: 'auto',
    lineHeight: 1.5,
  },
  emptyStats: {
    display: 'flex',
    justifyContent: 'center',
    gap: '32px',
  },
  emptyStat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  emptyStatValue: {
    fontSize: '1.3em',
    fontWeight: 700,
    color: '#a78bfa',
    fontVariantNumeric: 'tabular-nums',
  },
  emptyStatLabel: {
    fontSize: '0.72em',
    color: '#6b7280',
    marginTop: '2px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
};
