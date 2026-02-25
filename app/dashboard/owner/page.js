'use client';

import { useState, useEffect } from 'react';
import Nav from '../../components/Nav';
import DashboardCard from '../../components/DashboardCard';
import BarChart from '../../components/charts/BarChart';
import LineChart from '../../components/charts/LineChart';

export default function OwnerDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      const res = await fetch(`/api/dashboard/owner?grantKey=${encodeURIComponent(grantKey)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load owner dashboard');
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

  const fmtFull = (n) => {
    if (n === undefined || n === null) return '--';
    return '$' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <Nav />
        <div style={styles.container}>
          <div style={styles.loadingWrap}>
            <div style={styles.spinner} />
            <p style={styles.loadingText}>Loading owner dashboard...</p>
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
            <p style={styles.emptyText}>No data available</p>
          </div>
        </div>
      </div>
    );
  }

  const revenueByMonth = data.revenueByMonth || [];
  const margins = data.margins || {};
  const cashFlow = data.cashFlow || {};

  return (
    <div style={styles.page}>
      <Nav />
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>Owner P&L</h1>
            <p style={styles.subtitle}>
              {data.organization ? data.organization + ' — ' : ''}Financial overview from JobTread
            </p>
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
            value={fmt(data.totalRevenue)}
            label="Total Revenue"
            trend={data.revenueTrend}
            trendLabel="vs last period"
            icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            color="#22c55e"
          />
          <DashboardCard
            value={(margins.overall || data.avgMargin || 0) + '%'}
            label="Avg Margin"
            trend={data.marginTrend}
            trendLabel="vs last period"
            icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            color="#a78bfa"
          />
          <DashboardCard
            value={String(data.activeJobs || 0)}
            label="Active Jobs"
            icon="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            color="#38bdf8"
          />
          <DashboardCard
            value={fmt(data.pipelineValue)}
            label="Pipeline Value"
            icon="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
            color="#5d47fa"
          />
        </div>

        {/* Revenue Chart */}
        <div style={styles.section}>
          <BarChart
            title="Revenue by Month"
            data={revenueByMonth}
            dataKey="revenue"
            xKey="month"
            height={320}
            colors={['#5d47fa', '#7a64ff', '#9d8cff', '#5d47fa', '#7a64ff', '#9d8cff', '#5d47fa', '#7a64ff', '#9d8cff', '#5d47fa', '#7a64ff', '#9d8cff']}
            formatValue={(val) => fmt(val)}
          />
        </div>

        {/* Cash Flow Summary */}
        <div style={styles.section}>
          <div style={styles.sectionCard}>
            <h3 style={styles.sectionTitle}>Cash Flow Summary</h3>
            <div style={styles.cashFlowGrid}>
              <div style={styles.cashFlowItem}>
                <div style={styles.cashFlowLabel}>Cash In</div>
                <div style={{ ...styles.cashFlowValue, color: '#34d399' }}>
                  {fmtFull(cashFlow.cashIn || data.totalRevenue || 0)}
                </div>
              </div>
              <div style={styles.cashFlowItem}>
                <div style={styles.cashFlowLabel}>Cash Out</div>
                <div style={{ ...styles.cashFlowValue, color: '#f87171' }}>
                  {fmtFull(cashFlow.cashOut || 0)}
                </div>
              </div>
              <div style={styles.cashFlowItem}>
                <div style={styles.cashFlowLabel}>Net Cash Flow</div>
                <div style={{
                  ...styles.cashFlowValue,
                  color: (cashFlow.net || 0) >= 0 ? '#34d399' : '#f87171',
                }}>
                  {fmtFull(cashFlow.net || 0)}
                </div>
              </div>
              <div style={styles.cashFlowItem}>
                <div style={styles.cashFlowLabel}>Outstanding AR</div>
                <div style={{ ...styles.cashFlowValue, color: '#f59e0b' }}>
                  {fmtFull(data.outstandingAR || 0)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Margin Details */}
        {margins && (margins.byJob || margins.labor || margins.materials) && (
          <div style={styles.section}>
            <div style={styles.sectionCard}>
              <h3 style={styles.sectionTitle}>Margin Breakdown</h3>
              <div style={styles.marginGrid}>
                {margins.overall !== undefined && (
                  <div style={styles.marginItem}>
                    <div style={styles.marginBar}>
                      <div style={{
                        ...styles.marginFill,
                        width: Math.min(margins.overall, 100) + '%',
                        background: 'linear-gradient(90deg, #5d47fa, #7a64ff)',
                      }} />
                    </div>
                    <div style={styles.marginInfo}>
                      <span style={styles.marginLabel}>Overall</span>
                      <span style={styles.marginPct}>{margins.overall}%</span>
                    </div>
                  </div>
                )}
                {margins.labor !== undefined && (
                  <div style={styles.marginItem}>
                    <div style={styles.marginBar}>
                      <div style={{
                        ...styles.marginFill,
                        width: Math.min(margins.labor, 100) + '%',
                        background: 'linear-gradient(90deg, #34d399, #6ee7b7)',
                      }} />
                    </div>
                    <div style={styles.marginInfo}>
                      <span style={styles.marginLabel}>Labor</span>
                      <span style={styles.marginPct}>{margins.labor}%</span>
                    </div>
                  </div>
                )}
                {margins.materials !== undefined && (
                  <div style={styles.marginItem}>
                    <div style={styles.marginBar}>
                      <div style={{
                        ...styles.marginFill,
                        width: Math.min(margins.materials, 100) + '%',
                        background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                      }} />
                    </div>
                    <div style={styles.marginInfo}>
                      <span style={styles.marginLabel}>Materials</span>
                      <span style={styles.marginPct}>{margins.materials}%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Job List Table */}
        {data.topJobs && data.topJobs.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionCard}>
              <h3 style={styles.sectionTitle}>Top Jobs by Revenue</h3>
              <div style={styles.tableWrap}>
                <div style={styles.tableHeader}>
                  <span style={{ ...styles.tableCell, flex: 2 }}>Job</span>
                  <span style={styles.tableCell}>Revenue</span>
                  <span style={styles.tableCell}>Cost</span>
                  <span style={styles.tableCell}>Margin</span>
                </div>
                {data.topJobs.slice(0, 10).map((job, i) => (
                  <div key={job.id || i} style={styles.tableRow}>
                    <span style={{ ...styles.tableCell, flex: 2, color: '#e5e7eb', fontWeight: 600 }}>
                      {job.name || 'Untitled'}
                    </span>
                    <span style={styles.tableCell}>{fmt(job.revenue)}</span>
                    <span style={styles.tableCell}>{fmt(job.cost)}</span>
                    <span style={{
                      ...styles.tableCell,
                      color: (job.margin || 0) >= 30 ? '#34d399' : (job.margin || 0) >= 15 ? '#f59e0b' : '#f87171',
                      fontWeight: 600,
                    }}>
                      {job.margin !== undefined ? job.margin + '%' : '--'}
                    </span>
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
  cashFlowGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '16px',
  },
  cashFlowItem: {
    padding: '16px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.04)',
  },
  cashFlowLabel: {
    color: '#6b7280',
    fontSize: '0.78em',
    fontWeight: 500,
    marginBottom: '6px',
  },
  cashFlowValue: {
    fontSize: '1.3em',
    fontWeight: 800,
    fontVariantNumeric: 'tabular-nums',
  },
  marginGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  marginItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  marginBar: {
    height: '8px',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  marginFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.6s ease-out',
  },
  marginInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  marginLabel: {
    color: '#6b7280',
    fontSize: '0.8em',
    fontWeight: 500,
  },
  marginPct: {
    color: '#e5e7eb',
    fontSize: '0.82em',
    fontWeight: 700,
  },
  tableWrap: {
    display: 'flex',
    flexDirection: 'column',
  },
  tableHeader: {
    display: 'flex',
    padding: '8px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    marginBottom: '4px',
  },
  tableRow: {
    display: 'flex',
    padding: '10px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.03)',
  },
  tableCell: {
    flex: 1,
    color: '#9ca3af',
    fontSize: '0.82em',
    fontWeight: 500,
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
