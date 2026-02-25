'use client';

import { useState, useEffect } from 'react';
import Nav from '../components/Nav';

const STATUS_COLORS = {
  draft: { bg: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: 'rgba(251,191,36,0.25)' },
  sent: { bg: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: 'rgba(139,92,246,0.25)' },
  approved: { bg: 'rgba(34,197,94,0.1)', color: '#22c55e', border: 'rgba(34,197,94,0.25)' },
  rejected: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'rgba(239,68,68,0.25)' },
};

export default function EstimateDashboard() {
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [dbError, setDbError] = useState(false);

  useEffect(() => {
    checkAndLoad();
  }, [filter]);

  const checkAndLoad = async () => {
    setLoading(true);
    try {
      // First check DB status
      const setupRes = await fetch('/api/setup');
      const setupData = await setupRes.json();
      if (setupData.status === 'no_database' || setupData.status === 'needs_setup') {
        // Auto-setup tables if DB exists but tables don't
        if (setupData.status === 'needs_setup') {
          await fetch('/api/setup', { method: 'POST' });
        } else {
          setDbError(true);
          setLoading(false);
          return;
        }
      }
      await loadEstimates();
    } catch (err) {
      console.error('Setup check failed:', err);
      await loadEstimates();
    }
  };

  const loadEstimates = async () => {
    try {
      const params = new URLSearchParams();
      if (filter) params.set('status', filter);
      const res = await fetch('/api/estimate?' + params.toString());
      const data = await res.json();
      if (data.error && data.error.includes('DATABASE_URL')) {
        setDbError(true);
        return;
      }
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

  const totalPipeline = estimates.reduce((s, e) => s + (parseFloat(e.total_price) || 0), 0);
  const avgMargin = estimates.length > 0
    ? estimates.reduce((s, e) => s + (parseFloat(e.margin_pct) || 0), 0) / estimates.length
    : 0;
  const thisMonth = estimates.filter(e => {
    const d = new Date(e.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const stats = [
    { label: 'Pipeline', value: '$' + totalPipeline.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }), icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: '#22c55e' },
    { label: 'Avg Margin', value: avgMargin.toFixed(1) + '%', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6', color: '#a78bfa' },
    { label: 'This Month', value: String(thisMonth), icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', color: '#38bdf8' },
    { label: 'Total', value: String(estimates.length), icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', color: '#f59e0b' },
  ];

  return (
    <div style={styles.page}>
      <Nav />
      <div style={styles.container}>
        {/* Database Error */}
        {dbError && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 style={{ color: '#fff', fontSize: '1.3em', fontWeight: 700, margin: '0 0 8px' }}>Database Not Connected</h2>
            <p style={{ color: '#6b7280', fontSize: '0.9em', margin: '0 0 24px', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
              Add a Neon Postgres database to your Vercel project, then redeploy.
            </p>
            <a href="/setup" style={styles.newBtn}>Go to Setup</a>
          </div>
        )}

        {!dbError && <>
        {/* Hero Header */}
        <div style={styles.hero}>
          <div style={styles.heroContent}>
            <div style={styles.heroLeft}>
              <h1 style={styles.heroTitle}>Estimates</h1>
              <p style={styles.heroSub}>AI-powered construction estimating</p>
            </div>
            <a href="/estimate/new" style={styles.newBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New Estimate
            </a>
          </div>

          {/* Stats */}
          <div style={styles.statsRow}>
            {stats.map((stat, i) => (
              <div key={i} style={styles.statCard}>
                <div style={{ ...styles.statIcon, background: stat.color + '15', color: stat.color }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={stat.icon} />
                  </svg>
                </div>
                <div>
                  <div style={styles.statValue}>{stat.value}</div>
                  <div style={styles.statLabel}>{stat.label}</div>
                </div>
              </div>
            ))}
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
              {f === '' && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
              {f || 'All'}
            </button>
          ))}
        </div>

        {/* Estimate List */}
        {loading ? (
          <div style={styles.loadingWrap}>
            <div style={styles.spinner} />
            <p style={styles.loadingText}>Loading estimates...</p>
          </div>
        ) : estimates.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIconWrap}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#4b5563' }}>
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 style={styles.emptyTitle}>No estimates yet</h3>
            <p style={styles.emptyText}>Create your first AI-powered estimate to get started.</p>
            <a href="/estimate/new" style={styles.newBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New Estimate
            </a>
          </div>
        ) : (
          <div style={styles.list}>
            {estimates.map(est => {
              const statusStyle = STATUS_COLORS[est.status] || STATUS_COLORS.draft;
              const price = parseFloat(est.total_price || 0);
              const margin = parseFloat(est.margin_pct || 0);
              return (
                <a key={est.id} href={`/estimate/${est.id}`} style={styles.card}>
                  <div style={styles.cardLeft}>
                    <div style={styles.cardName}>{est.name}</div>
                    {est.client_name && (
                      <div style={styles.cardClient}>{est.client_name}</div>
                    )}
                    <div style={styles.cardMeta}>
                      <span style={styles.cardDate}>
                        {new Date(est.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      {est.job_address && (
                        <span style={styles.cardAddress}>{est.job_address}</span>
                      )}
                    </div>
                  </div>
                  <div style={styles.cardRight}>
                    <span style={{ ...styles.badge, background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}` }}>
                      {est.status}
                    </span>
                    <div style={styles.cardPrice}>
                      ${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                    <div style={styles.cardMargin}>
                      {margin.toFixed(1)}% margin
                    </div>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteEstimate(est.id); }}
                      style={styles.deleteBtn}
                      title="Delete estimate"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </a>
              );
            })}
          </div>
        )}
        </>}
      </div>

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes cardIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
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
    marginBottom: '24px',
  },
  heroLeft: {},
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
  newBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 22px',
    background: 'linear-gradient(135deg, #5d47fa 0%, #7c3aed 100%)',
    borderRadius: '10px',
    color: '#fff',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '0.9em',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(93,71,250,0.35)',
    transition: 'all 0.2s',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px',
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '12px',
    padding: '14px 16px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  statIcon: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statValue: {
    fontSize: '1.25em',
    fontWeight: 700,
    color: '#fff',
    lineHeight: 1.2,
  },
  statLabel: {
    fontSize: '0.75em',
    color: '#6b7280',
    marginTop: '1px',
  },
  filterRow: {
    display: 'flex',
    gap: '6px',
    marginBottom: '20px',
  },
  filterBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 14px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    color: '#6b7280',
    cursor: 'pointer',
    fontSize: '0.82em',
    fontWeight: 500,
    textTransform: 'capitalize',
    transition: 'all 0.15s',
  },
  filterActive: {
    background: 'rgba(93,71,250,0.12)',
    borderColor: 'rgba(93,71,250,0.3)',
    color: '#a78bfa',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  card: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'rgba(255,255,255,0.025)',
    borderRadius: '12px',
    padding: '16px 20px',
    border: '1px solid rgba(255,255,255,0.06)',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'all 0.2s',
    animation: 'cardIn 0.3s ease-out',
  },
  cardLeft: {
    flex: 1,
    minWidth: 0,
  },
  cardName: {
    fontWeight: 600,
    fontSize: '1em',
    color: '#f3f4f6',
    marginBottom: '2px',
  },
  cardClient: {
    color: '#9ca3af',
    fontSize: '0.85em',
    marginBottom: '6px',
  },
  cardMeta: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  cardDate: {
    color: '#6b7280',
    fontSize: '0.78em',
  },
  cardAddress: {
    color: '#6b7280',
    fontSize: '0.78em',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '250px',
  },
  cardRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexShrink: 0,
  },
  badge: {
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '0.72em',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  cardPrice: {
    fontWeight: 700,
    fontSize: '1.1em',
    color: '#22c55e',
    fontVariantNumeric: 'tabular-nums',
  },
  cardMargin: {
    color: '#6b7280',
    fontSize: '0.82em',
    fontVariantNumeric: 'tabular-nums',
  },
  deleteBtn: {
    padding: '6px',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: '6px',
    color: '#4b5563',
    cursor: 'pointer',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
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
  },
};
