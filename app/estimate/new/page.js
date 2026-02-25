'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '../../components/Nav';

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

      // If scope was provided, generate line items
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
    <div style={styles.page}>
      <Nav />
      <div style={styles.container}>
        <div style={styles.header}>
          <a href="/estimate" style={styles.backLink}>Estimates</a>
          <h1 style={styles.title}>New Estimate</h1>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Job Details</h2>
            <div style={styles.grid}>
              <div style={styles.field}>
                <label style={styles.label}>Estimate Name *</label>
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
                  placeholder="e.g., John Smith"
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
            <div style={styles.field}>
              <label style={styles.label}>Job Address</label>
              <input
                style={styles.input}
                placeholder="123 Main St, Denver, CO 80202"
                value={form.job_address}
                onChange={e => setForm({ ...form, job_address: e.target.value })}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Notes</label>
              <textarea
                style={{ ...styles.input, minHeight: '80px', resize: 'vertical' }}
                placeholder="Any additional notes..."
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          {/* AI Scope-to-Estimate */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
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
                Start Blank
              </button>
              <button
                type="button"
                onClick={() => setScopeMode(true)}
                style={{ ...styles.modeBtn, ...(scopeMode ? styles.modeBtnActive : {}) }}
              >
                Paste Scope of Work
              </button>
            </div>

            {scopeMode && (
              <div style={styles.field}>
                <label style={styles.label}>Scope of Work</label>
                <textarea
                  style={{ ...styles.input, minHeight: '150px', resize: 'vertical' }}
                  placeholder="Paste your scope of work here... e.g., 'Remodel master bathroom. Remove existing tub, install walk-in shower with frameless glass door. New vanity with double sinks...'"
                  value={scope}
                  onChange={e => setScope(e.target.value)}
                />
                <p style={styles.scopeHint}>
                  AI will analyze this scope and generate line items automatically.
                </p>
              </div>
            )}
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.actions}>
            <a href="/estimate" style={styles.cancelBtn}>Cancel</a>
            <button type="submit" disabled={loading} style={styles.submitBtn}>
              {loading ? 'Creating...' : 'Create Estimate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0f1419',
    color: '#f0f4f8',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  container: {
    maxWidth: '700px',
    margin: '0 auto',
    padding: '24px',
  },
  header: {
    marginBottom: '24px',
  },
  backLink: {
    color: '#7a64ff',
    textDecoration: 'none',
    fontSize: '0.85em',
  },
  title: {
    fontSize: '1.6em',
    fontWeight: 700,
    margin: '8px 0 0',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  card: {
    background: '#1a2332',
    borderRadius: '16px',
    padding: '24px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  cardTitle: {
    fontSize: '1.1em',
    fontWeight: 600,
    margin: '0 0 16px',
    color: '#f0f4f8',
  },
  aiBadge: {
    padding: '2px 8px',
    background: 'linear-gradient(135deg, #5d47fa, #7a64ff)',
    borderRadius: '6px',
    fontSize: '0.7em',
    fontWeight: 700,
    color: '#fff',
    marginBottom: '16px',
  },
  hint: {
    color: '#8899a6',
    fontSize: '0.85em',
    margin: '0 0 16px',
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
    marginTop: '12px',
  },
  label: {
    fontSize: '0.85em',
    fontWeight: 500,
    color: '#8899a6',
  },
  input: {
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#f0f4f8',
    fontSize: '0.95em',
    fontFamily: 'inherit',
  },
  modeRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
  },
  modeBtn: {
    flex: 1,
    padding: '10px 16px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    color: '#8899a6',
    cursor: 'pointer',
    fontSize: '0.9em',
    fontWeight: 500,
  },
  modeBtnActive: {
    background: 'rgba(93,71,250,0.15)',
    borderColor: 'rgba(93,71,250,0.4)',
    color: '#7a64ff',
  },
  scopeHint: {
    color: '#8899a6',
    fontSize: '0.8em',
    marginTop: '4px',
  },
  error: {
    padding: '10px 14px',
    background: 'rgba(255,82,82,0.1)',
    border: '1px solid rgba(255,82,82,0.3)',
    borderRadius: '8px',
    color: '#ff5252',
    fontSize: '0.9em',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  },
  cancelBtn: {
    padding: '10px 20px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '10px',
    color: '#8899a6',
    textDecoration: 'none',
    fontSize: '0.95em',
    display: 'flex',
    alignItems: 'center',
  },
  submitBtn: {
    padding: '10px 24px',
    background: 'linear-gradient(135deg, #5d47fa, #7a64ff)',
    borderRadius: '10px',
    color: '#fff',
    fontWeight: 600,
    fontSize: '0.95em',
    border: 'none',
    cursor: 'pointer',
  },
};
