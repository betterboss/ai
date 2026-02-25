'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

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
    if (!apiKey) return;

    setGenerating(true);
    try {
      const res = await fetch('/api/quote/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimate, items, apiKey }),
      });
      const data = await res.json();
      setCoverLetter(data.coverLetter || '');
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => window.print();

  if (loading) {
    return <div style={styles.page}><p style={styles.loading}>Loading quote...</p></div>;
  }

  if (!estimate) {
    return <div style={styles.page}><p style={styles.loading}>Estimate not found</p></div>;
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
    <div style={styles.page}>
      {/* Print-hidden controls */}
      <div style={styles.controls} className="no-print">
        <a href={`/estimate/${estimateId}`} style={styles.backBtn}>Back to Editor</a>
        <div style={styles.controlActions}>
          <button
            onClick={generateCoverLetter}
            disabled={generating}
            style={styles.aiBtn}
          >
            {generating ? 'Generating...' : 'AI Cover Letter'}
          </button>
          <button onClick={handlePrint} style={styles.printBtn}>
            Print / PDF
          </button>
        </div>
      </div>

      {/* Quote Document */}
      <div style={styles.document}>
        {/* Company Header */}
        <div style={styles.companyHeader}>
          <div>
            <h1 style={styles.companyName}>Better Boss</h1>
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
                      <td style={{ ...styles.td, textAlign: 'right' }}>
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

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0f1419',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  loading: {
    color: '#8899a6',
    textAlign: 'center',
    padding: '60px',
  },
  controls: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    background: '#1a2332',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  backBtn: {
    color: '#7a64ff',
    textDecoration: 'none',
    fontSize: '0.9em',
  },
  controlActions: {
    display: 'flex',
    gap: '8px',
  },
  aiBtn: {
    padding: '8px 16px',
    background: 'rgba(93,71,250,0.15)',
    border: '1px solid rgba(93,71,250,0.3)',
    borderRadius: '8px',
    color: '#7a64ff',
    cursor: 'pointer',
    fontSize: '0.85em',
  },
  printBtn: {
    padding: '8px 16px',
    background: 'linear-gradient(135deg, #5d47fa, #7a64ff)',
    borderRadius: '8px',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.85em',
    fontWeight: 600,
  },
  document: {
    maxWidth: '800px',
    margin: '24px auto',
    background: '#fff',
    borderRadius: '12px',
    padding: '48px',
    color: '#1a1a1a',
  },
  companyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  companyName: {
    fontSize: '1.8em',
    fontWeight: 700,
    margin: 0,
    color: '#1a1a1a',
  },
  companyTagline: {
    color: '#666',
    margin: '4px 0 0',
  },
  quoteLabel: {
    textAlign: 'right',
  },
  quoteLabelText: {
    fontSize: '1.4em',
    fontWeight: 700,
    color: '#5d47fa',
    letterSpacing: '2px',
  },
  quoteDate: {
    color: '#666',
    fontSize: '0.9em',
    marginTop: '4px',
  },
  divider: {
    height: '3px',
    background: 'linear-gradient(135deg, #5d47fa, #7a64ff)',
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
    padding: '20px',
    background: '#f8f9fa',
    borderRadius: '8px',
    borderLeft: '3px solid #5d47fa',
  },
  coverParagraph: {
    color: '#333',
    lineHeight: 1.7,
    margin: '0 0 12px',
  },
  categorySection: {
    marginBottom: '24px',
  },
  categoryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 12px',
    background: '#f0f0f5',
    borderRadius: '6px',
    fontWeight: 600,
    fontSize: '0.95em',
    marginBottom: '8px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '8px 12px',
    textAlign: 'left',
    fontSize: '0.75em',
    color: '#999',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: '1px solid #eee',
  },
  td: {
    padding: '8px 12px',
    fontSize: '0.9em',
    borderBottom: '1px solid #f5f5f5',
    color: '#333',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 12px',
    marginTop: '24px',
    borderTop: '3px solid #1a1a1a',
  },
  totalLabel: {
    fontSize: '1.1em',
    fontWeight: 700,
    letterSpacing: '1px',
  },
  totalValue: {
    fontSize: '1.5em',
    fontWeight: 700,
    color: '#5d47fa',
  },
  terms: {
    marginTop: '40px',
    padding: '20px',
    background: '#f8f9fa',
    borderRadius: '8px',
  },
  termsTitle: {
    fontSize: '0.85em',
    fontWeight: 700,
    color: '#666',
    margin: '0 0 8px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  termsList: {
    margin: 0,
    paddingLeft: '20px',
    color: '#666',
    fontSize: '0.85em',
    lineHeight: 1.8,
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
    fontSize: '0.8em',
    color: '#999',
  },
};
