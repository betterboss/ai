'use client';

import { useState, useEffect } from 'react';
import Nav from '../../components/Nav';
import DashboardCard from '../../components/DashboardCard';
import BarChart from '../../components/charts/BarChart';
import PipelineBoard from '../../components/PipelineBoard';

export default function SalesDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('board'); // 'board' or 'chart'

  useEffect(() => {
    const grantKey = localStorage.getItem('bb_grant_key') || localStorage.getItem('bb_grantKey') || localStorage.getItem('jobtread_grant_key');
    if (!grantKey) {
      setError('No JobTread grant key found. Go to Setup to connect your account.');
      setLoading(false);
      return;
    }
    loadData(grantKey);
  }, []);

  const loadData = async (grantKey) => {
    try {
      const res = await fetch(`/api/dashboard/sales?grantKey=${encodeURIComponent(grantKey)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load sales dashboard');
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n) => {
    if (n === undefined || n === null) return '--';
    if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return '$' + Math.round(n / 1000) + 'k';
    return '$' + n.toLocaleString();
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <Nav />
        <div style={styles.container}>
          <div style={styles.loadingWrap}>
            <div style={styles.spinner} />
            <p style={styles.loadingText}>Loading sales pipeline...</p>
          </div>
        </div>
        <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.page}>
        <Nav />
        <div style={styles.container}>
          <div style={styles.errorWrap}>
            <div style={styles.errorIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p style={styles.errorText}>{error}</p>
            <a href="/setup" style={styles.setupLink}>Go to Setup</a>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={styles.page}>
        <Nav />
        <div style={styles.container}>
          <div style={styles.emptyWrap}>
            <p style={styles.emptyText}>No sales data available</p>
          </div>
        </div>
      </div>
    );
  }

  const pipelineByStage = data.pipelineByStage || [];
  const stageChartData = pipelineByStage.map((s) => ({
    name: s.name,
    value: s.totalValue || s.value || 0,
    count: s.count || (s.jobs ? s.jobs.length : 0),
  }));

  return (
    <div style={styles.page}>
      <Nav />
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>Sales Pipeline</h1>
            <p style={styles.subtitle}>Pipeline tracking and conversion analytics</p>
          </div>
          <a href="/dashboard" style={styles.backLink}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            All Dashboards
          </a>
        </div>

        {/* KPI Cards */}
        <div style={styles.cardGrid}>
          <DashboardCard
            value={fmt(data.totalPipelineValue || data.pipelineValue)}
            label="Pipeline Value"
            trend={data.pipelineTrend}
            trendLabel="vs last period"
            icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            color="#5d47fa"
          />
          <DashboardCard
            value={(data.conversionRate || 0) + '%'}
            label="Conversion Rate"
            trend={data.conversionTrend}
            trendLabel="vs last period"
            icon="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
            color="#34d399"
          />
          <DashboardCard
            value={String(data.estimatesPending || data.estimateCount || 0)}
            label="Estimates Pending"
            icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            color="#f59e0b"
          />
          <DashboardCard
            value={String(data.leadsCount || data.leads || 0)}
            label="Active Leads"
            icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            color="#38bdf8"
          />
        </div>

        {/* Pipeline Value by Stage (Horizontal Bar) */}
        <div style={styles.section}>
          <BarChart
            title="Pipeline Value by Stage"
            data={stageChartData}
            dataKey="value"
            xKey="name"
            horizontal={true}
            height={Math.max(200, stageChartData.length * 50)}
            colors={['#5d47fa', '#7a64ff', '#9d8cff', '#34d399', '#f59e0b', '#f87171']}
            formatValue={(val) => fmt(val)}
          />
        </div>

        {/* View Toggle */}
        <div style={styles.section}>
          <div style={styles.viewToggle}>
            <button
              onClick={() => setView('board')}
              style={{
                ...styles.toggleBtn,
                ...(view === 'board' ? styles.toggleBtnActive : {}),
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Board View
            </button>
            <button
              onClick={() => setView('chart')}
              style={{
                ...styles.toggleBtn,
                ...(view === 'chart' ? styles.toggleBtnActive : {}),
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Chart View
            </button>
          </div>
        </div>

        {/* Pipeline Board or Chart */}
        {view === 'board' ? (
          <div style={styles.section}>
            <PipelineBoard
              stages={pipelineByStage}
              formatValue={fmt}
            />
          </div>
        ) : (
          <div style={styles.section}>
            <BarChart
              title="Jobs by Stage"
              data={stageChartData}
              dataKey="count"
              xKey="name"
              height={300}
              colors={['#5d47fa', '#7a64ff', '#9d8cff', '#34d399', '#f59e0b', '#f87171']}
            />
          </div>
        )}

        {/* Recent Estimates */}
        {data.recentEstimates && data.recentEstimates.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionCard}>
              <h3 style={styles.sectionTitle}>Recent Estimates</h3>
              <div style={styles.estimateList}>
                {data.recentEstimates.slice(0, 8).map((est, i) => (
                  <div key={est.id || i} style={styles.estimateItem}>
                    <div style={styles.estimateInfo}>
                      <span style={styles.estimateName}>{est.name || est.jobName || 'Untitled'}</span>
                      {est.customer && <span style={styles.estimateCustomer}>{est.customer}</span>}
                    </div>
                    <div style={styles.estimateMeta}>
                      <span style={styles.estimateValue}>{fmt(est.value || est.total)}</span>
                      {est.status && (
                        <span style={{
                          ...styles.estimateStatus,
                          color: est.status === 'Sold' || est.status === 'Won' ? '#34d399'
                            : est.status === 'Lost' ? '#f87171'
                            : '#f59e0b',
                          background: est.status === 'Sold' || est.status === 'Won' ? 'rgba(52,211,153,0.1)'
                            : est.status === 'Lost' ? 'rgba(248,113,113,0.1)'
                            : 'rgba(245,158,11,0.1)',
                        }}>
                          {est.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
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
  },
  container: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '0 24px 60px',
    animation: 'fadeIn 0.3s ease-out',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '32px 0 24px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  title: {
    fontSize: '2em',
    fontWeight: 800,
    color: '#fff',
    margin: 0,
    letterSpacing: '-0.03em',
  },
  subtitle: {
    color: '#6b7280',
    margin: '4px 0 0',
    fontSize: '0.9em',
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: '#12131a',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    color: '#9ca3af',
    textDecoration: 'none',
    fontSize: '0.82em',
    fontWeight: 500,
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '12px',
    marginBottom: '8px',
  },
  section: {
    marginTop: '20px',
  },
  sectionCard: {
    background: '#12131a',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '14px',
    padding: '22px 20px',
  },
  sectionTitle: {
    color: '#e5e7eb',
    fontSize: '0.95em',
    fontWeight: 700,
    margin: '0 0 16px 0',
    letterSpacing: '-0.01em',
  },
  viewToggle: {
    display: 'flex',
    gap: '4px',
    background: '#12131a',
    borderRadius: '10px',
    padding: '4px',
    border: '1px solid rgba(255,255,255,0.06)',
    width: 'fit-content',
  },
  toggleBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: 'transparent',
    border: 'none',
    borderRadius: '7px',
    color: '#6b7280',
    fontSize: '0.82em',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'inherit',
  },
  toggleBtnActive: {
    background: 'linear-gradient(135deg, #5d47fa, #7c3aed)',
    color: '#fff',
    boxShadow: '0 2px 8px rgba(93,71,250,0.35)',
  },
  estimateList: {
    display: 'flex',
    flexDirection: 'column',
  },
  estimateItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    gap: '12px',
  },
  estimateInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flex: 1,
    minWidth: 0,
  },
  estimateName: {
    color: '#e5e7eb',
    fontSize: '0.85em',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  estimateCustomer: {
    color: '#6b7280',
    fontSize: '0.75em',
  },
  estimateMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexShrink: 0,
  },
  estimateValue: {
    color: '#9ca3af',
    fontSize: '0.85em',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
  },
  estimateStatus: {
    fontSize: '0.72em',
    fontWeight: 600,
    padding: '3px 8px',
    borderRadius: '6px',
  },
  loadingWrap: {
    textAlign: 'center',
    padding: '100px 20px',
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
  errorWrap: {
    textAlign: 'center',
    padding: '100px 20px',
  },
  errorIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    background: 'rgba(239,68,68,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
  },
  errorText: {
    color: '#ef4444',
    fontSize: '0.9em',
    marginBottom: '16px',
  },
  setupLink: {
    display: 'inline-flex',
    padding: '8px 20px',
    background: 'rgba(93,71,250,0.15)',
    border: '1px solid rgba(93,71,250,0.3)',
    borderRadius: '8px',
    color: '#a78bfa',
    textDecoration: 'none',
    fontSize: '0.85em',
    fontWeight: 500,
  },
  emptyWrap: {
    textAlign: 'center',
    padding: '100px 20px',
  },
  emptyText: {
    color: '#4b5563',
    fontSize: '0.9em',
  },
};
