'use client';

import { useState, useEffect } from 'react';
import Nav from '../../components/Nav';

const REASON_OPTIONS = [
  { value: 'client_request', label: 'Client Request' },
  { value: 'unforeseen_conditions', label: 'Unforeseen Conditions' },
  { value: 'design_change', label: 'Design Change' },
  { value: 'material_substitution', label: 'Material Substitution' },
];

export default function NewChangeOrderPage() {
  const [estimates, setEstimates] = useState([]);
  const [selectedEstimate, setSelectedEstimate] = useState('');
  const [description, setDescription] = useState('');
  const [reason, setReason] = useState('client_request');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadEstimates();
  }, []);

  const loadEstimates = async () => {
    try {
      const userId = localStorage.getItem('bb_user_id') || '';
      const params = userId ? `?userId=${userId}` : '';
      const res = await fetch(`/api/estimate${params}`);
      if (res.ok) {
        const data = await res.json();
        setEstimates(data.estimates || []);
      }
    } catch (err) {
      console.error('Failed to load estimates:', err);
    }
  };

  const generateWithAI = async () => {
    const apiKey = localStorage.getItem('bb_api_key');
    if (!apiKey) {
      setError('No API key found. Please configure your Anthropic API key in Setup.');
      return;
    }
    if (!selectedEstimate) {
      setError('Please select an estimate first.');
      return;
    }
    if (!description.trim()) {
      setError('Please provide a description of the change.');
      return;
    }

    setGenerating(true);
    setError('');
    setPreview(null);

    try {
      const res = await fetch('/api/write/change-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estimateId: selectedEstimate,
          description,
          reason,
          apiKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to generate change order');
        return;
      }

      setPreview(data);
    } catch (err) {
      setError('Generation failed: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const saveChangeOrder = async () => {
    const userId = localStorage.getItem('bb_user_id');
    if (!userId) {
      setError('No user ID found. Please log in.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        userId,
        estimateId: selectedEstimate || null,
        description: preview?.description || description,
        reason,
        originalScope: preview?.originalScope || '',
        newScope: preview?.newScope || '',
        costImpact: preview?.costImpact || 0,
        priceImpact: preview?.priceImpact || 0,
        customerExplanation: preview?.customerExplanation || '',
      };

      const res = await fetch('/api/change-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save change order');
        return;
      }

      window.location.href = '/change-orders';
    } catch (err) {
      setError('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const selectedEst = estimates.find((e) => e.id === selectedEstimate);

  return (
    <div style={styles.page}>
      <Nav />
      <div style={styles.container}>
        <div style={styles.header}>
          <a href="/change-orders" style={styles.backLink}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Change Orders
          </a>
          <h1 style={styles.title}>New Change Order</h1>
          <p style={styles.subtitle}>Create a change order with AI assistance</p>
        </div>

        {error && (
          <div style={styles.errorBanner}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {error}
          </div>
        )}

        {/* Form */}
        <div style={styles.formCard}>
          <h2 style={styles.sectionTitle}>Change Details</h2>

          <div style={styles.formGroup}>
            <label style={styles.label}>Estimate</label>
            <select
              value={selectedEstimate}
              onChange={(e) => setSelectedEstimate(e.target.value)}
              style={styles.select}
            >
              <option value="">Select an estimate...</option>
              {estimates.map((est) => (
                <option key={est.id} value={est.id}>
                  {est.name} {est.client_name ? `- ${est.client_name}` : ''} ($
                  {(parseFloat(est.total_price) || 0).toLocaleString()})
                </option>
              ))}
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Description of Change</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what needs to change (e.g., 'Client wants to upgrade all flooring from vinyl to hardwood in the main living areas')"
              style={styles.textarea}
              rows={4}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={styles.select}
            >
              {REASON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={generateWithAI}
            disabled={generating}
            style={{
              ...styles.generateBtn,
              opacity: generating ? 0.7 : 1,
            }}
          >
            {generating ? (
              <>
                <div style={styles.btnSpinner} />
                Generating with AI...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
                Generate with AI
              </>
            )}
          </button>
        </div>

        {/* Preview */}
        {preview && (
          <div style={styles.previewCard}>
            <h2 style={styles.sectionTitle}>Generated Change Order</h2>

            <div style={styles.previewGrid}>
              <div style={styles.previewSection}>
                <h3 style={styles.previewLabel}>Description</h3>
                <p style={styles.previewText}>{preview.description || description}</p>
              </div>

              {preview.originalScope && (
                <div style={styles.previewSection}>
                  <h3 style={styles.previewLabel}>Original Scope</h3>
                  <p style={styles.previewText}>{preview.originalScope}</p>
                </div>
              )}

              {preview.newScope && (
                <div style={styles.previewSection}>
                  <h3 style={styles.previewLabel}>New Scope</h3>
                  <p style={styles.previewText}>{preview.newScope}</p>
                </div>
              )}

              {preview.customerExplanation && (
                <div style={styles.previewSection}>
                  <h3 style={styles.previewLabel}>Customer Explanation</h3>
                  <p style={styles.previewText}>{preview.customerExplanation}</p>
                </div>
              )}
            </div>

            {/* Cost impact summary */}
            <div style={styles.impactSummary}>
              <h3 style={styles.impactTitle}>Cost Impact Summary</h3>
              <div style={styles.impactRow}>
                <div style={styles.impactItem}>
                  <div style={styles.impactItemLabel}>Cost Impact</div>
                  <div
                    style={{
                      ...styles.impactItemValue,
                      color: (preview.costImpact || 0) > 0 ? '#ef4444' : (preview.costImpact || 0) < 0 ? '#22c55e' : '#6b7280',
                    }}
                  >
                    {(preview.costImpact || 0) >= 0 ? '+' : ''}$
                    {Math.abs(preview.costImpact || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div style={styles.impactItem}>
                  <div style={styles.impactItemLabel}>Price Impact</div>
                  <div
                    style={{
                      ...styles.impactItemValue,
                      color: (preview.priceImpact || 0) > 0 ? '#22c55e' : (preview.priceImpact || 0) < 0 ? '#ef4444' : '#6b7280',
                    }}
                  >
                    {(preview.priceImpact || 0) >= 0 ? '+' : ''}$
                    {Math.abs(preview.priceImpact || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>

            {/* Added/Removed items if present */}
            {preview.addedItems && preview.addedItems.length > 0 && (
              <div style={styles.itemsSection}>
                <h3 style={styles.itemsSectionTitle}>Added Items</h3>
                {preview.addedItems.map((item, i) => (
                  <div key={i} style={styles.itemRow}>
                    <span style={styles.itemDesc}>{item.description}</span>
                    <span style={styles.itemAmount}>
                      +${(parseFloat(item.total_price || item.price || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {preview.removedItems && preview.removedItems.length > 0 && (
              <div style={styles.itemsSection}>
                <h3 style={{ ...styles.itemsSectionTitle, color: '#ef4444' }}>Removed Items</h3>
                {preview.removedItems.map((item, i) => (
                  <div key={i} style={styles.itemRow}>
                    <span style={styles.itemDesc}>{item.description}</span>
                    <span style={{ ...styles.itemAmount, color: '#ef4444' }}>
                      -${(parseFloat(item.total_price || item.price || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Document HTML preview */}
            {preview.documentHtml && (
              <div style={styles.previewSection}>
                <h3 style={styles.previewLabel}>Document Preview</h3>
                <div
                  style={styles.htmlPreview}
                  dangerouslySetInnerHTML={{ __html: preview.documentHtml }}
                />
              </div>
            )}

            <div style={styles.previewActions}>
              <button
                onClick={saveChangeOrder}
                disabled={saving}
                style={{
                  ...styles.saveBtn,
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Saving...' : 'Save Change Order'}
              </button>
              <button
                onClick={() => setPreview(null)}
                style={styles.discardBtn}
              >
                Discard
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
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
    maxWidth: '800px',
    margin: '0 auto',
    padding: '0 24px 60px',
  },
  header: {
    padding: '24px 0 20px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    marginBottom: '24px',
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    color: '#6b7280',
    textDecoration: 'none',
    fontSize: '0.85em',
    marginBottom: '12px',
  },
  title: {
    fontSize: '1.8em',
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
  formCard: {
    background: '#12131a',
    borderRadius: '14px',
    padding: '24px',
    border: '1px solid rgba(255,255,255,0.06)',
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '1.1em',
    fontWeight: 700,
    color: '#fff',
    margin: '0 0 20px',
  },
  formGroup: {
    marginBottom: '18px',
  },
  label: {
    display: 'block',
    fontSize: '0.85em',
    fontWeight: 600,
    color: '#9ca3af',
    marginBottom: '6px',
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
    appearance: 'none',
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
  },
  generateBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 28px',
    background: 'linear-gradient(135deg, #5d47fa 0%, #7c3aed 100%)',
    borderRadius: '10px',
    color: '#fff',
    fontWeight: 600,
    fontSize: '0.95em',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(93,71,250,0.35)',
    width: '100%',
    justifyContent: 'center',
    marginTop: '6px',
  },
  btnSpinner: {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  previewCard: {
    background: '#12131a',
    borderRadius: '14px',
    padding: '24px',
    border: '1px solid rgba(93,71,250,0.2)',
    marginBottom: '20px',
  },
  previewGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginBottom: '20px',
  },
  previewSection: {
    marginBottom: '12px',
  },
  previewLabel: {
    fontSize: '0.8em',
    fontWeight: 600,
    color: '#a78bfa',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  previewText: {
    color: '#d1d5db',
    fontSize: '0.92em',
    lineHeight: '1.6',
    margin: 0,
    whiteSpace: 'pre-wrap',
  },
  impactSummary: {
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '10px',
    padding: '16px',
    border: '1px solid rgba(255,255,255,0.06)',
    marginBottom: '20px',
  },
  impactTitle: {
    fontSize: '0.85em',
    fontWeight: 600,
    color: '#9ca3af',
    margin: '0 0 12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  impactRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  impactItem: {},
  impactItemLabel: {
    fontSize: '0.78em',
    color: '#6b7280',
    marginBottom: '4px',
  },
  impactItemValue: {
    fontSize: '1.3em',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
  },
  itemsSection: {
    marginBottom: '16px',
  },
  itemsSectionTitle: {
    fontSize: '0.85em',
    fontWeight: 600,
    color: '#22c55e',
    margin: '0 0 8px',
  },
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '6px',
    marginBottom: '4px',
  },
  itemDesc: {
    fontSize: '0.88em',
    color: '#d1d5db',
  },
  itemAmount: {
    fontSize: '0.88em',
    fontWeight: 600,
    color: '#22c55e',
    fontVariantNumeric: 'tabular-nums',
  },
  htmlPreview: {
    background: '#fff',
    borderRadius: '8px',
    padding: '20px',
    color: '#111',
    fontSize: '0.88em',
    maxHeight: '400px',
    overflow: 'auto',
  },
  previewActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '20px',
  },
  saveBtn: {
    flex: 1,
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #5d47fa 0%, #7c3aed 100%)',
    borderRadius: '10px',
    color: '#fff',
    fontWeight: 600,
    fontSize: '0.95em',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(93,71,250,0.35)',
  },
  discardBtn: {
    padding: '12px 24px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    color: '#6b7280',
    fontWeight: 500,
    fontSize: '0.95em',
    cursor: 'pointer',
  },
};
