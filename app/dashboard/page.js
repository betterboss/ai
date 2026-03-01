'use client';

import { useState, useEffect } from 'react';
import PageShell from '../components/PageShell';

const QUICK_ACTIONS = [
  { label: 'New Estimate', href: '/estimate/new', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', color: '#a78bfa' },
  { label: 'Contacts', href: '/contacts', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', color: '#38bdf8' },
  { label: 'Jobs', href: '/jobs', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', color: '#22c55e' },
  { label: 'Invoices', href: '/invoices', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: '#f59e0b' },
  { label: 'Catalog', href: '/catalog', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', color: '#2dd4a8' },
];

function fmt(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const key = typeof window !== 'undefined' ? localStorage.getItem('bb_jobtread_grant_key') : null;
    if (!key) {
      setError('no_key');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/jobtread/dashboard', { headers: { 'x-jobtread-key': key } });
      const json = await res.json();
      if (json.error) { setError(json.error); setLoading(false); return; }
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <PageShell>
      <div style={styles.page}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.greeting}>{greeting}</h1>
            <p style={styles.date}>{dateStr}</p>
          </div>
          <button onClick={load} style={styles.refreshBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Quick Actions */}
        <div style={styles.actionsRow}>
          {QUICK_ACTIONS.map(a => (
            <a key={a.label} href={a.href} style={styles.actionBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={a.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={a.icon} />
              </svg>
              {a.label}
            </a>
          ))}
        </div>

        {loading ? (
          <div style={styles.loadingWrap}>
            <div style={styles.spinner} />
            <p style={{ color: '#6b7280', fontSize: '0.9em' }}>Loading dashboard...</p>
          </div>
        ) : error === 'no_key' ? (
          <div style={styles.emptyState}>
            <h3 style={{ color: '#fff', margin: '0 0 8px' }}>Connect JobTread</h3>
            <p style={{ color: '#6b7280', margin: '0 0 20px', fontSize: '0.9em' }}>Add your JobTread grant key to see live sales data.</p>
            <a href="/setup" style={styles.setupBtn}>Go to Setup</a>
          </div>
        ) : error ? (
          <div style={styles.emptyState}>
            <p style={{ color: '#ef4444' }}>{error}</p>
            <button onClick={load} style={styles.setupBtn}>Retry</button>
          </div>
        ) : data && (
          <>
            {/* Sales Performance */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>Sales Performance</h2>
                <span style={styles.liveBadge}>LIVE</span>
              </div>
              <div style={styles.kpiGrid}>
                <div style={styles.kpi}>
                  <div style={{ ...styles.kpiValue, color: '#22c55e' }}>{fmt(data.sales.wonValue)}</div>
                  <div style={styles.kpiLabel}>Won Value</div>
                </div>
                <div style={styles.kpi}>
                  <div style={{ ...styles.kpiValue, color: '#fff' }}>{data.sales.dealsWon}</div>
                  <div style={styles.kpiLabel}>Deals Won</div>
                </div>
                <div style={styles.kpi}>
                  <div style={{ ...styles.kpiValue, color: '#a78bfa' }}>{data.sales.winRate}%</div>
                  <div style={styles.kpiLabel}>Win Rate</div>
                </div>
                <div style={styles.kpi}>
                  <div style={{ ...styles.kpiValue, color: '#fff' }}>{data.jobs.active}</div>
                  <div style={styles.kpiLabel}>Active Jobs</div>
                </div>
                <div style={styles.kpi}>
                  <div style={{ ...styles.kpiValue, color: '#f59e0b' }}>{fmt(data.sales.pendingValue)}</div>
                  <div style={styles.kpiLabel}>Pending Proposals</div>
                </div>
                <div style={styles.kpi}>
                  <div style={{ ...styles.kpiValue, color: '#ef4444' }}>{fmt(data.invoices.outstandingAR)}</div>
                  <div style={styles.kpiLabel}>Outstanding AR</div>
                </div>
              </div>
            </div>

            {/* Bottom Cards */}
            <div style={styles.bottomGrid}>
              {/* Invoices Summary */}
              <div style={styles.card}>
                <h2 style={styles.cardTitle}>Invoices</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                  <div>
                    <div style={{ color: '#22c55e', fontWeight: 700, fontSize: '1.3em' }}>{fmt(data.invoices.totalInvoiced)}</div>
                    <div style={styles.kpiLabel}>Total Invoiced</div>
                  </div>
                  <div>
                    <div style={{ color: '#38bdf8', fontWeight: 700, fontSize: '1.3em' }}>{fmt(data.invoices.totalCollected)}</div>
                    <div style={styles.kpiLabel}>Collected</div>
                  </div>
                  <div>
                    <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: '1.3em' }}>{fmt(data.invoices.outstandingAR)}</div>
                    <div style={styles.kpiLabel}>Outstanding</div>
                  </div>
                  <div>
                    <div style={{ color: '#ef4444', fontWeight: 700, fontSize: '1.3em' }}>{data.invoices.overdueCount}</div>
                    <div style={styles.kpiLabel}>Overdue</div>
                  </div>
                </div>
              </div>

              {/* System Status */}
              <div style={styles.card}>
                <h2 style={styles.cardTitle}>System Status</h2>
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={styles.statusRow}>
                    <span style={{ ...styles.statusDot, background: '#22c55e' }} />
                    <span style={{ flex: 1 }}>JobTread</span>
                    <span style={{ color: '#22c55e', fontSize: '0.82em' }}>Connected</span>
                  </div>
                  <div style={styles.statusRow}>
                    <span style={{ ...styles.statusDot, background: '#22c55e' }} />
                    <span style={{ flex: 1 }}>Database</span>
                    <span style={{ color: '#22c55e', fontSize: '0.82em' }}>Neon</span>
                  </div>
                  <div style={styles.statusRow}>
                    <span style={{ ...styles.statusDot, background: localStorage.getItem('mrBetterBoss_apiKey') ? '#22c55e' : '#6b7280' }} />
                    <span style={{ flex: 1 }}>AI</span>
                    <span style={{ color: localStorage.getItem('mrBetterBoss_apiKey') ? '#22c55e' : '#6b7280', fontSize: '0.82em' }}>
                      {localStorage.getItem('mrBetterBoss_apiKey') ? 'Claude' : 'Not set'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}

const styles = {
  page: { padding: '28px 32px 60px', maxWidth: '1100px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
  greeting: { fontSize: '2em', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.03em' },
  date: { color: '#6b7280', margin: '4px 0 0', fontSize: '0.9em' },
  refreshBtn: {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
    background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
    color: '#9ca3af', cursor: 'pointer', fontSize: '0.85em', fontWeight: 500,
  },
  actionsRow: { display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' },
  actionBtn: {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px', color: '#e5e7eb', textDecoration: 'none', fontSize: '0.85em', fontWeight: 500,
    transition: 'all 0.15s',
  },
  card: {
    background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '14px', padding: '20px 24px', marginBottom: '16px',
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' },
  cardTitle: { fontSize: '1em', fontWeight: 600, color: '#e5e7eb', margin: 0 },
  liveBadge: {
    fontSize: '0.65em', fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.12)',
    padding: '3px 8px', borderRadius: '6px', letterSpacing: '0.5px',
  },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '16px' },
  kpi: { padding: '12px 0' },
  kpiValue: { fontSize: '1.5em', fontWeight: 800, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' },
  kpiLabel: { fontSize: '0.78em', color: '#6b7280', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.3px' },
  bottomGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  statusRow: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9em', color: '#e5e7eb' },
  statusDot: { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 },
  loadingWrap: { textAlign: 'center', padding: '80px 20px' },
  spinner: {
    width: '32px', height: '32px', border: '3px solid rgba(93,71,250,0.2)',
    borderTopColor: '#5d47fa', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
  },
  emptyState: { textAlign: 'center', padding: '60px 20px' },
  setupBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 22px',
    background: 'linear-gradient(135deg, #5d47fa 0%, #7c3aed 100%)', borderRadius: '10px',
    color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: '0.9em', border: 'none', cursor: 'pointer',
  },
};
