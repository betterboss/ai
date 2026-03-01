'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PageShell from '../../components/PageShell';

export default function NewEstimate() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    client_name: '',
    client_email: '',
    client_phone: '',
    job_address: '',
    notes: '',
  });
  const [scopeMode, setScopeMode] = useState(false);
  const [scope, setScope] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Estimate name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (scopeMode && scope.trim()) {
        const apiKey = localStorage.getItem('mrBetterBoss_apiKey') || '';
        if (apiKey) {
          const scopeRes = await fetch('/api/estimate/from-scope', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scope, apiKey }),
          });
          const scopeData = await scopeRes.json();

          if (scopeData.items?.length > 0) {
            await fetch(`/api/estimate/${data.estimate.id}/items`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ items: scopeData.items }),
            });
          }
        }
      }

      router.push(`/estimate/${data.estimate.id}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <PageShell>
      <div style={styles.container}>
        <div style={styles.header}>
          <a href="/estimate" style={styles.backLink}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Estimates
          </a>
          <h1 style={styles.title}>New Estimate</h1>
          <p style={styles.subtitle}>Fill in the details to create a new construction estimate.</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Job Details Card */}
          <div style={styles.card}>
            <div style={styles.cardTitleRow}>
              <div style={styles.cardIconBox}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <h2 style={styles.cardTitle}>Job Details</h2>
            </div>
            <div style={styles.grid}>
              <div style={styles.field}>
                <label style={styles.label}>Estimate Name <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  style={styles.input}
                  placeholder="e.g., Kitchen Remodel - Smith"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Client Name</label>
                <input
                  style={styles.input}
                  placeholder="John Smith"
                  value={form.client_name}
                  onChange={e => setForm({ ...form, client_name: e.target.value })}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Client Email</label>
                <input
                  style={styles.input}
                  type="email"
                  placeholder="john@example.com"
                  value={form.client_email}
                  onChange={e => setForm({ ...form, client_email: e.target.value })}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Client Phone</label>
                <input
                  style={styles.input}
                  placeholder="(555) 123-4567"
                  value={form.client_phone}
                  onChange={e => setForm({ ...form, client_phone: e.target.value })}
                />
              </div>
            </div>
            <div style={{ ...styles.field, marginTop: '16px' }}>
              <label style={styles.label}>Job Address</label>
              <input
                style={styles.input}
                placeholder="123 Main St, Denver, CO 80202"
                value={form.job_address}
                onChange={e => setForm({ ...form, job_address: e.target.value })}
              />
            </div>
            <div style={{ ...styles.field, marginTop: '16px' }}>
              <label style={styles.label}>Notes</label>
              <textarea
                style={{ ...styles.input, minHeight: '80px', resize: 'vertical' }}
                placeholder="Any additional notes..."
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          {/* AI Quick Start Card */}
          <div style={styles.card}>
            <div style={styles.cardTitleRow}>
              <div style={{ ...styles.cardIconBox, background: 'linear-gradient(135deg, #5d47fa, #7c3aed)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              <h2 style={styles.cardTitle}>Quick Start</h2>
              <span style={styles.aiBadge}>AI</span>
            </div>
            <p style={styles.hint}>
              Choose how to populate your estimate. You can always upload blueprints or add items manually later.
            </p>
            <div style={styles.modeRow}>
              <button
                type="button"
                onClick={() => setScopeMode(false)}
                style={{ ...styles.modeBtn, ...(!scopeMode ? styles.modeBtnActive : {}) }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                Start Blank
              </button>
              <button
                type="button"
                onClick={() => setScopeMode(true)}
                style={{ ...styles.modeBtn, ...(scopeMode ? styles.modeBtnActive : {}) }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                Paste Scope of Work
              </button>
            </div>

            {scopeMode && (
              <div style={{ ...styles.field, marginTop: '16px' }}>
                <label style={styles.label}>Scope of Work</label>
                <textarea
                  style={{ ...styles.input, minHeight: '160px', resize: 'vertical' }}
                  placeholder="Paste your scope of work here...&#10;&#10;e.g., 'Remodel master bathroom. Remove existing tub, install walk-in shower with frameless glass door. New vanity with double sinks...'"
                  value={scope}
                  onChange={e => setScope(e.target.value)}
                />
                <p style={styles.scopeHint}>
                  AI will analyze this scope and generate line items with categories, quantities, and units automatically.
                </p>
              </div>
            )}
          </div>

          {error && (
            <div style={styles.error}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {error}
            </div>
          )}

          <div style={styles.actions}>
            <a href="/estimate" style={styles.cancelBtn}>Cancel</a>
            <button type="submit" disabled={loading} style={{
              ...styles.submitBtn,
              opacity: loading ? 0.7 : 1,
            }}>
              {loading && <div style={styles.btnSpinner} />}
              {loading ? 'Creating...' : 'Create Estimate'}
            </button>
          </div>
        </form>
      </div>

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </PageShell>
  );
}

const styles = {
  container: {
    maxWidth: '680px',
    padding: '28px 32px 60px',
  },
  header: {
    padding: '32px 0 24px',
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    color: '#6b7280',
    textDecoration: 'none',
    fontSize: '0.85em',
    fontWeight: 500,
    transition: 'color 0.15s',
  },
  title: {
    fontSize: '1.8em',
    fontWeight: 800,
    margin: '12px 0 0',
    color: '#fff',
    letterSpacing: '-0.03em',
  },
  subtitle: {
    color: '#6b7280',
    margin: '6px 0 0',
    fontSize: '0.9em',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  card: {
    background: 'rgba(255,255,255,0.025)',
    borderRadius: '14px',
    padding: '24px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  cardTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '20px',
  },
  cardIconBox: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#9ca3af',
  },
  cardTitle: {
    fontSize: '1.05em',
    fontWeight: 600,
    margin: 0,
    color: '#f3f4f6',
  },
  aiBadge: {
    padding: '2px 8px',
    background: 'linear-gradient(135deg, #5d47fa, #7c3aed)',
    borderRadius: '5px',
    fontSize: '0.68em',
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '0.5px',
  },
  hint: {
    color: '#6b7280',
    fontSize: '0.85em',
    margin: '0 0 16px',
    lineHeight: 1.5,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '0.82em',
    fontWeight: 500,
    color: '#9ca3af',
  },
  input: {
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    color: '#f3f4f6',
    fontSize: '0.92em',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s',
    outline: 'none',
  },
  modeRow: {
    display: 'flex',
    gap: '8px',
  },
  modeBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 16px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    color: '#6b7280',
    cursor: 'pointer',
    fontSize: '0.88em',
    fontWeight: 500,
    transition: 'all 0.15s',
  },
  modeBtnActive: {
    background: 'rgba(93,71,250,0.1)',
    borderColor: 'rgba(93,71,250,0.35)',
    color: '#a78bfa',
  },
  scopeHint: {
    color: '#6b7280',
    fontSize: '0.78em',
    marginTop: '6px',
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: '10px',
    color: '#ef4444',
    fontSize: '0.88em',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    paddingTop: '8px',
  },
  cancelBtn: {
    padding: '10px 20px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    color: '#6b7280',
    textDecoration: 'none',
    fontSize: '0.9em',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
  },
  submitBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 24px',
    background: 'linear-gradient(135deg, #5d47fa 0%, #7c3aed 100%)',
    borderRadius: '10px',
    color: '#fff',
    fontWeight: 600,
    fontSize: '0.9em',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(93,71,250,0.3)',
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
};
