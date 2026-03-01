'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import PageShell from '../../../components/PageShell';

export default function QuotePage() {
  const params = useParams();
  const estimateId = params.id;

  const [estimate, setEstimate] = useState(null);
  const [items, setItems] = useState([]);
  const [coverLetter, setCoverLetter] = useState('');
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEstimate();
  }, [estimateId]);

  const loadEstimate = async () => {
    try {
      const res = await fetch(`/api/estimate/${estimateId}`);
      const data = await res.json();
      setEstimate(data.estimate);
      setItems(data.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const generateCoverLetter = async () => {
    const apiKey = localStorage.getItem('mrBetterBoss_apiKey');
    if (!apiKey) {
      alert('Add your Anthropic API key in the Estimate Editor settings first.');
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch('/api/quote/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimate, items, apiKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCoverLetter(data.coverLetter || '');
    } catch (err) {
      alert(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <PageShell>
        <div style={styles.loadingWrap}>
          <div style={styles.spinner} />
          <p style={{ color: '#6b7280' }}>Loading quote...</p>
        </div>
      </PageShell>
    );
  }

  if (!estimate) {
    return (
      <PageShell>
        <div style={styles.loadingWrap}>
          <p style={{ color: '#ef4444' }}>Estimate not found</p>
          <a href="/estimate" style={styles.backBtn}>Back to Estimates</a>
        </div>
      </PageShell>
    );
  }

  // Group items by category
  const grouped = {};
  items.forEach(item => {
    const cat = item.category || 'General';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });

  const totalPrice = items.reduce((s, i) => s + (parseFloat(i.total_price) || 0), 0);

  return (
    <PageShell>

      {/* Print-hidden controls */}
      <div style={styles.controls} className="no-print">
        <a href={`/estimate/${estimateId}`} style={styles.backBtn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Editor
        </a>
        <div style={styles.controlActions}>
          <button
            onClick={generateCoverLetter}
            disabled={generating}
            style={styles.aiBtn}
          >
            {generating ? (
              <><div style={styles.btnSpinner} /> Generating...</>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                AI Cover Letter
              </>
            )}
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

      {/* Quote Document */}
      <div style={styles.document}>
        {/* Company Header */}
        <div style={styles.companyHeader}>
          <div>
            <div style={styles.companyLogoRow}>
              <div style={styles.companyLogo}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              <h1 style={styles.companyName}>Better Boss</h1>
            </div>
            <p style={styles.companyTagline}>Construction Estimating</p>
          </div>
          <div style={styles.quoteLabel}>
            <div style={styles.quoteLabelText}>ESTIMATE</div>
            <div style={styles.quoteDate}>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
        </div>

        <div style={styles.divider} />

        {/* Client Info */}
        <div style={styles.infoRow}>
          <div>
            <div style={styles.infoLabel}>PREPARED FOR</div>
            <div style={styles.infoValue}>{estimate.client_name || 'Client'}</div>
            {estimate.client_email && <div style={styles.infoSub}>{estimate.client_email}</div>}
            {estimate.client_phone && <div style={styles.infoSub}>{estimate.client_phone}</div>}
          </div>
          <div>
            <div style={styles.infoLabel}>PROJECT</div>
            <div style={styles.infoValue}>{estimate.name}</div>
            {estimate.job_address && <div style={styles.infoSub}>{estimate.job_address}</div>}
          </div>
        </div>

        {/* Cover Letter */}
        {coverLetter && (
          <div style={styles.coverLetter}>
            {coverLetter.split('\n').map((line, i) => (
              <p key={i} style={styles.coverParagraph}>{line}</p>
            ))}
          </div>
        )}

        {/* Line Items by Category */}
        {Object.entries(grouped).map(([category, catItems]) => {
          const catTotal = catItems.reduce((s, i) => s + (parseFloat(i.total_price) || 0), 0);

          return (
            <div key={category} style={styles.categorySection}>
              <div style={styles.categoryHeader}>
                <span>{category}</span>
                <span>${catTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Description</th>
                    <th style={{ ...styles.th, textAlign: 'right', width: '80px' }}>Qty</th>
                    <th style={{ ...styles.th, width: '60px' }}>Unit</th>
                    <th style={{ ...styles.th, textAlign: 'right', width: '100px' }}>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {catItems.map(item => (
                    <tr key={item.id}>
                      <td style={styles.td}>{item.description}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{item.quantity}</td>
                      <td style={styles.td}>{item.unit}</td>
                      <td style={{ ...styles.td, textAlign: 'right', fontWeight: 500 }}>
                        ${parseFloat(item.total_price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}

        {/* Total */}
        <div style={styles.totalRow}>
          <span style={styles.totalLabel}>TOTAL</span>
          <span style={styles.totalValue}>
            ${totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>

        {/* Notes */}
        {estimate.notes && (
          <div style={styles.notesSection}>
            <h3 style={styles.notesTitle}>Notes</h3>
            <p style={styles.notesText}>{estimate.notes}</p>
          </div>
        )}

        {/* Terms */}
        <div style={styles.terms}>
          <h3 style={styles.termsTitle}>Terms & Conditions</h3>
          <ul style={styles.termsList}>
            <li>This estimate is valid for 30 days from the date above.</li>
            <li>A 50% deposit is required to begin work.</li>
            <li>Final payment is due upon project completion.</li>
            <li>Any changes to the scope of work may result in additional charges.</li>
            <li>All work is guaranteed for 1 year from completion date.</li>
          </ul>
        </div>

        {/* Signature */}
        <div style={styles.signatureRow}>
          <div style={styles.signatureBlock}>
            <div style={styles.signatureLine} />
            <div style={styles.signatureLabel}>Client Signature</div>
          </div>
          <div style={styles.signatureBlock}>
            <div style={styles.signatureLine} />
            <div style={styles.signatureLabel}>Date</div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

const styles = {
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
  controls: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 24px',
    background: 'rgba(255,255,255,0.025)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    maxWidth: '900px',
    margin: '0 auto',
  },
  backBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    color: '#a78bfa',
    textDecoration: 'none',
    fontSize: '0.88em',
    fontWeight: 500,
  },
  controlActions: {
    display: 'flex',
    gap: '8px',
  },
  aiBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: 'rgba(93,71,250,0.12)',
    border: '1px solid rgba(93,71,250,0.25)',
    borderRadius: '8px',
    color: '#a78bfa',
    cursor: 'pointer',
    fontSize: '0.85em',
    fontWeight: 500,
  },
  printBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: 'linear-gradient(135deg, #5d47fa, #7c3aed)',
    borderRadius: '8px',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.85em',
    fontWeight: 600,
  },
  btnSpinner: {
    width: '12px',
    height: '12px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: 'currentColor',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  document: {
    maxWidth: '800px',
    margin: '24px auto',
    background: '#fff',
    borderRadius: '12px',
    padding: '48px',
    color: '#1a1a1a',
    boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
  },
  companyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  companyLogoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  companyLogo: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #5d47fa, #7c3aed)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
  },
  companyName: {
    fontSize: '1.6em',
    fontWeight: 800,
    margin: 0,
    color: '#1a1a1a',
    letterSpacing: '-0.02em',
  },
  companyTagline: {
    color: '#888',
    margin: '4px 0 0',
    fontSize: '0.88em',
  },
  quoteLabel: {
    textAlign: 'right',
  },
  quoteLabelText: {
    fontSize: '1.3em',
    fontWeight: 800,
    color: '#5d47fa',
    letterSpacing: '3px',
  },
  quoteDate: {
    color: '#888',
    fontSize: '0.88em',
    marginTop: '4px',
  },
  divider: {
    height: '3px',
    background: 'linear-gradient(135deg, #5d47fa, #7c3aed)',
    margin: '20px 0',
    borderRadius: '2px',
  },
  infoRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '40px',
    margin: '24px 0',
  },
  infoLabel: {
    fontSize: '0.7em',
    fontWeight: 700,
    color: '#999',
    letterSpacing: '1px',
    marginBottom: '4px',
  },
  infoValue: {
    fontSize: '1.1em',
    fontWeight: 600,
    color: '#1a1a1a',
  },
  infoSub: {
    color: '#666',
    fontSize: '0.9em',
    marginTop: '2px',
  },
  coverLetter: {
    margin: '24px 0',
    padding: '20px 24px',
    background: '#f8f9fb',
    borderRadius: '10px',
    borderLeft: '3px solid #5d47fa',
  },
  coverParagraph: {
    color: '#333',
    lineHeight: 1.7,
    margin: '0 0 12px',
    fontSize: '0.95em',
  },
  categorySection: {
    marginBottom: '24px',
  },
  categoryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '10px 14px',
    background: '#f4f4f8',
    borderRadius: '8px',
    fontWeight: 700,
    fontSize: '0.92em',
    marginBottom: '8px',
    color: '#333',
    textTransform: 'capitalize',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '8px 14px',
    textAlign: 'left',
    fontSize: '0.72em',
    color: '#999',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: '1px solid #eee',
  },
  td: {
    padding: '10px 14px',
    fontSize: '0.9em',
    borderBottom: '1px solid #f5f5f5',
    color: '#333',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '18px 14px',
    marginTop: '24px',
    borderTop: '3px solid #1a1a1a',
    borderBottom: '1px solid #eee',
  },
  totalLabel: {
    fontSize: '1.1em',
    fontWeight: 800,
    letterSpacing: '2px',
    color: '#1a1a1a',
  },
  totalValue: {
    fontSize: '1.6em',
    fontWeight: 800,
    color: '#5d47fa',
  },
  notesSection: {
    marginTop: '24px',
    padding: '16px 20px',
    background: '#fefce8',
    borderRadius: '8px',
    borderLeft: '3px solid #f59e0b',
  },
  notesTitle: {
    fontSize: '0.78em',
    fontWeight: 700,
    color: '#92400e',
    margin: '0 0 6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  notesText: {
    color: '#78350f',
    fontSize: '0.88em',
    lineHeight: 1.6,
    margin: 0,
  },
  terms: {
    marginTop: '32px',
    padding: '20px 24px',
    background: '#f8f9fb',
    borderRadius: '10px',
  },
  termsTitle: {
    fontSize: '0.78em',
    fontWeight: 700,
    color: '#888',
    margin: '0 0 10px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  termsList: {
    margin: 0,
    paddingLeft: '20px',
    color: '#666',
    fontSize: '0.85em',
    lineHeight: 2,
  },
  signatureRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '40px',
    marginTop: '48px',
  },
  signatureBlock: {
    paddingTop: '60px',
  },
  signatureLine: {
    borderBottom: '1px solid #ccc',
    marginBottom: '8px',
  },
  signatureLabel: {
    fontSize: '0.78em',
    color: '#999',
    fontWeight: 500,
  },
};
