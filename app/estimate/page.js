'use client';

import { useState, useEffect } from 'react';
import Nav from '../components/Nav';

const STATUS_COLORS = {
  draft: { bg: 'rgba(255,193,7,0.15)', color: '#ffc107' },
  sent: { bg: 'rgba(93,71,250,0.15)', color: '#7a64ff' },
  approved: { bg: 'rgba(0,200,83,0.15)', color: '#00c853' },
  rejected: { bg: 'rgba(255,82,82,0.15)', color: '#ff5252' },
};

export default function EstimateDashboard() {
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    loadEstimates();
  }, [filter]);

  const loadEstimates = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter) params.set('status', filter);
      const res = await fetch('/api/estimate?' + params.toString());
      const data = await res.json();
      setEstimates(data.estimates || []);
    } catch (err) {
      console.error('Failed to load estimates:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteEstimate = async (id) => {
    if (!confirm('Delete this estimate?')) return;
    await fetch(`/api/estimate/${id}`, { method: 'DELETE' });
    loadEstimates();
  };

  // Stats
  const totalPipeline = estimates.reduce((s, e) => s + (parseFloat(e.total_price) || 0), 0);
  const avgMargin = estimates.length > 0
    ? estimates.reduce((s, e) => s + (parseFloat(e.margin_pct) || 0), 0) / estimates.length
    : 0;
  const thisMonth = estimates.filter(e => {
    const d = new Date(e.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div style={styles.page}>
      <Nav />
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Estimates</h1>
            <p style={styles.subtitle}>AI-powered estimating for construction pros</p>
          </div>
          <a href="/estimate/new" style={styles.newBtn}>+ New Estimate</a>
        </div>

        {/* Stats Bar */}
        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>${totalPipeline.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            <div style={styles.statLabel}>Total Pipeline</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{avgMargin.toFixed(1)}%</div>
            <div style={styles.statLabel}>Avg Margin</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{thisMonth}</div>
            <div style={styles.statLabel}>This Month</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{estimates.length}</div>
            <div style={styles.statLabel}>Total Estimates</div>
          </div>
        </div>

        {/* Filters */}
        <div style={styles.filterRow}>
          {['', 'draft', 'sent', 'approved', 'rejected'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                ...styles.filterBtn,
                ...(filter === f ? styles.filterActive : {}),
              }}
            >
              {f || 'All'}
            </button>
          ))}
        </div>

        {/* Estimate List */}
        {loading ? (
          <div style={styles.empty}>Loading estimates...</div>
        ) : estimates.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>&#x1f4cb;</div>
            <h3 style={styles.emptyTitle}>No estimates yet</h3>
            <p style={styles.emptyText}>Create your first estimate to get started.</p>
            <a href="/estimate/new" style={styles.newBtn}>+ New Estimate</a>
          </div>
        ) : (
          <div style={styles.list}>
            {estimates.map(est => {
              const statusStyle = STATUS_COLORS[est.status] || STATUS_COLORS.draft;
              return (
                <a key={est.id} href={`/estimate/${est.id}`} style={styles.card}>
                  <div style={styles.cardTop}>
                    <div>
                      <div style={styles.cardName}>{est.name}</div>
                      {est.client_name && (
                        <div style={styles.cardClient}>{est.client_name}</div>
                      )}
                    </div>
                    <span style={{ ...styles.badge, background: statusStyle.bg, color: statusStyle.color }}>
                      {est.status}
                    </span>
                  </div>
                  <div style={styles.cardBottom}>
                    <span style={styles.cardPrice}>
                      ${parseFloat(est.total_price || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                    <span style={styles.cardMargin}>
                      {parseFloat(est.margin_pct || 0).toFixed(1)}% margin
                    </span>
                    <span style={styles.cardDate}>
                      {new Date(est.created_at).toLocaleDateString()}
                    </span>
                    <button
                      onClick={(e) => { e.preventDefault(); deleteEstimate(est.id); }}
                      style={styles.deleteBtn}
                    >
                      Delete
                    </button>
                  </div>
                </a>
              );
            })}
          </div>
        )}
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
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '24px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
  },
  title: {
    fontSize: '1.8em',
    fontWeight: 700,
    margin: 0,
  },
  subtitle: {
    color: '#8899a6',
    margin: '4px 0 0',
    fontSize: '0.95em',
  },
  newBtn: {
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #5d47fa, #7a64ff)',
    borderRadius: '10px',
    color: '#fff',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '0.95em',
    border: 'none',
    cursor: 'pointer',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px',
    marginBottom: '24px',
  },
  statCard: {
    background: '#1a2332',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  statValue: {
    fontSize: '1.5em',
    fontWeight: 700,
    color: '#f0f4f8',
  },
  statLabel: {
    fontSize: '0.8em',
    color: '#8899a6',
    marginTop: '2px',
  },
  filterRow: {
    display: 'flex',
    gap: '4px',
    marginBottom: '16px',
  },
  filterBtn: {
    padding: '6px 14px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '20px',
    color: '#8899a6',
    cursor: 'pointer',
    fontSize: '0.85em',
    textTransform: 'capitalize',
  },
  filterActive: {
    background: 'rgba(93,71,250,0.15)',
    borderColor: 'rgba(93,71,250,0.4)',
    color: '#7a64ff',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  card: {
    display: 'block',
    background: '#1a2332',
    borderRadius: '12px',
    padding: '16px 20px',
    border: '1px solid rgba(255,255,255,0.06)',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'border-color 0.15s',
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '8px',
  },
  cardName: {
    fontWeight: 600,
    fontSize: '1.05em',
    color: '#f0f4f8',
  },
  cardClient: {
    color: '#8899a6',
    fontSize: '0.85em',
    marginTop: '2px',
  },
  badge: {
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '0.75em',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  cardBottom: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    fontSize: '0.85em',
  },
  cardPrice: {
    fontWeight: 700,
    color: '#00c853',
  },
  cardMargin: {
    color: '#8899a6',
  },
  cardDate: {
    color: '#8899a6',
  },
  deleteBtn: {
    marginLeft: 'auto',
    padding: '4px 10px',
    background: 'transparent',
    border: '1px solid rgba(255,82,82,0.3)',
    borderRadius: '6px',
    color: '#ff5252',
    cursor: 'pointer',
    fontSize: '0.8em',
  },
  empty: {
    textAlign: 'center',
    color: '#8899a6',
    padding: '40px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
  },
  emptyIcon: {
    fontSize: '3em',
    marginBottom: '12px',
  },
  emptyTitle: {
    color: '#f0f4f8',
    margin: '0 0 8px',
  },
  emptyText: {
    color: '#8899a6',
    margin: '0 0 20px',
  },
};
